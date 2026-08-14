-- =====================================================================================
-- ANALYTICS RPC FUNCTIONS
-- Run this after schema.sql. Each function is SECURITY INVOKER (the
-- default) — it runs as the calling user, so the underlying RLS
-- policies on deals/activities/pipeline_stages still apply. The
-- explicit p_org_id check below is a fast-fail guard (a friendly error
-- instead of an empty/confusing result set), not the real boundary.
--
-- Doing these as set-returning SQL functions rather than fetching raw
-- rows into the Next.js server and aggregating in JS keeps the
-- aggregation where the indexes are, and keeps the payload small
-- regardless of how many thousands of deals an org has.
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- 1. Headline dashboard metrics for a date range
-- ---------------------------------------------------------------------------
create or replace function public.fn_dashboard_metrics(
  p_org_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  total_pipeline_value numeric,
  open_deal_count integer,
  win_rate numeric,
  won_count integer,
  lost_count integer,
  average_deal_velocity_days numeric,
  monthly_recurring_revenue numeric,
  average_deal_size numeric
)
language plpgsql
stable
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not authorized for this organization';
  end if;

  return query
  with open_deals as (
    select d.amount
    from public.deals d
    where d.org_id = p_org_id
      and d.status = 'open'
      and d.deleted_at is null
  ),
  closed_in_period as (
    select d.*
    from public.deals d
    where d.org_id = p_org_id
      and d.deleted_at is null
      and d.status in ('won', 'lost')
      and d.actual_close_date between p_period_start and p_period_end
  ),
  recurring_open_or_won as (
    select d.recurring_amount, d.billing_frequency
    from public.deals d
    where d.org_id = p_org_id
      and d.deleted_at is null
      and d.is_recurring = true
      and d.status in ('open', 'won')
  )
  select
    coalesce((select sum(amount) from open_deals), 0) as total_pipeline_value,
    (select count(*) from open_deals)::int as open_deal_count,
    case
      when (select count(*) from closed_in_period) = 0 then 0
      else round(
        100.0 * (select count(*) from closed_in_period where status = 'won')
        / (select count(*) from closed_in_period), 1
      )
    end as win_rate,
    (select count(*) from closed_in_period where status = 'won')::int as won_count,
    (select count(*) from closed_in_period where status = 'lost')::int as lost_count,
    coalesce((
      select round(avg(extract(epoch from (actual_close_date - created_at::date)) / 86400)::numeric, 1)
      from closed_in_period
      where status = 'won'
    ), 0) as average_deal_velocity_days,
    coalesce((
      select sum(
        case billing_frequency
          when 'monthly'   then recurring_amount
          when 'quarterly' then recurring_amount / 3.0
          when 'yearly'    then recurring_amount / 12.0
          else 0
        end
      )
      from recurring_open_or_won
    ), 0) as monthly_recurring_revenue,
    coalesce((
      select round(avg(amount), 2) from closed_in_period where status = 'won'
    ), 0) as average_deal_size;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Stage-by-stage funnel (all stages in a pipeline, including won/lost)
-- ---------------------------------------------------------------------------
create or replace function public.fn_stage_funnel(
  p_org_id uuid,
  p_pipeline_id uuid
)
returns table (
  stage_id uuid,
  stage_name text,
  position integer,
  deal_count integer,
  total_value numeric,
  probability numeric,
  is_won_stage boolean,
  is_lost_stage boolean
)
language plpgsql
stable
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not authorized for this organization';
  end if;

  return query
  select
    s.id as stage_id,
    s.name as stage_name,
    s.position,
    count(d.id)::int as deal_count,
    coalesce(sum(d.amount), 0) as total_value,
    s.probability,
    s.is_won_stage,
    s.is_lost_stage
  from public.pipeline_stages s
  left join public.deals d
    on d.stage_id = s.id
    and d.org_id = p_org_id
    and d.deleted_at is null
  where s.org_id = p_org_id
    and s.pipeline_id = p_pipeline_id
  group by s.id, s.name, s.position, s.probability, s.is_won_stage, s.is_lost_stage
  order by s.position asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Monthly forecast: committed (probability-weighted open pipeline by
--    expected close month) vs. actual closed-won/closed-lost by month.
-- ---------------------------------------------------------------------------
create or replace function public.fn_deal_forecast(
  p_org_id uuid,
  p_months_back integer default 5,
  p_months_forward integer default 3
)
returns table (
  month date,
  committed_value numeric,
  closed_won_value numeric,
  closed_lost_value numeric
)
language plpgsql
stable
as $$
declare
  v_range_start date := date_trunc('month', current_date)::date - (p_months_back || ' months')::interval;
  v_range_end date := date_trunc('month', current_date)::date + ((p_months_forward + 1) || ' months')::interval - interval '1 day';
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not authorized for this organization';
  end if;

  return query
  with months as (
    select generate_series(
      date_trunc('month', v_range_start),
      date_trunc('month', v_range_end),
      interval '1 month'
    )::date as month
  ),
  committed as (
    select
      date_trunc('month', d.expected_close_date)::date as month,
      sum(d.amount * (s.probability / 100.0)) as value
    from public.deals d
    join public.pipeline_stages s on s.id = d.stage_id
    where d.org_id = p_org_id
      and d.status = 'open'
      and d.deleted_at is null
      and d.expected_close_date is not null
      and d.expected_close_date between v_range_start and v_range_end
    group by 1
  ),
  closed as (
    select
      date_trunc('month', d.actual_close_date)::date as month,
      sum(d.amount) filter (where d.status = 'won') as won_value,
      sum(d.amount) filter (where d.status = 'lost') as lost_value
    from public.deals d
    where d.org_id = p_org_id
      and d.deleted_at is null
      and d.status in ('won', 'lost')
      and d.actual_close_date between v_range_start and v_range_end
    group by 1
  )
  select
    m.month,
    coalesce(c.value, 0) as committed_value,
    coalesce(cl.won_value, 0) as closed_won_value,
    coalesce(cl.lost_value, 0) as closed_lost_value
  from months m
  left join committed c on c.month = m.month
  left join closed cl on cl.month = m.month
  order by m.month asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Per-rep performance leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.fn_rep_performance(
  p_org_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  user_id uuid,
  full_name text,
  open_deal_value numeric,
  won_deal_value numeric,
  won_count integer,
  lost_count integer,
  win_rate numeric,
  activity_count integer
)
language plpgsql
stable
as $$
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not authorized for this organization';
  end if;

  return query
  with reps as (
    select m.user_id, p.full_name
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org_id
      and m.status = 'active'
  ),
  open_value as (
    select owner_id, sum(amount) as value
    from public.deals
    where org_id = p_org_id and status = 'open' and deleted_at is null
    group by owner_id
  ),
  closed as (
    select
      owner_id,
      sum(amount) filter (where status = 'won') as won_value,
      count(*) filter (where status = 'won') as won_count,
      count(*) filter (where status = 'lost') as lost_count
    from public.deals
    where org_id = p_org_id
      and deleted_at is null
      and status in ('won', 'lost')
      and actual_close_date between p_period_start and p_period_end
    group by owner_id
  ),
  activity_counts as (
    select owner_id, count(*) as cnt
    from public.activities
    where org_id = p_org_id
      and created_at::date between p_period_start and p_period_end
    group by owner_id
  )
  select
    reps.user_id,
    reps.full_name,
    coalesce(ov.value, 0) as open_deal_value,
    coalesce(c.won_value, 0) as won_deal_value,
    coalesce(c.won_count, 0)::int as won_count,
    coalesce(c.lost_count, 0)::int as lost_count,
    case
      when coalesce(c.won_count, 0) + coalesce(c.lost_count, 0) = 0 then 0
      else round(100.0 * c.won_count / (c.won_count + c.lost_count), 1)
    end as win_rate,
    coalesce(ac.cnt, 0)::int as activity_count
  from reps
  left join open_value ov on ov.owner_id = reps.user_id
  left join closed c on c.owner_id = reps.user_id
  left join activity_counts ac on ac.owner_id = reps.user_id
  order by won_deal_value desc nulls last;
end;
$$;

-- Grant execute to the standard Supabase roles that carry a user JWT.
grant execute on function public.fn_dashboard_metrics(uuid, date, date) to authenticated;
grant execute on function public.fn_stage_funnel(uuid, uuid) to authenticated;
grant execute on function public.fn_deal_forecast(uuid, integer, integer) to authenticated;
grant execute on function public.fn_rep_performance(uuid, date, date) to authenticated;
