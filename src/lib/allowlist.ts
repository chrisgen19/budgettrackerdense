/**
 * The `ALLOWED_EMAILS` gate.
 *
 * This app reads one person's money on a public URL, so a correct password is
 * not enough on its own: the account also has to be named in `ALLOWED_EMAILS`.
 * An empty or missing list denies everyone rather than allowing everyone, so a
 * forgotten environment variable fails closed.
 */

/** Splits `ALLOWED_EMAILS` into normalised, de-duplicated addresses. */
export function parseAllowedEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];

  const emails = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  return [...new Set(emails)];
}

/** Whether `email` is on the parsed allowlist. An empty allowlist allows nobody. */
export function isAllowedEmail(email: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return false;

  return allowed.includes(email.trim().toLowerCase());
}

/**
 * `isAllowedEmail` against `ALLOWED_EMAILS`. The raw list is a parameter so tests
 * can pass one without mutating the process environment.
 */
export function isEmailAllowedByEnv(
  email: string,
  raw: string | undefined = process.env.ALLOWED_EMAILS,
): boolean {
  return isAllowedEmail(email, parseAllowedEmails(raw));
}
