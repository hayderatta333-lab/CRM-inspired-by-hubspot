/**
 * lib/supabase/server.ts
 *
 * Supabase client for use inside Server Components, Server Actions, and
 * Route Handlers. Bound to the request's cookies, so it carries the
 * caller's session — every query made with this client is subject to
 * the RLS policies in supabase/schema.sql. This is the client that
 * every server action in lib/actions/* should use; never the service
 * role key, which would bypass RLS entirely.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/crm";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
          });
        } catch {
          // setAll is called from a Server Component (not a Server Action
          // or Route Handler) in some render paths. Next.js forbids
          // writing cookies there. This is safe to ignore as long as
          // middleware.ts is also refreshing the session (see below) —
          // that's what actually persists the refreshed token.
        }
      },
    },
  });
}

/**
 * Admin/service-role client — bypasses RLS entirely. Reserved for trusted
 * server-only operations that must cross tenant boundaries (e.g. Stripe
 * webhooks, scheduled jobs). Never import this into anything reachable
 * from a user request without an explicit, manual authorization check
 * first, and never expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
