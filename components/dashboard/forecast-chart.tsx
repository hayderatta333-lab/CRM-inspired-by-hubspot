"use client";

/**
 * components/dashboard/forecast-chart.tsx
 *
 * Bars use the same color semantics as the Kanban board (green = won,
 * red = lost) so a rep who's seen the pipeline board reads this chart
 * without a new legend to learn. Committed (weighted open pipeline) is
 * a lighter indigo — the "not yet real" number.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ForecastPoint } from "@/types/crm";

interface ForecastChartProps {
  data: ForecastPoint[];
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

export function ForecastChart({ data }: ForecastChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    Committed: Math.round(d.committedValue),
    "Closed Won": Math.round(d.closedWonValue),
    "Closed Lost": Math.round(d.closedLostValue),
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Sales Forecast</h3>
      <p className="text-xs text-zinc-500">Weighted pipeline vs. actual closed deals, by month</p>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
              width={70}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ borderRadius: 8, borderColor: "#e4e4e7", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Committed" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Closed Won" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Closed Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
