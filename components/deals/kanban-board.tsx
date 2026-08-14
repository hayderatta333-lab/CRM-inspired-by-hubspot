"use client";

/**
 * components/deals/kanban-board.tsx
 *
 * Owns the board's client-side state so drag-and-drop feels instant:
 * on drop, the deal is optimistically moved to the target column
 * immediately, then moveDealStage() is called; on failure the board
 * reverts and surfaces the error. This is the one place in the app
 * that intentionally diverges from "Server Action, then re-render" —
 * a Kanban board that waits for a round trip before showing the card
 * in its new column reads as broken, not careful.
 */

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertCircle } from "lucide-react";
import { KanbanColumn } from "@/components/deals/kanban-column";
import { DealCard } from "@/components/deals/deal-card";
import { moveDealStage } from "@/lib/actions/deals";
import { formatCurrency } from "@/lib/utils";
import type { PipelineBoard, DealWithRelations } from "@/types/crm";

interface KanbanBoardProps {
  initialBoard: PipelineBoard;
}

export function KanbanBoard({ initialBoard }: KanbanBoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const stageColorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of board.columns) map.set(col.stage.id, col.stage.color);
    return map;
  }, [board.columns]);

  function handleDragStart(event: DragStartEvent) {
    setError(null);
    const deal = event.active.data.current?.deal as DealWithRelations | undefined;
    if (deal) setActiveDeal(deal);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const dealId = active.id as string;
    const targetStageId = over.id as string;

    const sourceColumn = board.columns.find((c) => c.deals.some((d) => d.id === dealId));
    const deal = sourceColumn?.deals.find((d) => d.id === dealId);
    if (!deal || !sourceColumn || sourceColumn.stage.id === targetStageId) return;

    const targetColumn = board.columns.find((c) => c.stage.id === targetStageId);
    if (!targetColumn) return;

    const previousBoard = board;

    // Optimistic move
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => {
        if (col.stage.id === sourceColumn.stage.id) {
          const deals = col.deals.filter((d) => d.id !== dealId);
          return { ...col, deals, dealCount: deals.length, totalValue: sumAmounts(deals) };
        }
        if (col.stage.id === targetStageId) {
          const movedDeal = { ...deal, stage_id: targetStageId, stage: targetColumn.stage };
          const deals = [movedDeal, ...col.deals];
          return { ...col, deals, dealCount: deals.length, totalValue: sumAmounts(deals) };
        }
        return col;
      }),
    }));

    startTransition(async () => {
      const result = await moveDealStage({ dealId, stageId: targetStageId });
      if (!result.success) {
        setBoard(previousBoard);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{board.pipeline.name}</h2>
          <p className="text-sm text-zinc-500 tabular-nums">
            {formatCurrency(board.totalPipelineValue)} across {board.columns.reduce((n, c) => n + c.dealCount, 0)} open deals
          </p>
        </div>
        {isPending && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.stage.id}
              column={column}
              activeDealId={activeDeal?.id ?? null}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal && (
            <DealCard
              deal={activeDeal}
              stageColor={stageColorById.get(activeDeal.stage_id) ?? "#6366f1"}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function sumAmounts(deals: DealWithRelations[]): number {
  return deals.reduce((sum, d) => sum + Number(d.amount), 0);
}
