# 04 Auth

Goal: sign in with the same email and password as budgettracker, and gate every page and action.
The app is deployed (plan 08), so this is real security, not a formality.

## Approach
Its own small session, not NextAuth. budgettracker uses NextAuth v4 with JWT sessions
(`src/lib/auth.ts`); sharing its cookie across domains would couple the two apps' secrets and
deploys. Here:

- **Credentials** are checked against the shared `users` table exactly as budgettracker does
  (`src/lib/auth.ts:15-40`): find by email, `bcrypt.compare(password, user.password)`, require
  `emailVerified`.
- **Allowlist:** `ALLOWED_EMAILS` (comma-separated). An account not on it is refused even with a
  correct password. This is a personal tool; the allowlist is the first gate.
- **Session:** a signed, httpOnly, `Secure`, `SameSite=Lax` cookie holding `{ userId, iat, exp }`,
  signed with `SESSION_SECRET` (HS256 via `jose`). 12-hour lifetime, sliding on activity.
- **Re-check on every request:** the session stores only `userId`; `getCurrentUser()` loads the
  user and re-checks the allowlist, so removing an email takes effect immediately.

## Packages to approve (ask Christian before installing)
- `bcryptjs` (same as budgettracker): https://www.npmjs.com/package/bcryptjs
- `jose` (JWT signing, edge-safe): https://www.npmjs.com/package/jose

Alternative without `jose`: HMAC-sign a JSON payload with Node's `crypto.createHmac`. Fine too;
pick one and note it here.

## Files
- `src/server/session.ts`: `createSession(userId)`, `readSession()`, `destroySession()`,
  `getCurrentUser()` returning `{ id, email, name, currency, timezoneOffset }` or `null`.
  `import "server-only"`.
- `src/app/(auth)/login/page.tsx` + a server action `login(formData)`: zod-validate, rate limit,
  verify, `createSession`, redirect to `/overview`. One generic error message
  ("Email or password is incorrect") for every failure, so the page does not reveal which emails
  exist (budgettracker's messages differ per case; do not copy them).
- `src/app/(auth)/logout/route.ts`: POST only, destroys the session.
- `src/proxy.ts` (Next 16's replacement for `middleware.ts`; confirm in the installed Next docs):
  redirect to `/login` when no valid session cookie, for everything except `/login`, static
  assets and `/api/health`. The proxy only checks the signature; pages still call
  `getCurrentUser()` (defence in depth, and the proxy cannot hit the DB cheaply).
- Every server action calls `getCurrentUser()` first and refuses without it.

## Rate limiting
In-memory sliding window keyed by IP + email: 5 failures per 15 minutes, then refuse with the same
generic message. A second window keyed by IP alone allows 20 failures per 15 minutes across all
emails, so one address cannot dodge the pair limit by inventing emails. Each limiter holds at most
500 keys, dropping the least recently failed when every key is still live. One Coolify container, so in-memory is enough; note that a second replica would
need a shared store.

## Security headers
`next.config.ts` headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin`, a CSP allowing self plus Google Fonts if not self-hosted by
`next/font` (it is, so `self` should suffice).

## Acceptance
- Correct credentials for an allowlisted, verified user land on `/overview`.
- Wrong password, unknown email, unverified email and non-allowlisted email all show the same
  message.
- The 6th failed attempt within 15 minutes is refused even with the right password.
- `curl -i http://127.0.0.1:3200/overview` without a cookie returns a redirect to `/login`.
- A tampered cookie is rejected.
- Unit tests: session sign/verify/expiry, allowlist parsing, rate limiter window.

## As built (Nov 2026)
What was actually built, and the places the plan needed a decision.

**Packages: `bcryptjs` 3.0.3 and `jose` 6.2.17** (approved before installing). `bcryptjs` 3 is ESM
with its own types, so no `@types/bcryptjs`; its hash format is unchanged from budgettracker's
v2.4, which matters because both apps read the same `users.password` column. `jose` was kept even
though Next 16 runs Proxy on the **Node.js** runtime by default
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, changelog
`v16.0.0`), so the edge-safety argument for it no longer applies: it was chosen for a standard JWT
format and strict algorithm pinning rather than a hand-rolled HMAC envelope.

**Three layers, not one.**
- `src/lib/session-token.ts` is pure: cookie name, HS256 sign/verify, TTL, slide policy and the
  cookie attributes. No `next/headers`, no Prisma, no `server-only`, so `src/proxy.ts` and the
  pages verify with the same code.
- `src/proxy.ts` checks the signature only, and redirects to `/login` when it fails. It also
  clears the cookie it just rejected.
- `src/server/session.ts` re-loads the user per request and re-checks `emailVerified` and the
  allowlist. `requireCurrentUser()` for pages (redirects), `requireCurrentUserOrThrow()` for
  server actions and route handlers, where a redirect would be swallowed.

**Sliding session.** The proxy re-signs a token that has been in use for an hour or more
(`SESSION_REFRESH_AFTER_SECONDS`), rather than on every request. Continuous use never expires
mid-session; an idle session still dies at 12 hours.

**Allowlist fails closed.** An empty or missing `ALLOWED_EMAILS` denies everyone
(`src/lib/allowlist.ts`). There are four rows in `users`; only the allowlisted one can sign in.

**Timing.** `verifyCredentials` always runs one bcrypt compare, against a fixed cost-12 hash when
the email is unknown, so an unknown address costs the same as a known one. Measured in the
browser: unknown email 283ms, unverified 275ms, non-allowlisted 280ms, wrong password 282ms.

**Rate limit.** 5 failures per 15 minutes keyed on `x-forwarded-for` first hop plus the submitted
email, checked *before* the password, so a locked-out key is refused even with correct
credentials. Measured: attempts 1-5 take ~285ms (bcrypt runs), attempt 6 onward returns in 15ms
(short-circuited), with the same message throughout.

**Logout** is `POST /logout` returning 303 with a **relative** `Location`. `new URL("/login",
request.url)` resolved to `localhost` behind the dev proxy and would resolve to the container's
host behind Coolify's.

**Security headers** are in `next.config.ts` on `/:path*`: CSP, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`. The CSP
needs `'unsafe-inline'` for scripts (Next's hydration bootstrap carries no nonce while Cache
Components are off) and `'unsafe-eval'` plus `ws:` in development only, for Turbopack.

**Placeholders.** `/overview` exists as a stub because it is where signing in lands and it proves
the gate; `/` redirects to it. Both are replaced in plans 05 and 06.

**Still to do in plan 08:** `/api/health` is excluded by the proxy matcher but does not exist yet.

### Acceptance, checked
| Check | Result |
|---|---|
| `curl -i /overview` with no cookie | 307 to `/login` |
| `/` with no cookie | 307 to `/login` |
| Valid cookie for the allowlisted user | 200, "Signed in as ..." |
| Valid cookie, non-allowlisted user | 307 to `/login` |
| Valid cookie, unverified email | 307 to `/login` |
| Tampered cookie | 307 to `/login`, plus `Set-Cookie` clearing it |
| `/login` while signed in | 307 to `/overview` |
| `GET /logout` | 405 |
| `POST /logout` | 303 to `/login`, cookie cleared |
| Wrong password, unknown email, unverified, non-allowlisted, malformed | all "Email or password is incorrect" |
| 6th failure inside 15 minutes | refused without reaching bcrypt |
| Unit tests | sign/verify/expiry/tamper/wrong-secret/claim-shape, slide policy, cookie attributes, allowlist parsing, limiter window and sweep, client IP |

Not checked here: signing in with the real password, which needs Christian to type it.
