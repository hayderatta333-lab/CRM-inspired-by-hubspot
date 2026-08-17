"use client";

import { useCallback, useState, useTransition } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { updateFlowData } from "@/lib/actions/flows";

type NodeType = "greeting" | "menu" | "booking" | "condition" | "handoff";

const NODE_TYPE_META: Record<NodeType, { label: string; color: string }> = {
  greeting: { label: "Greeting", color: "#059669" },
  menu: { label: "Menu", color: "#2563eb" },
  booking: { label: "Booking", color: "#7c3aed" },
  condition: { label: "Condition", color: "#d97706" },
  handoff: { label: "Human Handoff", color: "#dc2626" },
};

type NodeData = {
  nodeType: NodeType;
  message: string;
  options: string[];
  conditionField: string;
  conditionValue: string;
};

function renderLabel(data: NodeData) {
  const meta = NODE_TYPE_META[data.nodeType];
  return (
    <div className="text-left">
      <div
        className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: meta.color }}
      >
        {meta.label}
      </div>
      <div className="line-clamp-2 text-xs text-zinc-700">
        {data.message || "(no message yet — tap to edit)"}
      </div>
    </div>
  );
}

function makeNode(id: string, nodeType: NodeType, x: number, y: number): Node {
  const data: NodeData = {
    nodeType,
    message: "",
    options: [],
    conditionField: "",
    conditionValue: "",
  };
  return { id, position: { x, y }, data: { ...data, label: renderLabel(data) } };
}

function normalizeIncoming(n: Node): Node {
  const raw = n.data as Record<string, unknown>;
  const data: NodeData = {
    nodeType: (raw.nodeType as NodeType) ?? "greeting",
    message:
      (raw.message as string) ??
      (typeof raw.label === "string" ? (raw.label as string) : ""),
    options: (raw.options as string[]) ?? [],
    conditionField: (raw.conditionField as string) ?? "",
    conditionValue: (raw.conditionValue as string) ?? "",
  };
  return { ...n, data: { ...data, label: renderLabel(data) } };
}

export function FlowCanvas({
  flowId,
  initialNodes,
  initialEdges,
}: {
  flowId: string;
  initialNodes: Node[];
  initialEdges: Edge[];
}) {
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes.length > 0
      ? initialNodes.map(normalizeIncoming)
      : [makeNode("start", "greeting", 250, 100)]
  );
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<NodeType>("greeting");

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  function handleAddNode() {
    const id = `node-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      makeNode(id, newNodeType, 150 + nds.length * 40, 250 + nds.length * 40),
    ]);
  }

  function updateSelectedData(patch: Partial<NodeData>) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedId) return n;
        const newData = { ...(n.data as unknown as NodeData), ...patch };
        return { ...n, data: { ...newData, label: renderLabel(newData) } };
      })
    );
  }

  function handleDeleteSelected() {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedId && e.target !== selectedId)
    );
    setSelectedId(null);
  }

  function handleSave() {
    startTransition(async () => {
      const cleanNodes = nodes.map((n) => {
        const data = n.data as unknown as NodeData;
        const { nodeType, message, options, conditionField, conditionValue } =
          data;
        return {
          ...n,
          data: { nodeType, message, options, conditionField, conditionValue },
        };
      });
      const result = await updateFlowData({ flowId, nodes: cleanNodes, edges });
      if (result.success) setSavedAt(new Date().toLocaleTimeString());
    });
  }

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedData = selectedNode?.data as unknown as NodeData | undefined;

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={newNodeType}
          onChange={(e) => setNewNodeType(e.target.value as NodeType)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {Object.entries(NODE_TYPE_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddNode}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Add Node
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {savedAt && (
          <span className="text-xs text-zinc-500">Saved at {savedAt}</span>
        )}
      </div>

      {selectedNode && selectedData && (
        <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900">
              Edit {NODE_TYPE_META[selectedData.nodeType].label}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteSelected}
                className="text-xs text-red-600 hover:underline"
              >
                Delete node
              </button>
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-zinc-500 hover:underline"
              >
                Close
              </button>
            </div>
          </div>

          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Message text
          </label>
          <textarea
            value={selectedData.message}
            onChange={(e) => updateSelectedData({ message: e.target.value })}
            rows={3}
            className="mb-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            placeholder="What should the bot say here?"
          />

          {selectedData.nodeType === "menu" && (
            <>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Menu options (one per line)
              </label>
              <textarea
                value={selectedData.options.join("\n")}
                onChange={(e) =>
                  updateSelectedData({ options: e.target.value.split("\n") })
                }
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                placeholder={"Book Appointment\nTalk to Human"}
              />
            </>
          )}

          {selectedData.nodeType === "condition" && (
            <div className="flex gap-2">
              <input
                value={selectedData.conditionField}
                onChange={(e) =>
                  updateSelectedData({ conditionField: e.target.value })
                }
                placeholder="Field (e.g. reply)"
                className="w-1/2 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                value={selectedData.conditionValue}
                onChange={(e) =>
                  updateSelectedData({ conditionValue: e.target.value })
                }
                placeholder="Expected value"
                className="w-1/2 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      )}

      <div className="h-[65vh] rounded-lg border border-zinc-200">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
