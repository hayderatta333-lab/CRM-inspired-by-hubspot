"use client";

/**
 * components/shared/activity-timeline.tsx
 *
 * Renders a TimelineEntry[] (already normalized by getTimeline() in
 * lib/actions/activities.ts) plus a minimal "quick note" composer.
 * Full activity logging (calls, meetings, tasks with due dates) gets a
 * richer composer in a later pass — this covers the 80% case of
 * "leave a note while looking at the record" without blocking Step 5.
 */

import { useState, useTransition } from "react";
import { FileText, Phone, Mail, Calendar, CheckSquare, AlertCircle } from "lucide-react";
import { createActivity } from "@/lib/actions/activities";
import { formatDate } from "@/lib/utils";
import type { TimelineEntry, ActivityType } from "@/types/crm";

const TYPE_ICON: Record<ActivityType, typeof FileText> = {
  note: FileText,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
};

interface ActivityTimelineProps {
  parent: "contact" | "company" | "deal";
  parentId: string;
  initialEntries: TimelineEntry[];
}

export function ActivityTimeline({ parent, parentId, initialEntries }: ActivityTimelineProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      const parentField =
        parent === "contact"
          ? { contact_id: parentId }
          : parent === "company"
            ? { company_id: parentId }
            : { deal_id: parentId };

      const result = await createActivity({
        type: "note",
        subject: note.trim().slice(0, 80),
        body: note.trim(),
        status: "completed",
        priority: "medium",
        ...parentField,
      });

      if (result.success) {
        setEntries((prev) => [
          {
            id: result.data.id,
            type: result.data.type,
            subject: result.data.subject,
            body: result.data.body,
            status: result.data.status,
            occurredAt: result.data.completed_at ?? result.data.created_at,
            actor: result.data.created_by_user,
            raw: result.data,
          },
          ...prev,
        ]);
        setNote("");
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note…"
          rows={2}
          className="w-full resize-none border-0 p-0 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleAddNote}
            disabled={isPending || !note.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {entries.map((entry) => {
          const Icon = TYPE_ICON[entry.type];
          return (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-900">{entry.subject}</p>
                  <span className="shrink-0 text-xs text-zinc-400">{formatDate(entry.occurredAt)}</span>
                </div>
                {entry.body && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{entry.body}</p>}
                {entry.actor && (
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {entry.actor.full_name ?? entry.actor.email}
                  </p>
                )}
              </div>
            </li>
          );
        })}

        {entries.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-400">No activity logged yet.</li>
        )}
      </ol>
    </div>
  );
}
