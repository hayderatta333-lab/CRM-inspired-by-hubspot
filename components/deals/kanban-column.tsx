"use client";

/**
 * components/deals/kanban-column.tsx
 *
 * One pipeline stage. The header's probability bar is a thin fill
 * behind the deal count — a quiet, functional readout of "how likely
 * deals in this column are to close", derived straight from the
 * stage's configured probability rather than decoration.
 */

import { useDroppable } from "@dnd-kit/core";
import { cn, formatCurrency } from "@/lib/utils";
import { DealCard } from "@/components/deals/deal-card";
import type { KanbanColumn as KanbanColumnData } from "@/types/crm";

interface KanbanColumnProps {
  column: KanbanColumnData;
  activeDealId: string | null;
}

export function KanbanColumn({ column, activeDealId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.stage.id,
    data: { stageId: column.stage.id },
  });

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      <div
        className="relative overflow-hidden rounded-t-lg border border-b-0 border-zinc-200 bg-white px-3 py-2.5"
        style={{ borderTopColor: column.stage.color, borderTopWidth: 3 }}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 opacity-[0.06]"
          style={{
            width: `${column.stage.probability}%`,
            backgroundColor: column.stage.color,
          }}
        />
        <div className="relative flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">{column.stage.name}</h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 tabular-nums">
            {column.dealCount}
          </span>
        </div>
        <p className="relative mt-0.5 text-xs text-zinc-500 tabular-nums">
          {formatCurrency(column.totalValue)}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 rounded-b-lg border border-t-0 border-zinc-200 bg-zinc-50/60 p-2",
          "max-h-[calc(100vh-260px)] overflow-y-auto",
          isOver && "bg-zinc-100 ring-2 ring-inset ring-zinc-300"
        )}
      >
        {column.deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={column.stage.color}
            isBeingDragged={deal.id === activeDealId}
          />
        ))}

        {column.deals.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-400">No deals in this stage</p>
        )}
      </div>
    </div>
  );
}
