"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, AlertCircle, GripVertical } from "lucide-react";
import { createStage, deleteStage, reorderStages } from "@/lib/actions/pipelines";
import type { PipelineWithStages } from "@/lib/actions/pipelines";

const DEFAULT_COLOR = "#6366f1";

export function PipelineStagesManager({ pipeline }: { pipeline: PipelineWithStages }) {
  const [stages, setStages] = useState(pipeline.stages);
  const [newStageName, setNewStageName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddStage() {
    if (!newStageName.trim()) return;
    startTransition(async () => {
      const result = await createStage({
        pipeline_id: pipeline.id,
        name: newStageName.trim(),
        probability: 0,
        is_won_stage: false,
        is_lost_stage: false,
        color: DEFAULT_COLOR,
      });
      if (result.success) {
        setStages((prev) => [...prev, result.data]);
        setNewStageName("");
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;

    const reordered = [...stages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setStages(reordered);

    startTransition(async () => {
      const result = await reorderStages({
        pipelineId: pipeline.id,
        orderedStageIds: reordered.map((s) => s.id),
      });
      if (!result.success) {
        setStages(stages); // revert
        setError(result.error);
      }
    });
  }

  async function handleDelete(stageId: string) {
    if (!confirm("Delete this stage? Deals must be moved out first.")) return;
    const result = await deleteStage(stageId);
    if (result.success) {
      setStages((prev) => prev.filter((s) => s.id !== stageId));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-50">
          {stages.map((stage, index) => (
            <li key={stage.id} className="flex items-center gap-3 px-3 py-2.5">
              <GripVertical className="size-4 text-zinc-300" />
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
                aria-hidden
              />
              <span className="flex-1 text-sm text-zinc-800">{stage.name}</span>
              {stage.is_won_stage && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Won
                </span>
              )}
              {stage.is_lost_stage && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  Lost
                </span>
              )}
              <span className="w-12 text-right text-xs tabular-nums text-zinc-400">{stage.probability}%</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0 || isPending}
                  onClick={() => move(index, -1)}
                  className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === stages.length - 1 || isPending}
                  onClick={() => move(index, 1)}
                  className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(stage.id)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete stage"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}

          {stages.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-zinc-400">No stages yet.</li>
          )}
        </ul>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          placeholder="New stage name"
          className="w-64 rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAddStage}
          disabled={isPending || !newStageName.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add stage
        </button>
      </div>
    </div>
  );
}
