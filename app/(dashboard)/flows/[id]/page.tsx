import { notFound } from "next/navigation";
import { getFlow } from "@/lib/actions/flows";
import { FlowCanvas } from "@/components/flows/flow-canvas";
import type { Node, Edge } from "@xyflow/react";

export default async function FlowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getFlow(id);

  if (!result.success) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">
          {result.data.name}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Status: {result.data.status}
        </p>
      </div>
      <FlowCanvas
        flowId={result.data.id}
        initialNodes={result.data.nodes as Node[]}
        initialEdges={result.data.edges as Edge[]}
      />
    </div>
  );
}
