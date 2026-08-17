"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteFlow, type FlowListItem } from "@/lib/actions/flows";

export function FlowRow({ flow }: { flow: FlowListItem }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Delete "${flow.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      await deleteFlow(flow.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50">
      <a href={`/flows/${flow.id}`} className="flex-1">
        <div className="text-sm font-medium text-zinc-900">{flow.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
          <span
            className={`rounded-full px-2 py-0.5 ${
              flow.status === "published"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {flow.status}
          </span>
          <span>Updated {new Date(flow.updated_at).toLocaleDateString()}</span>
        </div>
      </a>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
