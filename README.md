# CRM

A production CRM (HubSpot-style) built with Next.js 14 App Router,
TypeScript, Supabase (Postgres + RLS + Auth), Tailwind, and shadcn/ui.

## What's here

- **`supabase/schema.sql`** — full multi-tenant schema: organizations,
  contacts, companies, deals/pipelines, activities, custom fields, audit
  logs, triggers, and Row Level Security policies.
- **`supabase/analytics_functions.sql`** — Postgres RPC functions
  powering the analytics dashboard.
- **`types/crm.ts`** — TypeScript types mirroring the schema.
- **`lib/actions/*`** — Server Actions (the only way the UI mutates
  data): auth, organizations, contacts, companies, deals, pipelines,
  activities, analytics.
- **`app/`** — pages: auth (login/signup), onboarding, and the
  dashboard (contacts, companies, deals Kanban, analytics, settings).
- **`components/`** — UI: Kanban board (`@dnd-kit`), dashboard charts
  (Recharts), data tables, forms (React Hook Form + Zod).

See **`ARCHITECTURE.md`** for the full request lifecycle and folder
structure, and **`DEPLOYMENT.md`** for local setup, Supabase
provisioning, and deploying to Vercel.

## Quick start

```bash
npm install
npx shadcn@latest add button input select card badge avatar dialog table skeleton
cp .env.local.example .env.local   # fill in your Supabase project's values
npm run dev
```

Run `supabase/schema.sql` then `supabase/analytics_functions.sql` in
your Supabase project's SQL Editor before starting the app — nothing
will render without the schema in place.

Full walkthrough: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Tech stack

Next.js 14 (App Router, Server Actions) · TypeScript (strict) ·
Supabase (Postgres, RLS, Auth) · Tailwind CSS · shadcn/ui · React Hook
Form + Zod · TanStack Query · Recharts · @dnd-kit
