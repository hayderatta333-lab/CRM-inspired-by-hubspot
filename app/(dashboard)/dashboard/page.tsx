/**
 * app/(dashboard)/dashboard/page.tsx
 *
 * Fetches all four analytics datasets in parallel (getDashboardData)
 * plus the current user's open tasks, then renders metric tiles +
 * charts + leaderboard + tasks widget. Each dataset is checked for
 * `.success` independently so one failed query (e.g. an org with no
 * pipeline yet) doesn't blank the whole page.
 */

import { DollarSign, Percent, Timer, RefreshCw } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/actions/analytics";
import { listMyOpenTasks } from "@/lib/actions/activities";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { StageFunnelChart } from "@/components/dashboard/stage-funnel-chart";
import { RepLeaderboard } from "@/components/dashboard/rep-leaderboard";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  await requireOrgContext();

  const [{ metrics, funnel, forecast, reps }, tasksResult] = await Promise.all([
    getDashboardData(),
    listMyOpenTasks(8),
  ]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          {metrics.success
            ? `${metrics.data.periodStart} — ${metrics.data.periodEnd}`
            : "Last 30 days"}
        </p>
      </div>

      {metrics.success ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Open Pipeline"
            value={formatCurrency(metrics.data.totalPipelineValue)}
            icon={DollarSign}
            hint={`${metrics.data.openDealCount} open deals`}
          />
          <MetricCard
            label="Win Rate"
            value={`${metrics.data.winRate}%`}
            icon={Percent}
            hint={`${metrics.data.wonCount} won / ${metrics.data.lostCount} lost`}
            accent={metrics.data.winRate >= 50 ? "positive" : "negative"}
          />
          <MetricCard
            label="Deal Velocity"
            value={`${metrics.data.averageDealVelocityDays}d`}
            icon={Timer}
            hint="Avg. days to close (won)"
          />
          <MetricCard
            label="MRR"
            value={formatCurrency(metrics.data.monthlyRecurringRevenue)}
            icon={RefreshCw}
            hint={`Avg. deal size ${formatCurrency(metrics.data.averageDealSize)}`}
          />
        </div>
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {metrics.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {forecast.success ? (
          <ForecastChart data={forecast.data} />
        ) : (
          <ErrorPanel message={forecast.error} />
        )}
        {funnel.success ? <StageFunnelChart data={funnel.data} /> : <ErrorPanel message={funnel.error} />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {reps.success ? <RepLeaderboard reps={reps.data} /> : <ErrorPanel message={reps.error} />}
        </div>
        <div>
          {tasksResult.success ? (
            <MyTasks tasks={tasksResult.data} />
          ) : (
            <ErrorPanel message={tasksResult.error} />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
  );
}
