import { createAdminClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

type FlowNode = {
  id: string;
  type?: string;
  data: {
    nodeType: "greeting" | "menu" | "booking" | "condition" | "handoff";
    message?: string;
    options?: string[];
    conditionField?: string;
    conditionValue?: string;
  };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

function findStartNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode | undefined {
  const targetIds = new Set(edges.map((e) => e.target));
  return nodes.find((n) => !targetIds.has(n.id));
}

function getOutgoingEdges(nodeId: string, edges: FlowEdge[]): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

function chooseNextNode(
  node: FlowNode,
  edges: FlowEdge[],
  nodes: FlowNode[],
  replyText: string
): FlowNode | undefined {
  const outgoing = getOutgoingEdges(node.id, edges);
  if (outgoing.length === 0) return undefined;

  if (outgoing.length === 1) {
    return nodes.find((n) => n.id === outgoing[0].target);
  }

  const nodeType = node.data.nodeType;
  const trimmedReply = replyText.trim();

  if (nodeType === "menu") {
    const asNumber = parseInt(trimmedReply, 10);
    if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= outgoing.length) {
      return nodes.find((n) => n.id === outgoing[asNumber - 1].target);
    }
    const options = node.data.options ?? [];
    const matchIndex = options.findIndex(
      (opt) => opt.trim().toLowerCase() === trimmedReply.toLowerCase()
    );
    if (matchIndex !== -1 && outgoing[matchIndex]) {
      return nodes.find((n) => n.id === outgoing[matchIndex].target);
    }
    return nodes.find((n) => n.id === outgoing[0].target);
  }

  if (nodeType === "condition") {
    const conditionValue = (node.data.conditionValue ?? "").toLowerCase();
    const matches =
      conditionValue.length > 0 &&
      trimmedReply.toLowerCase().includes(conditionValue);
    const chosenEdge = matches ? outgoing[0] : outgoing[1] ?? outgoing[0];
    return nodes.find((n) => n.id === chosenEdge.target);
  }

  return nodes.find((n) => n.id === outgoing[0].target);
}

export async function tryHandleFlowMessage({
  orgId,
  fromPhone,
  text,
}: {
  orgId: string;
  fromPhone: string;
  text: string;
}): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("flow_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("contact_phone", fromPhone)
    .eq("status", "active")
    .maybeSingle();

  if (session) {
    const { data: flow } = await supabase
      .from("flows")
      .select("*")
      .eq("id", session.flow_id)
      .maybeSingle();

    if (!flow) return false;

    const nodes = (flow.nodes as FlowNode[]) ?? [];
    const edges = (flow.edges as FlowEdge[]) ?? [];
    const currentNode = nodes.find((n) => n.id === session.current_node_id);
    if (!currentNode) return false;

    const nextNode = chooseNextNode(currentNode, edges, nodes, text);

    if (!nextNode) {
      await supabase
        .from("flow_sessions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", session.id);
      return true;
    }

    if (nextNode.data.message) {
      await sendWhatsAppMessage(fromPhone, nextNode.data.message);
    }

    const newStatus = nextNode.data.nodeType === "handoff" ? "handoff" : "active";

    await supabase
      .from("flow_sessions")
      .update({
        current_node_id: nextNode.id,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    return true;
  }

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .eq("org_id", orgId);

  const matchedFlow = (flows ?? []).find((f) =>
    (f.trigger_keywords ?? []).some((kw: string) =>
      text.toLowerCase().includes(kw.toLowerCase())
    )
  );

  if (!matchedFlow) return false;

  const nodes = (matchedFlow.nodes as FlowNode[]) ?? [];
  const edges = (matchedFlow.edges as FlowEdge[]) ?? [];
  const startNode = findStartNode(nodes, edges);
  if (!startNode) return false;

  if (startNode.data.message) {
    await sendWhatsAppMessage(fromPhone, startNode.data.message);
  }

  await supabase.from("flow_sessions").upsert(
    {
      org_id: orgId,
      contact_phone: fromPhone,
      flow_id: matchedFlow.id,
      current_node_id: startNode.id,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,contact_phone,flow_id" }
  );

  return true;
}
