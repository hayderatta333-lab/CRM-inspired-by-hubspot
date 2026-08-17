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
      ? initialNodes
      : [
          {
            id: "start",
            position: { x: 250, y: 100 },
            data: { label: "Greeting" },
          },
        ]
  );
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge(connection, eds)),
    []
  );

  function handleSave() {
    startTransition(async () => {
      const result = await updateFlowData({ flowId, nodes, edges });
      if (result.success) {
        setSavedAt(new Date().toLocaleTimeString());
      }
    });
  }

  function handleAddNode() {
    const id = `node-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 150 + nds.length * 40, y: 250 + nds.length * 40 },
        data: { label: "New Step" },
      },
    ]);
  }

  return (
    <div className="flex h-[80vh] flex-col">
      <div className="mb-3 flex items-center gap-2">
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
      <div className="flex-1 rounded-lg border border-zinc-200">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
