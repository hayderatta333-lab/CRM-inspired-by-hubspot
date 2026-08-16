/**
 * middleware.ts (project root)
 *
 * Runs on every request (except static assets, see `matcher`).
 * Responsibilities, in order:
 *   1. Refresh the Supabase session cookie (updateSession).
 *   2. Redirect unauthenticated users away from protected routes.
 *   3. Redirect authenticated users away from auth pages (login/signup).
 *
 * Fine-grained RBAC (admin-only settings pages, manager-only pipeline
 * config, etc.) is deliberately NOT done here — role lookups require a
 * DB round trip, and doing that on every single request (including
 * prefetches and static-ish routes) is wasteful and adds latency to
 * every navigation. Instead, role checks live in the layout/page Server
 * Components that need them, via requireRole() in lib/auth/session.ts,
 * which runs once per actual page render. The database RLS policies in
 * supabase/schema.sql remain the real enforcement boundary either way —
 * both of these layers are UX conveniences on top of that.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/auth/reset-password"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/whatsapp/webhook") || request.nextUrl.pathname.startsWith("/api/whatsapp/send")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const publicRoute = isPublicRoute(pathname);

  if (!user && !publicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, and common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
