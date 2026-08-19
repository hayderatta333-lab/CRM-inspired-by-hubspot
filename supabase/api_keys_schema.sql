create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  service text not null default 'n8n',
  key_prefix text not null,
  key_hash text not null,
  created_by uuid not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_org on public.api_keys(org_id);
create index idx_api_keys_hash on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

create policy "api_keys_select_admin" on public.api_keys
  for select using (public.is_org_member(org_id) and public.is_org_manager(org_id));

create policy "api_keys_insert_admin" on public.api_keys
  for insert with check (public.is_org_member(org_id) and public.is_org_manager(org_id) and created_by = auth.uid());

create policy "api_keys_update_admin" on public.api_keys
  for update using (public.is_org_member(org_id) and public.is_org_manager(org_id));

create policy "api_keys_delete_admin" on public.api_keys
  for delete using (public.is_org_member(org_id) and public.is_org_manager(org_id));
