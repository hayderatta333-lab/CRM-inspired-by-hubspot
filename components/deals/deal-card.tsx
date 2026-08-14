"use client";

/**
 * components/deals/deal-card.tsx
 *
 * A single draggable deal. Design notes:
 *  - The 3px left rail picks up the parent stage's color (passed in),
 *    so a glance down the board reads as a color gradient from cool
 *    grey (early stage) to warm indigo/violet (later stage) — the
 *    color literally encodes proximity to close, not decoration.
 *  - Amount uses tabular-nums so a column of numbers lines up and is
 *    fast to scan, which matters more here than anywhere else in the
 *    app — this is the one place people are visually summing values.
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, CalendarClock, RefreshCw } from "lucide-react";
import { cn, formatCurrency, formatDate, initials } from "@/lib/utils";
import type { DealWithRelations } from "@/types/crm";

interface DealCardProps {
  deal: DealWithRelations;
  stageColor: string;
  isOverlay?: boolean;
  /** True while this exact card is the one being dragged — hides the origin copy so only the DragOverlay ghost shows. */
  isBeingDragged?: boolean;
}

export function DealCard({
  deal,
  stageColor,
  isOverlay = false,
  isBeingDragged = false,
}: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const isPastDue =
    deal.expected_close_date && new Date(deal.expected_close_date) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative rounded-lg border border-zinc-200 bg-white pl-3 pr-3 py-3 shadow-sm",
        "cursor-grab select-none touch-none active:cursor-grabbing",
        "hover:border-zinc-300 hover:shadow-md transition-shadow",
        isDragging && !isOverlay && "opacity-40",
        isBeingDragged && !isOverlay && "invisible",
        isOverlay && "shadow-lg ring-1 ring-black/5 rotate-1"
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-lg"
        style={{ backgroundColor: stageColor }}
      />

      <p className="text-sm font-medium text-zinc-900 leading-snug line-clamp-2">{deal.name}</p>

      {deal.company && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
          <Building2 className="size-3" aria-hidden />
          <span className="truncate">{deal.company.name}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-semibold text-zinc-900 tabular-nums text-sm">
          {formatCurrency(Number(deal.amount), deal.currency)}
        </span>
        {deal.is_recurring && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
            title={`Recurring: ${formatCurrency(Number(deal.recurring_amount ?? 0))} / ${deal.billing_frequency}`}
          >
            <RefreshCw className="size-2.5" aria-hidden />
            MRR
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        {deal.expected_close_date ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              isPastDue ? "text-red-600 font-medium" : "text-zinc-400"
            )}
          >
            <CalendarClock className="size-3" aria-hidden />
            {formatDate(deal.expected_close_date)}
          </span>
        ) : (
          <span />
        )}

        {deal.owner && (
          <span
            title={deal.owner.full_name ?? deal.owner.email}
            className="flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white"
          >
            {initials(deal.owner.full_name ?? deal.owner.email)}
          </span>
        )}
      </div>
    </div>
  );
}
