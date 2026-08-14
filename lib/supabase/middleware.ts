/**
 * lib/supabase/middleware.ts
 *
 * Refreshes the Supabase auth session on every request and mirrors the
 * refreshed cookies onto the outgoing response. Called from the root
 * middleware.ts. Keeping this logic isolated here (rather than inline in
 * middleware.ts) matches Supabase's recommended pattern and keeps
 * middleware.ts focused on route-protection/RBAC decisions.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/crm";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not remove — this call refreshes the token if expired
  // and must run before any route-protection checks read the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
