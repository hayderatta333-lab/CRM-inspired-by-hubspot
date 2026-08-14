/**
 * components/dashboard/metric-card.tsx
 *
 * Plain Server-renderable component (no client interactivity needed).
 * Numbers are the whole point of this tile, so the value is set in
 * tabular-nums at a size that dominates the card — everything else
 * (label, trend) is deliberately quieter.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: "neutral" | "positive" | "negative";
}

export function MetricCard({ label, value, icon: Icon, hint, accent = "neutral" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <Icon className="size-4 text-zinc-400" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs",
            accent === "positive" && "text-emerald-600",
            accent === "negative" && "text-red-600",
            accent === "neutral" && "text-zinc-500"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
