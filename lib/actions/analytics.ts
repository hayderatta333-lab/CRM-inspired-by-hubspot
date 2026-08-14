"use server";

/**
 * lib/actions/analytics.ts
 *
 * Thin wrappers around the RPC functions in
 * supabase/analytics_functions.sql. The aggregation happens in
 * Postgres (indexed, single round trip) rather than by pulling raw
 * deal/activity rows into Node and reducing them here — that stays
 * fast regardless of how many thousands of deals an org accumulates.
 */

import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import { getDefaultPipeline } from "@/lib/actions/pipelines";
import type { DashboardMetrics, StageFunnelPoint, ForecastPoint, RepPerformance } from "@/types/crm";

export interface DateRange {
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
}

/** Defaults to the last 30 days when no range is supplied. */
function resolveDefaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export async function getDashboardMetrics(
  range?: DateRange
): Promise<ActionResult<DashboardMetrics>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();
    const { periodStart, periodEnd } = range ?? resolveDefaultRange();

    const { data, error } = await supabase
      .rpc("fn_dashboard_metrics", {
        p_org_id: ctx.orgId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      })
      .single();

    if (error) throw error;
    if (!data) return fail("No metrics available.");

    const row = data as {
      total_pipeline_value: number;
      open_deal_count: number;
      win_rate: number;
      won_count: number;
      lost_count: number;
      average_deal_velocity_days: number;
      monthly_recurring_revenue: number;
      average_deal_size: number;
    };

    return ok<DashboardMetrics>({
      totalPipelineValue: Number(row.total_pipeline_value),
      openDealCount: row.open_deal_count,
      winRate: Number(row.win_rate),
      wonCount: row.won_count,
      lostCount: row.lost_count,
      averageDealVelocityDays: Number(row.average_deal_velocity_days),
      monthlyRecurringRevenue: Number(row.monthly_recurring_revenue),
      averageDealSize: Number(row.average_deal_size),
      periodStart,
      periodEnd,
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function getStageFunnel(pipelineId?: string): Promise<ActionResult<StageFunnelPoint[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    let resolvedPipelineId = pipelineId;
    if (!resolvedPipelineId) {
      const defaultPipeline = await getDefaultPipeline();
      if (!defaultPipeline.success) return defaultPipeline;
      resolvedPipelineId = defaultPipeline.data.id;
    }

    const { data, error } = await supabase.rpc("fn_stage_funnel", {
      p_org_id: ctx.orgId,
      p_pipeline_id: resolvedPipelineId,
    });

    if (error) throw error;

    const points: StageFunnelPoint[] = (data ?? []).map((row: any) => ({
      stageId: row.stage_id,
      stageName: row.stage_name,
      dealCount: row.deal_count,
      totalValue: Number(row.total_value),
      probability: Number(row.probability),
    }));

    return ok(points);
  } catch (err) {
    return toActionError(err);
  }
}

export async function getDealForecast(
  monthsBack = 5,
  monthsForward = 3
): Promise<ActionResult<ForecastPoint[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("fn_deal_forecast", {
      p_org_id: ctx.orgId,
      p_months_back: monthsBack,
      p_months_forward: monthsForward,
    });

    if (error) throw error;

    const points: ForecastPoint[] = (data ?? []).map((row: any) => ({
      month: String(row.month).slice(0, 7), // yyyy-mm
      committedValue: Number(row.committed_value),
      closedWonValue: Number(row.closed_won_value),
      closedLostValue: Number(row.closed_lost_value),
    }));

    return ok(points);
  } catch (err) {
    return toActionError(err);
  }
}

export async function getRepPerformance(range?: DateRange): Promise<ActionResult<RepPerformance[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();
    const { periodStart, periodEnd } = range ?? resolveDefaultRange();

    const { data, error } = await supabase.rpc("fn_rep_performance", {
      p_org_id: ctx.orgId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (error) throw error;

    const rows: RepPerformance[] = (data ?? []).map((row: any) => ({
      userId: row.user_id,
      fullName: row.full_name,
      openDealValue: Number(row.open_deal_value),
      wonDealValue: Number(row.won_deal_value),
      wonCount: row.won_count,
      lostCount: row.lost_count,
      winRate: Number(row.win_rate),
      activityCount: row.activity_count,
    }));

    return ok(rows);
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Convenience aggregate for the dashboard page — fetches all four
 * datasets in parallel with Promise.all, since none depend on each
 * other, rather than the page awaiting them one at a time.
 */
export async function getDashboardData(range?: DateRange) {
  const [metrics, funnel, forecast, reps] = await Promise.all([
    getDashboardMetrics(range),
    getStageFunnel(),
    getDealForecast(),
    getRepPerformance(range),
  ]);

  return { metrics, funnel, forecast, reps };
}
