create extension if not exists pgcrypto;

create table if not exists flows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  trigger_keywords text[],
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flows_org_id on flows(org_id);

alter table flows enable row level security;

create policy "flows_org_access" on flows
  for all
  using (org_id in (select org_id from organization_members where user_id = auth.uid()))
  with check (org_id in (select org_id from organization_members where user_id = auth.uid()));

create table if not exists flow_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  flow_id uuid not null references flows(id) on delete cascade,
  contact_phone text not null,
  current_node_id text,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, contact_phone, flow_id)
);

create index if not exists idx_flow_sessions_lookup on flow_sessions(org_id, contact_phone, status);

alter table flow_sessions enable row level security;

create policy "flow_sessions_service_access" on flow_sessions
  using (true)
  with check (true);
