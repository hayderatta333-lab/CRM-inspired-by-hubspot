alter table public.contacts add column if not exists facebook_psid text;
create index if not exists idx_contacts_facebook_psid on public.contacts(facebook_psid) where facebook_psid is not null;
