import { getFlows } from "@/lib/actions/flows";
import { NewFlowButton } from "@/components/flows/new-flow-button";
import { FlowRow } from "@/components/flows/flow-row";

export default async function FlowsPage() {
  const result = await getFlows();
  const flows = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Flows</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Design WhatsApp bot conversations for your business.
          </p>
        </div>
        <NewFlowButton />
      </div>

      {!result.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {result.error}
        </div>
      )}

      {result.success && flows.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          No flows yet. Click "New Flow" to create your first one.
        </div>
      )}

      {result.success && flows.length > 0 && (
        <div className="space-y-2">
          {flows.map((flow) => (
            <FlowRow key={flow.id} flow={flow} />
          ))}
        </div>
      )}
    </div>
  );
}
