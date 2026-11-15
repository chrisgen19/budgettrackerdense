import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionSecret,
  shouldRefreshSession,
  signSession,
  verifySession,
} from "@/lib/session-token";

/**
 * The optimistic gate: no valid session cookie, no page.
 *
 * This only checks the cookie's signature and expiry, which is all a proxy
 * should do (Next's own guidance, `node_modules/next/dist/docs/01-app/
 * 01-getting-started/16-proxy.md`). Whether the account still exists, is still
 * verified and is still allowlisted is re-checked per request by
 * `getCurrentUser()`, which every page and action calls. Both layers are
 * required; neither is sufficient.
 *
 * It also slides the 12-hour window: a token older than an hour is re-signed
 * here, so continuous use never expires mid-session.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const secret = sessionSecret();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token, secret) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const redirect = NextResponse.redirect(url);
    // Clear an expired or tampered cookie so the next request is not re-checked.
    if (token) redirect.cookies.delete(SESSION_COOKIE);

    return redirect;
  }

  const response = NextResponse.next();

  if (shouldRefreshSession(session)) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: await signSession(session.userId, secret),
      ...sessionCookieOptions(),
    });
  }

  return response;
}

export const config = {
  // Everything except the sign-in and sign-out routes, the health check Coolify
  // polls (plan 08), and Next's own static output.
  matcher: [
    "/((?!login(?:/|$)|logout(?:/|$)|api/health(?:/|$)|_next/|favicon\\.ico$).*)",
  ],
};
