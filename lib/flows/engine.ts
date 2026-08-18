import { createAdminClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

type FlowNodeType = "greeting" | "menu" | "booking" | "condition" | "handoff";

type FlowNode = {
  id: string;
  data: {
    nodeType: FlowNodeType;
    message: string;
    options?: string[];
    conditionField?: string;
    conditionValue?: string;
  };
};

type FlowEdge = { source: string; target: string };

function findStartNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode | null {
  if (nodes.length === 0) return null;
  const targets = new Set(edges.map((e) => e.target));
  return nodes.find((n) => !targets.has(n.id)) ?? nodes[0];
}

function findNextNode(
  nodes: FlowNode[],
  edges: FlowEdge[],
  currentId: string
): FlowNode | null {
  const edge = edges.find((e) => e.source === currentId);
  if (!edge) return null;
  return nodes.find((n) => n.id === edge.target) ?? null;
}

/**
 * Checks for an active flow session or a matching trigger keyword, and
 * advances/starts the flow if applicable. Returns true if it handled the
 * message (caller should skip the Gemini AI auto-reply), false otherwise.
 */
export async function tryHandleFlowMessage(params: {
  orgId: string;
  fromPhone: string;
  text: string;
}): Promise<boolean> {
  const { orgId, fromPhone, text } = params;
  const supabase = await createAdminClient();

  // 1. Is there an active flow session for this contact?
  const { data: session } = await supabase
    .from("flow_sessions")
    .select("id, flow_id, current_node_id")
    .eq("org_id", orgId)
    .eq("contact_phone", fromPhone)
    .eq("status", "active")
    .maybeSingle();

  if (session) {
    const { data: flow } = await supabase
      .from("flows")
      .select("nodes, edges")
      .eq("id", session.flow_id)
      .single();

    if (!flow) return false;

    const nodes = (flow.nodes as FlowNode[]) ?? [];
    const edges = (flow.edges as FlowEdge[]) ?? [];
    const nextNode = findNextNode(nodes, edges, session.current_node_id ?? "");

    if (!nextNode) {
      await supabase
        .from("flow_sessions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", session.id);
      return false;
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

  // 2. No active session — does this message match a flow's trigger keyword?
  const { data: flows } = await supabase
    .from("flows")
    .select("id, nodes, edges, trigger_keywords")
    .eq("org_id", orgId)
    .not("trigger_keywords", "is", null);

  const lowerText = text.toLowerCase();
  const matchedFlow = (flows ?? []).find((f) =>
    (f.trigger_keywords ?? []).some(
      (kw: string) => kw && lowerText.includes(kw.toLowerCase())
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
