/**
 * The client address to key rate limiting on.
 *
 * Coolify terminates TLS in its Traefik proxy and forwards the original address
 * in `x-forwarded-for`, so the first entry of that list is the closest thing to
 * a client identity available here. It is spoofable by anything that can reach
 * the app directly, which is why it is only ever half of the key: the other half
 * is the submitted email.
 */
const UNKNOWN_IP = "unknown";

/** First `x-forwarded-for` hop, else `x-real-ip`, else `"unknown"`. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  return UNKNOWN_IP;
}
