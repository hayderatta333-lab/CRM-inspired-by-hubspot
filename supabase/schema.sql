-- =====================================================================================
-- CRM PLATFORM — CORE DATABASE SCHEMA
-- Target: Supabase (PostgreSQL 15+)
-- Includes: enums, tables, indexes, triggers, RLS policies, helper functions
-- Order matters — run top to bottom as a single migration.
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive email/domain matching

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('admin', 'sales_manager', 'sales_rep');
create type public.member_status as enum ('invited', 'active', 'suspended');

create type public.lifecycle_stage as enum (
  'subscriber', 'lead', 'marketing_qualified_lead', 'sales_qualified_lead',
  'opportunity', 'customer', 'evangelist', 'other'
);
create type public.lead_status as enum (
  'new', 'open', 'in_progress', 'connected', 'attempted_to_contact',
  'unqualified', 'bad_timing'
);

create type public.company_size as enum (
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'
);

create type public.deal_status as enum ('open', 'won', 'lost');
create type public.billing_frequency as enum ('one_time', 'monthly', 'quarterly', 'yearly');

create type public.activity_type as enum ('note', 'call', 'email', 'meeting', 'task');
create type public.activity_status as enum ('planned', 'completed', 'canceled');
create type public.call_outcome as enum (
  'connected', 'left_voicemail', 'no_answer', 'busy', 'wrong_number'
);
create type public.task_priority as enum ('low', 'medium', 'high');

create type public.custom_field_entity as enum ('contact', 'company', 'deal');
create type public.custom_field_type as enum (
  'text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url', 'email'
);

create type public.audit_action as enum ('insert', 'update', 'delete');

-- ---------------------------------------------------------------------------
-- 2. UTILITY FUNCTIONS (created early — used by triggers below)
-- ---------------------------------------------------------------------------

-- Keeps updated_at fresh on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Returns true if the current auth user is an active member of org_id.
-- SECURITY DEFINER + explicit search_path avoids RLS recursion on
-- organization_members itself and prevents search_path hijacking.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Returns the caller's role within org_id, or null if not a member.
create or replace function public.get_org_role(p_org_id uuid)
returns public.org_role
language sql
security definer
set search_path = public
stable
as $$
  select m.role
  from public.organization_members m
  where m.org_id = p_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- Convenience: true if caller is admin or sales_manager in org_id.
create or replace function public.is_org_manager(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_org_role(p_org_id) in ('admin', 'sales_manager');
$$;

-- ---------------------------------------------------------------------------
-- 3. ORGANIZATIONS & MEMBERSHIP
-- ---------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) > 0),
  slug        citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'),
  owner_id    uuid not null references auth.users(id) on delete restrict,
  logo_url    text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- Public-facing profile, 1:1 with auth.users. Populated by a trigger on signup
-- (see section 10) so the app never has to write directly to auth.users.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.org_role not null default 'sales_rep',
  status      public.member_status not null default 'active',
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (org_id, user_id)
);

create index idx_org_members_org on public.organization_members(org_id);
create index idx_org_members_user on public.organization_members(user_id);

create trigger trg_org_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. COMPANIES
-- ---------------------------------------------------------------------------

create table public.companies (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (char_length(trim(name)) > 0),
  domain            citext,
  industry          text,
  phone             text,
  website           text,
  size              public.company_size,
  annual_revenue    numeric(14,2) check (annual_revenue is null or annual_revenue >= 0),
  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  postal_code       text,
  country           text,
  description       text,
  owner_id          uuid references auth.users(id) on delete set null,
  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  deleted_at        timestamptz
);

create index idx_companies_org on public.companies(org_id) where deleted_at is null;
create index idx_companies_owner on public.companies(owner_id);
create index idx_companies_name_trgm on public.companies using gin (name gin_trgm_ops);
create index idx_companies_domain on public.companies(org_id, domain);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. CONTACTS
-- ---------------------------------------------------------------------------

create table public.contacts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  first_name        text not null check (char_length(trim(first_name)) > 0),
  last_name         text,
  email             citext,
  phone             text,
  job_title         text,
  company_id        uuid references public.companies(id) on delete set null,
  lifecycle_stage   public.lifecycle_stage not null default 'lead',
  lead_status       public.lead_status not null default 'new',
  source            text,
  linkedin_url      text,
  owner_id          uuid references auth.users(id) on delete set null,
  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  deleted_at        timestamptz,
  -- an email, if provided, must be unique per organization
  constraint uq_contacts_org_email unique (org_id, email)
);

create index idx_contacts_org on public.contacts(org_id) where deleted_at is null;
create index idx_contacts_owner on public.contacts(owner_id);
create index idx_contacts_company on public.contacts(company_id);
create index idx_contacts_name_trgm on public.contacts using gin ((first_name || ' ' || coalesce(last_name, '')) gin_trgm_ops);

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- Many-to-many association for contacts that legitimately belong to more
-- than one company (e.g. a consultant). company_id above remains the
-- "primary" company for fast lookups/joins; this table covers the rest.
create table public.contact_company_associations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        text,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (contact_id, company_id)
);

create index idx_cca_org on public.contact_company_associations(org_id);
create index idx_cca_contact on public.contact_company_associations(contact_id);
create index idx_cca_company on public.contact_company_associations(company_id);

-- ---------------------------------------------------------------------------
-- 6. PIPELINES, STAGES & DEALS
-- ---------------------------------------------------------------------------

create table public.pipelines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  is_default  boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create unique index uq_pipelines_one_default_per_org
  on public.pipelines(org_id) where is_default;

create index idx_pipelines_org on public.pipelines(org_id);

create trigger trg_pipelines_updated_at
  before update on public.pipelines
  for each row execute function public.set_updated_at();

create table public.pipeline_stages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  pipeline_id   uuid not null references public.pipelines(id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  position      integer not null default 0,
  probability   numeric(5,2) not null default 0 check (probability between 0 and 100),
  is_won_stage  boolean not null default false,
  is_lost_stage boolean not null default false,
  color         text not null default '#6366f1',
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  unique (pipeline_id, position)
);

create index idx_stages_org on public.pipeline_stages(org_id);
create index idx_stages_pipeline on public.pipeline_stages(pipeline_id);

create trigger trg_stages_updated_at
  before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  name                text not null check (char_length(trim(name)) > 0),
  pipeline_id         uuid not null references public.pipelines(id) on delete restrict,
  stage_id            uuid not null references public.pipeline_stages(id) on delete restrict,
  company_id          uuid references public.companies(id) on delete set null,
  primary_contact_id  uuid references public.contacts(id) on delete set null,
  amount              numeric(14,2) not null default 0 check (amount >= 0),
  currency            char(3) not null default 'USD',
  status              public.deal_status not null default 'open',
  is_recurring        boolean not null default false,
  recurring_amount    numeric(14,2) check (recurring_amount is null or recurring_amount >= 0),
  billing_frequency   public.billing_frequency not null default 'one_time',
  expected_close_date date,
  actual_close_date   date,
  lost_reason         text,
  owner_id            uuid references auth.users(id) on delete set null,
  created_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  deleted_at          timestamptz,
  constraint chk_recurring_amount check (
    (is_recurring = false) or (is_recurring = true and recurring_amount is not null)
  ),
  constraint chk_actual_close_matches_status check (
    (status = 'open' and actual_close_date is null)
    or (status in ('won', 'lost') and actual_close_date is not null)
  )
);

create index idx_deals_org on public.deals(org_id) where deleted_at is null;
create index idx_deals_pipeline on public.deals(pipeline_id);
create index idx_deals_stage on public.deals(stage_id);
create index idx_deals_owner on public.deals(owner_id);
create index idx_deals_company on public.deals(company_id);
create index idx_deals_status on public.deals(org_id, status);
create index idx_deals_close_date on public.deals(expected_close_date);

create trigger trg_deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- Deals commonly involve more than one stakeholder contact.
create table public.deal_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  deal_id     uuid not null references public.deals(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  role        text,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (deal_id, contact_id)
);

create index idx_deal_contacts_deal on public.deal_contacts(deal_id);
create index idx_deal_contacts_contact on public.deal_contacts(contact_id);

-- Auto-stamp actual_close_date when a deal moves into a won/lost stage,
-- and keep `status` in sync with the stage's won/lost flags.
create or replace function public.sync_deal_status_from_stage()
returns trigger
language plpgsql
as $$
declare
  v_is_won boolean;
  v_is_lost boolean;
begin
  select is_won_stage, is_lost_stage into v_is_won, v_is_lost
  from public.pipeline_stages
  where id = new.stage_id;

  if v_is_won then
    new.status := 'won';
    new.actual_close_date := coalesce(new.actual_close_date, current_date);
  elsif v_is_lost then
    new.status := 'lost';
    new.actual_close_date := coalesce(new.actual_close_date, current_date);
  else
    new.status := 'open';
    new.actual_close_date := null;
  end if;

  return new;
end;
$$;

create trigger trg_deals_sync_status
  before insert or update of stage_id on public.deals
  for each row execute function public.sync_deal_status_from_stage();

-- ---------------------------------------------------------------------------
-- 7. ACTIVITIES (notes, calls, emails, meetings, tasks)
-- Polymorphic association to contact / company / deal via nullable FKs,
-- enforced to reference at least one parent record.
-- ---------------------------------------------------------------------------

create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  type            public.activity_type not null,
  subject         text not null check (char_length(trim(subject)) > 0),
  body            text,
  status          public.activity_status not null default 'planned',

  -- polymorphic association — at least one required
  contact_id      uuid references public.contacts(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete cascade,
  deal_id         uuid references public.deals(id) on delete cascade,

  -- task-specific
  due_at          timestamptz,
  priority        public.task_priority not null default 'medium',

  -- call-specific
  call_outcome    public.call_outcome,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  -- meeting-specific
  starts_at       timestamptz,
  ends_at         timestamptz,
  location        text,

  completed_at    timestamptz,
  owner_id        uuid references auth.users(id) on delete set null,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),

  constraint chk_activity_has_parent check (
    contact_id is not null or company_id is not null or deal_id is not null
  ),
  constraint chk_meeting_times check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create index idx_activities_org on public.activities(org_id);
create index idx_activities_contact on public.activities(contact_id);
create index idx_activities_company on public.activities(company_id);
create index idx_activities_deal on public.activities(deal_id);
create index idx_activities_owner on public.activities(owner_id);
create index idx_activities_due on public.activities(due_at) where type = 'task' and status = 'planned';
create index idx_activities_type on public.activities(org_id, type);

create trigger trg_activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. CUSTOM FIELDS
-- ---------------------------------------------------------------------------

create table public.custom_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  entity_type   public.custom_field_entity not null,
  field_key     text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  label         text not null check (char_length(trim(label)) > 0),
  field_type    public.custom_field_type not null,
  options       jsonb,                    -- for select/multiselect: {"choices": ["a","b"]}
  is_required   boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  unique (org_id, entity_type, field_key)
);

create index idx_cfd_org on public.custom_field_definitions(org_id, entity_type);

create trigger trg_cfd_updated_at
  before update on public.custom_field_definitions
  for each row execute function public.set_updated_at();

create table public.custom_field_values (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  field_id          uuid not null references public.custom_field_definitions(id) on delete cascade,
  entity_type       public.custom_field_entity not null,
  entity_id         uuid not null,
  value             jsonb,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  unique (field_id, entity_id)
);

create index idx_cfv_org on public.custom_field_values(org_id);
create index idx_cfv_entity on public.custom_field_values(entity_type, entity_id);

create trigger trg_cfv_updated_at
  before update on public.custom_field_values
  for each row execute function public.set_updated_at();

-- Guard: the field_id's entity_type must match the row's entity_type.
create or replace function public.check_custom_field_entity_type()
returns trigger
language plpgsql
as $$
declare
  v_entity_type public.custom_field_entity;
begin
  select entity_type into v_entity_type
  from public.custom_field_definitions
  where id = new.field_id;

  if v_entity_type is distinct from new.entity_type then
    raise exception 'custom_field_values.entity_type (%) does not match field definition entity_type (%)',
      new.entity_type, v_entity_type;
  end if;

  return new;
end;
$$;

create trigger trg_cfv_check_entity_type
  before insert or update on public.custom_field_values
  for each row execute function public.check_custom_field_entity_type();

-- ---------------------------------------------------------------------------
-- 9. AUDIT LOGS
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  action      public.audit_action not null,
  entity_type text not null,
  entity_id   uuid not null,
  old_values  jsonb,
  new_values  jsonb,
  created_at  timestamptz not null default timezone('utc', now())
);

create index idx_audit_org on public.audit_logs(org_id);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_actor on public.audit_logs(actor_id);
create index idx_audit_created on public.audit_logs(created_at desc);

-- Generic audit trigger factory — attached per-table below.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := coalesce(new.org_id, old.org_id);

  insert into public.audit_logs (org_id, actor_id, action, entity_type, entity_id, old_values, new_values)
  values (
    v_org_id,
    auth.uid(),
    lower(tg_op)::public.audit_action,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.write_audit_log();

create trigger trg_audit_companies
  after insert or update or delete on public.companies
  for each row execute function public.write_audit_log();

create trigger trg_audit_deals
  after insert or update or delete on public.deals
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 10. AUTH TRIGGER — auto-create a profile row on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- pg_trgm is needed for the name search indexes above
create extension if not exists "pg_trgm";

-- =====================================================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_company_associations enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.deal_contacts enable row level security;
alter table public.activities enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.audit_logs enable row level security;

-- ---- organizations ----
create policy "org members can view their org"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "authenticated users can create an org"
  on public.organizations for insert
  with check (owner_id = auth.uid());

create policy "org admins can update their org"
  on public.organizations for update
  using (public.get_org_role(id) = 'admin')
  with check (public.get_org_role(id) = 'admin');

create policy "org admins can delete their org"
  on public.organizations for delete
  using (public.get_org_role(id) = 'admin');

-- ---- profiles ----
-- Profiles are readable by anyone who shares an org with the profile owner,
-- and always writable by the owner themself.
create policy "users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "org-mates can view each other's profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.organization_members m1
      join public.organization_members m2 on m1.org_id = m2.org_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- ---- organization_members ----
create policy "org members can view membership list"
  on public.organization_members for select
  using (public.is_org_member(org_id));

create policy "admins can add members"
  on public.organization_members for insert
  with check (public.get_org_role(org_id) = 'admin');

create policy "admins can update members"
  on public.organization_members for update
  using (public.get_org_role(org_id) = 'admin')
  with check (public.get_org_role(org_id) = 'admin');

create policy "admins can remove members"
  on public.organization_members for delete
  using (public.get_org_role(org_id) = 'admin');

-- ---- companies ----
create policy "org members can view companies"
  on public.companies for select
  using (public.is_org_member(org_id));

create policy "org members can create companies"
  on public.companies for insert
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "owners and managers can update companies"
  on public.companies for update
  using (public.is_org_member(org_id) and (owner_id = auth.uid() or public.is_org_manager(org_id)))
  with check (public.is_org_member(org_id));

create policy "managers can delete companies"
  on public.companies for delete
  using (public.is_org_manager(org_id));

-- ---- contacts ----
create policy "org members can view contacts"
  on public.contacts for select
  using (public.is_org_member(org_id));

create policy "org members can create contacts"
  on public.contacts for insert
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "owners and managers can update contacts"
  on public.contacts for update
  using (public.is_org_member(org_id) and (owner_id = auth.uid() or public.is_org_manager(org_id)))
  with check (public.is_org_member(org_id));

create policy "managers can delete contacts"
  on public.contacts for delete
  using (public.is_org_manager(org_id));

-- ---- contact_company_associations ----
create policy "org members can view associations"
  on public.contact_company_associations for select
  using (public.is_org_member(org_id));

create policy "org members can manage associations"
  on public.contact_company_associations for insert
  with check (public.is_org_member(org_id));

create policy "org members can delete associations"
  on public.contact_company_associations for delete
  using (public.is_org_member(org_id));

-- ---- pipelines & stages (config data — managers/admins only for writes) ----
create policy "org members can view pipelines"
  on public.pipelines for select
  using (public.is_org_member(org_id));

create policy "managers can manage pipelines"
  on public.pipelines for insert
  with check (public.is_org_manager(org_id));

create policy "managers can update pipelines"
  on public.pipelines for update
  using (public.is_org_manager(org_id))
  with check (public.is_org_manager(org_id));

create policy "managers can delete pipelines"
  on public.pipelines for delete
  using (public.is_org_manager(org_id));

create policy "org members can view stages"
  on public.pipeline_stages for select
  using (public.is_org_member(org_id));

create policy "managers can insert stages"
  on public.pipeline_stages for insert
  with check (public.is_org_manager(org_id));

create policy "managers can update stages"
  on public.pipeline_stages for update
  using (public.is_org_manager(org_id))
  with check (public.is_org_manager(org_id));

create policy "managers can delete stages"
  on public.pipeline_stages for delete
  using (public.is_org_manager(org_id));

-- ---- deals ----
create policy "org members can view deals"
  on public.deals for select
  using (public.is_org_member(org_id));

create policy "org members can create deals"
  on public.deals for insert
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "owners and managers can update deals"
  on public.deals for update
  using (public.is_org_member(org_id) and (owner_id = auth.uid() or public.is_org_manager(org_id)))
  with check (public.is_org_member(org_id));

create policy "managers can delete deals"
  on public.deals for delete
  using (public.is_org_manager(org_id));

-- ---- deal_contacts ----
create policy "org members can view deal contacts"
  on public.deal_contacts for select
  using (public.is_org_member(org_id));

create policy "org members can manage deal contacts"
  on public.deal_contacts for insert
  with check (public.is_org_member(org_id));

create policy "org members can remove deal contacts"
  on public.deal_contacts for delete
  using (public.is_org_member(org_id));

-- ---- activities ----
create policy "org members can view activities"
  on public.activities for select
  using (public.is_org_member(org_id));

create policy "org members can create activities"
  on public.activities for insert
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "owners and managers can update activities"
  on public.activities for update
  using (public.is_org_member(org_id) and (owner_id = auth.uid() or created_by = auth.uid() or public.is_org_manager(org_id)))
  with check (public.is_org_member(org_id));

create policy "owners and managers can delete activities"
  on public.activities for delete
  using (public.is_org_member(org_id) and (owner_id = auth.uid() or created_by = auth.uid() or public.is_org_manager(org_id)));

-- ---- custom field definitions (schema config — managers/admins only) ----
create policy "org members can view custom field defs"
  on public.custom_field_definitions for select
  using (public.is_org_member(org_id));

create policy "managers can manage custom field defs"
  on public.custom_field_definitions for insert
  with check (public.is_org_manager(org_id));

create policy "managers can update custom field defs"
  on public.custom_field_definitions for update
  using (public.is_org_manager(org_id))
  with check (public.is_org_manager(org_id));

create policy "managers can delete custom field defs"
  on public.custom_field_definitions for delete
  using (public.is_org_manager(org_id));

-- ---- custom field values ----
create policy "org members can view custom field values"
  on public.custom_field_values for select
  using (public.is_org_member(org_id));

create policy "org members can write custom field values"
  on public.custom_field_values for insert
  with check (public.is_org_member(org_id));

create policy "org members can update custom field values"
  on public.custom_field_values for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "org members can delete custom field values"
  on public.custom_field_values for delete
  using (public.is_org_member(org_id));

-- ---- audit logs (read-only for org members; writes happen only via trigger) ----
create policy "org members can view audit logs"
  on public.audit_logs for select
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for audit_logs: the table is only ever
-- written by the SECURITY DEFINER write_audit_log() trigger function, which
-- bypasses RLS. Regular clients get select-only access.

-- =====================================================================================
-- 12. SEED HELPER — creates a default pipeline + stages for a new org.
-- Call this from the "create organization" server action right after insert.
-- =====================================================================================

create or replace function public.create_default_pipeline(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default, position)
  values (p_org_id, 'Sales Pipeline', true, 0)
  returning id into v_pipeline_id;

  insert into public.pipeline_stages (org_id, pipeline_id, name, position, probability, is_won_stage, is_lost_stage, color)
  values
    (p_org_id, v_pipeline_id, 'Prospecting',    0, 10,  false, false, '#94a3b8'),
    (p_org_id, v_pipeline_id, 'Qualified',      1, 25,  false, false, '#60a5fa'),
    (p_org_id, v_pipeline_id, 'Proposal Sent',  2, 50,  false, false, '#818cf8'),
    (p_org_id, v_pipeline_id, 'Negotiation',    3, 75,  false, false, '#c084fc'),
    (p_org_id, v_pipeline_id, 'Closed Won',     4, 100, true,  false, '#22c55e'),
    (p_org_id, v_pipeline_id, 'Closed Lost',    5, 0,   false, true,  '#ef4444');

  return v_pipeline_id;
end;
$$;
