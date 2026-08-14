"use client";

/**
 * components/dashboard/my-tasks.tsx
 *
 * The one interactive widget on the dashboard — checking off a task
 * updates optimistically since acknowledging "done" should feel
 * instant, then calls completeActivity() and reverts on failure.
 */

import { useState, useTransition } from "react";
import { Check, CircleAlert } from "lucide-react";
import { completeActivity } from "@/lib/actions/activities";
import { cn, formatDate } from "@/lib/utils";
import type { ActivityWithRelations } from "@/types/crm";

interface MyTasksProps {
  tasks: ActivityWithRelations[];
}

export function MyTasks({ tasks: initialTasks }: MyTasksProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [, startTransition] = useTransition();

  function handleComplete(id: string) {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const result = await completeActivity({ id });
      if (!result.success) setTasks(previous);
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">My Tasks</h3>
      <p className="text-xs text-zinc-500">Open tasks assigned to you</p>

      <ul className="mt-3 flex flex-col gap-1">
        {tasks.map((task) => {
          const isPastDue = task.due_at && new Date(task.due_at) < new Date();
          const parentLabel =
            task.deal?.name ?? task.company?.name ?? [task.contact?.first_name, task.contact?.last_name].filter(Boolean).join(" ");

          return (
            <li key={task.id} className="flex items-start gap-2.5 rounded-md px-1.5 py-2 hover:bg-zinc-50">
              <button
                type="button"
                onClick={() => handleComplete(task.id)}
                aria-label={`Mark "${task.subject}" complete`}
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500"
              >
                <Check className="size-3" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-800">{task.subject}</p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  {parentLabel && <span className="truncate">{parentLabel}</span>}
                  {task.due_at && (
                    <span className={cn("flex items-center gap-1", isPastDue && "text-red-600")}>
                      {isPastDue && <CircleAlert className="size-3" aria-hidden />}
                      {formatDate(task.due_at)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}

        {tasks.length === 0 && <li className="px-1.5 py-6 text-center text-xs text-zinc-400">You're all caught up.</li>}
      </ul>
    </div>
  );
}
