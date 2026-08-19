create table public.facebook_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  page_id text not null unique,
  page_name text,
  page_access_token text not null,
  connected_by uuid not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_fb_connections_org on public.facebook_connections(org_id);
create index idx_fb_connections_page on public.facebook_connections(page_id);

alter table public.facebook_connections enable row level security;

create policy "fb_connections_select_admin" on public.facebook_connections
  for select using (public.is_org_member(org_id) and public.is_org_manager(org_id));

create policy "fb_connections_insert_admin" on public.facebook_connections
  for insert with check (public.is_org_member(org_id) and public.is_org_manager(org_id) and connected_by = auth.uid());

create policy "fb_connections_update_admin" on public.facebook_connections
  for update using (public.is_org_member(org_id) and public.is_org_manager(org_id));

create policy "fb_connections_delete_admin" on public.facebook_connections
  for delete using (public.is_org_member(org_id) and public.is_org_manager(org_id));

create table public.facebook_messages (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  psid text not null,
  contact_name text,
  message_text text not null,
  direction text not null check (direction in ('inbound','outbound')),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_fb_messages_page_psid on public.facebook_messages(page_id, psid);
alter table public.facebook_messages enable row level security;

create policy "fb_messages_select_org" on public.facebook_messages
  for select using (
    page_id in (select page_id from public.facebook_connections where public.is_org_member(org_id))
  );
