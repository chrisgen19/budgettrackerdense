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
generic message. One Coolify container, so in-memory is enough; note that a second replica would
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
