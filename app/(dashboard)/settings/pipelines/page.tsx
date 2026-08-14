import { requireRole } from "@/lib/auth/session";
import { listPipelines } from "@/lib/actions/pipelines";
import { PipelineStagesManager } from "@/components/settings/pipeline-stages-manager";

export default async function PipelinesSettingsPage() {
  await requireRole(["admin", "sales_manager"]);
  const result = await listPipelines();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Pipelines</h1>
        <p className="text-sm text-zinc-500">Configure stages for your sales pipeline</p>
      </div>

      {result.success ? (
        <div className="flex flex-col gap-6">
          {result.data.map((pipeline) => (
            <div key={pipeline.id}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">
                {pipeline.name}
                {pipeline.is_default && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    Default
                  </span>
                )}
              </h2>
              <PipelineStagesManager pipeline={pipeline} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}
    </div>
  );
}
