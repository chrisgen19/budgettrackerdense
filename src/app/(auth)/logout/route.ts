import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

/**
 * Sign out. POST only, so a prefetch, an image tag or a stray link cannot end a
 * session. A missing session is not an error: the result is the same page.
 *
 * The `Location` is relative on purpose. `new URL("/login", request.url)` would
 * bake in whatever host reached the container, which behind Coolify's proxy is
 * not the host the browser asked for. 303 so the browser follows it with a GET,
 * and the cookie is cleared on this response so the header travels with the
 * redirect rather than some later one.
 */
export function POST(): NextResponse {
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  response.cookies.delete(SESSION_COOKIE);

  return response;
}
