/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client. Use this only inside Client Components
 * (files with "use client") — e.g. for Realtime subscriptions or
 * TanStack Query hooks that need a client-side session. All mutations
 * that matter (writes) should go through Server Actions in lib/actions/*,
 * not through this client, so validation and RLS run consistently.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/crm";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
