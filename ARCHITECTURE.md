# CRM — Architecture (Step 2)

## Full project structure

```
crm/
├── middleware.ts                     # auth gate + session refresh (root)
├── .env.local.example
├── types/
│   └── crm.ts                        # Step 1
├── supabase/
│   └── schema.sql                    # Step 1
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # browser client (Client Components only)
│   │   ├── server.ts                 # server client (RLS-bound) + admin client
│   │   └── middleware.ts             # session refresh used by root middleware.ts
│   ├── auth/
│   │   └── session.ts                # getOrgContext / requireOrgContext / requireRole
│   ├── actions/
│   │   ├── action-result.ts          # ActionResult<T>, ok(), fail(), toActionError()
│   │   ├── contacts.ts                ✅ built
│   │   ├── companies.ts               ✅ built
│   │   ├── deals.ts                   → Step 3 (Kanban board needs this)
│   │   ├── activities.ts              → Step 3
│   │   ├── pipelines.ts               → Step 3
│   │   ├── organizations.ts           → Step 3 (onboarding, invites)
│   │   └── analytics.ts               → Step 4 (dashboard aggregates)
│   ├── validations/
│   │   ├── contact.ts                 ✅ built
│   │   ├── company.ts                 ✅ built
│   │   ├── deal.ts                    ✅ built
│   │   ├── activity.ts                ✅ built
│   │   └── organization.ts            ✅ built
│   └── utils.ts                      # cn(), formatCurrency(), formatDate(), initials()
└── app/
    ├── (auth)/
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   └── layout.tsx                 # centered, unauthenticated layout
    ├── onboarding/page.tsx            # create-or-join-org flow
    ├── (dashboard)/
    │   ├── layout.tsx                 # sidebar + topbar shell, calls requireOrgContext()
    │   ├── dashboard/page.tsx         # analytics home — Step 4
    │   ├── contacts/
    │   │   ├── page.tsx               # table: search/filter/paginate — Step 3 UI
    │   │   ├── [id]/page.tsx          # 360 view: details + timeline
    │   │   └── new/page.tsx
    │   ├── companies/  (mirrors contacts/)
    │   ├── deals/
    │   │   ├── page.tsx               # Kanban board — Step 3
    │   │   └── [id]/page.tsx
    │   └── settings/
    │       ├── organization/page.tsx  # admin only
    │       ├── members/page.tsx       # admin only
    │       ├── pipelines/page.tsx     # manager+ only
    │       └── custom-fields/page.tsx # manager+ only
    └── api/
        └── webhooks/...                # only if/when needed (e.g. inbound email)
```

## Request lifecycle (how the layers fit together)

1. **`middleware.ts`** runs first on every request: refreshes the Supabase
   session cookie, then redirects unauthenticated users to `/login` and
   authenticated users away from `/login`/`/signup`. It does **not** check
   org roles — see the comment in that file for why.
2. **Server Components** (pages/layouts) call `requireOrgContext()` or
   `requireRole([...])` from `lib/auth/session.ts` to get `{ userId, orgId,
   role, profile }` and to gate admin/manager-only pages.
3. **Server Actions** in `lib/actions/*` are the only way the UI mutates
   data. Each one: resolves org context → validates with Zod → queries via
   the RLS-bound client from `lib/supabase/server.ts` → revalidates paths →
   returns `ActionResult<T>`.
4. **Row Level Security** (`supabase/schema.sql`) is the actual
   authorization boundary. Every layer above is a UX convenience — even if
   a bug slipped through the role checks in `session.ts`, RLS still blocks
   the query at the database.
5. **Client Components** call Server Actions directly (they're async
   functions, importable into `"use client"` files) for forms, or use
   TanStack Query wrapping those same actions when they need caching,
   optimistic updates, or Realtime-driven refetching (e.g. the Kanban
   board in Step 3).

## Why Server Actions instead of a REST/tRPC API layer

The stack calls for Server Actions/Server Components as the primary data
layer per your spec. Route Handlers under `app/api/` are reserved for
things Server Actions can't do — webhooks (Stripe, inbound email),
anything that needs a stable public URL, or endpoints consumed by
non-Next.js clients. Everything else (all CRUD in this app) goes through
`lib/actions/*` so there's one validation/authorization path, not two.

## Multi-org handling

A user can belong to multiple organizations (`organization_members` is a
join table, not 1:1). The "active" org is resolved by
`getOrgContext()`: a `crm_active_org_id` cookie if set, otherwise the
user's first active membership. An org switcher (Step 3, in the sidebar)
calls a small Server Action that sets that cookie and redirects.

## Error handling contract

Every Server Action returns:

```ts
{ success: true, data: T }
| { success: false, error: string, fieldErrors?: Record<string, string[]> }
```

React Hook Form submit handlers pattern-match on `success` and call
`form.setError()` for each `fieldErrors` entry — no `try/catch` needed at
the call site, and Postgres error codes (unique/FK/check violations, RLS
denials) are translated to friendly messages in `toActionError()` rather
than leaking raw DB errors to the UI.

## What's next

- **Step 3**: Deals/Pipelines/Activities Server Actions, then the UI layer
  — contacts/companies tables (shadcn `DataTable`), the drag-and-drop
  Kanban board (`@dnd-kit`), and the unified activity timeline component.
- **Step 4**: Analytics dashboard — `lib/actions/analytics.ts` aggregate
  queries (pipeline value, win rate, deal velocity, MRR) + chart
  components (Recharts).
- **Step 5**: RBAC UI polish — settings pages, member invites, custom
  field builder.
