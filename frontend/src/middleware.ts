/**
 * Server-side auth gate for the trader's workspace (/app tree).
 *
 * A client-side gate alone is a UX gate, not an auth gate: content flashes
 * and the tree stays indexable. This middleware verifies the Supabase session
 * at the edge via @supabase/ssr (createBrowserClient stores sessions in SSR
 * cookies, so claims are checkable here) and refreshes tokens — refreshed
 * Set-Cookie headers are forwarded on BOTH the pass-through and the redirect.
 *
 * Deliberately exempt: /app/trade-review — its logged-out state (blurred demo
 * + Google CTA) is a conversion surface and must stay publicly reachable; the
 * page handles its own auth states. The matcher below encodes this.
 *
 * Fail-open on missing env: with no Supabase config the gate passes requests
 * through rather than locking the whole workspace out on a misconfigured
 * deploy — the client-side gate in app/layout.tsx is the second layer.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // The gated workspace is per-user content — keep it out of search indexes.
  // /app/trade-review is exempt from this matcher and stays indexable (its
  // logged-out demo is a landing surface).
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = `next=${encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    )}`;
    const redirect = NextResponse.redirect(loginUrl);
    // Keep any cookies refreshed during getClaims() so the next request
    // doesn't re-do the refresh (or lose the rotated refresh token).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // /app and everything under it EXCEPT /app/trade-review (public demo).
  matcher: ["/app", "/app/((?!trade-review).*)"],
};
