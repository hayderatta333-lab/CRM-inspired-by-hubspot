/**
 * components/dashboard/rep-leaderboard.tsx
 *
 * Server-renderable (no interactivity) — sorted server-side by
 * won_deal_value already (see fn_rep_performance), so this just renders
 * rows in the order the RPC returned them.
 */

import { formatCurrency, initials } from "@/lib/utils";
import type { RepPerformance } from "@/types/crm";

interface RepLeaderboardProps {
  reps: RepPerformance[];
}

export function RepLeaderboard({ reps }: RepLeaderboardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Rep Performance</h3>
      <p className="text-xs text-zinc-500">This period, by closed-won value</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
              <th className="py-2 font-medium">Rep</th>
              <th className="py-2 font-medium text-right">Won</th>
              <th className="py-2 font-medium text-right">Open Pipeline</th>
              <th className="py-2 font-medium text-right">Win Rate</th>
              <th className="py-2 font-medium text-right">Activities</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => (
              <tr key={rep.userId} className="border-b border-zinc-50 last:border-0">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white">
                      {initials(rep.fullName)}
                    </span>
                    <span className="text-zinc-800">{rep.fullName ?? "Unnamed"}</span>
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-zinc-900">
                  {formatCurrency(rep.wonDealValue)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-zinc-600">
                  {formatCurrency(rep.openDealValue)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-zinc-600">{rep.winRate}%</td>
                <td className="py-2.5 text-right tabular-nums text-zinc-600">{rep.activityCount}</td>
              </tr>
            ))}

            {reps.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-zinc-400">
                  No rep activity in this period yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
