"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createFlow } from "@/lib/actions/flows";

export function NewFlowButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createFlow({ name: name.trim() });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        <Plus className="h-4 w-4" />
        New Flow
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="Flow name"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      <button
        onClick={handleCreate}
        disabled={isPending || !name.trim()}
        className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create"}
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700"
      >
        Cancel
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
