/**
 * app/(dashboard)/deals/page.tsx
 *
 * Server Component: resolves org context, fetches the default pipeline
 * board, and hands it to the client-side KanbanBoard for drag-and-drop.
 * Won/lost deals are intentionally excluded from the board (see
 * getPipelineBoard in lib/actions/deals.ts) — a "Won/Lost" toggle or
 * list view for closed deals is a natural follow-up, not built here.
 */

import { requireOrgContext } from "@/lib/auth/session";
import { getPipelineBoard } from "@/lib/actions/deals";
import { KanbanBoard } from "@/components/deals/kanban-board";

export default async function DealsPage() {
  await requireOrgContext();

  const result = await getPipelineBoard();

  if (!result.success) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <KanbanBoard initialBoard={result.data} />
    </div>
  );
}
