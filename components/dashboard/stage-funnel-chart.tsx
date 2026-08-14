"use client";

/**
 * components/dashboard/stage-funnel-chart.tsx
 *
 * Horizontal bars ordered by pipeline position, each labeled with both
 * deal count and value — a funnel is fundamentally about the drop-off
 * between stages, which reads more naturally top-to-bottom than as a
 * vertical column chart.
 */

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { StageFunnelPoint } from "@/types/crm";

const FUNNEL_COLORS = ["#94a3b8", "#60a5fa", "#818cf8", "#c084fc", "#22c55e", "#ef4444"];

interface StageFunnelChartProps {
  data: StageFunnelPoint[];
}

export function StageFunnelChart({ data }: StageFunnelChartProps) {
  const chartData = data.map((d) => ({
    name: d.stageName,
    value: d.totalValue,
    count: d.dealCount,
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Pipeline Funnel</h3>
      <p className="text-xs text-zinc-500">Deal value by stage</p>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#3f3f46" }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              formatter={(value: number, _key, item) => [
                `${formatCurrency(value)} · ${item.payload.count} deal(s)`,
                "Value",
              ]}
              contentStyle={{ borderRadius: 8, borderColor: "#e4e4e7", fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
