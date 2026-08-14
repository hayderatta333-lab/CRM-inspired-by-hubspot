# Deployment Guide

Steps 1–6 are all in this build: schema, Server Actions, Kanban board,
analytics dashboard, Contacts/Companies UI, RBAC settings, and now
sign up / sign in / onboarding. The app is deployable end-to-end from
here — a new user can sign up, confirm their email, create an
organization, and land in the dashboard without any manual SQL.

## 1. Local project setup

```bash
npx create-next-app@latest crm-app \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias "@/*"
cd crm-app
```

Copy every file from this build into the matching path in `crm-app/`
(the folder structure mirrors what's been delivered: `types/`,
`supabase/`, `lib/`, `components/`, `app/`, `middleware.ts`,
`package.json`, `.env.local.example`).

Install dependencies:

```bash
npm install
```

Install shadcn/ui (the components some of the UI imports assume are
present — run this even though most of what's built here uses plain
Tailwind, since Step 6's forms/dialogs will want them):

```bash
npx shadcn@latest init
npx shadcn@latest add button input select card badge avatar dialog table skeleton
```

## 2. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard) — pick a region close to your users.
2. **SQL Editor** → paste and run `supabase/schema.sql` in full.
3. Then paste and run `supabase/analytics_functions.sql`.
4. **Authentication → Providers**: confirm Email is enabled. If you want
   magic-link/password signup instead of invite-only, also enable "Allow
   new users to sign up".
5. **Authentication → URL Configuration**: set:
   - Site URL: `http://localhost:3000` for now (you'll change this after deploying)
   - Redirect URLs: add `http://localhost:3000/**`
6. **Project Settings → API**: copy the Project URL, `anon` `public` key,
   and `service_role` key — you'll need all three.

## 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=<Project URL from step 2.6>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key — keep this secret, never commit it>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000/signup`, create an account, confirm the
email Supabase sends (check the Supabase dashboard's Auth logs if it
doesn't arrive locally — the default email sender is rate-limited), then
you'll land on `/onboarding` to create your organization, which drops
you straight into `/dashboard`.

If your Supabase project has email confirmation turned off (Authentication
→ Providers → Email → "Confirm email" toggle), signup goes straight to
onboarding with no email step.

## 5. Deploy to Vercel

```bash
git init && git add -A && git commit -m "Initial CRM build"
```

Push to a GitHub repo, then:

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. Framework preset: Next.js (auto-detected).
3. Add the same four environment variables from step 3 in the Vercel
   project's **Settings → Environment Variables** — for
   `NEXT_PUBLIC_SITE_URL`, use your future production URL (e.g.
   `https://crm.yourcompany.com` or the `*.vercel.app` domain Vercel
   assigns).
4. Deploy.

## 6. Post-deploy Supabase config

Back in Supabase → Authentication → URL Configuration, update:
- Site URL → your production URL
- Redirect URLs → add `https://<your-domain>/**`

If you changed `NEXT_PUBLIC_SITE_URL` after the first deploy, redeploy
from Vercel so the build picks up the new value (it's inlined at build
time for anything read in a Client Component).

## 7. Custom domain (optional)

Vercel → Project → Settings → Domains → add your domain, follow the DNS
instructions (usually a CNAME to `cname.vercel-dns.com`). Then repeat
step 6 with the final domain.

## 8. Ongoing schema changes

Treat `schema.sql` and `analytics_functions.sql` as the source of truth,
but going forward apply changes as incremental migrations rather than
re-running the whole file:

```bash
npx supabase init          # once, links a local supabase/ config
npx supabase link --project-ref <your-project-ref>
npx supabase migration new <description>
# edit the generated file in supabase/migrations/
npx supabase db push
```

## Production checklist before opening this up to real users

- [ ] Turn off "Allow new users to sign up" in Supabase Auth if this
      should be invite-only (the `inviteMember` action already assumes that)
- [ ] Set up Supabase's daily backups (Project Settings → Database → Backups)
- [ ] Point a real transactional email provider at Supabase Auth
      (Project Settings → Auth → SMTP Settings) — the default Supabase
      email sender is rate-limited and not meant for production invite volume
- [ ] Add error monitoring (Sentry or similar) around Server Actions
- [ ] Load-test `fn_dashboard_metrics`/`fn_deal_forecast` against a
      realistic deal volume and add any indexes the query planner asks for
