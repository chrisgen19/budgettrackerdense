import "server-only";
import { compare } from "bcryptjs";
import { isEmailAllowedByEnv } from "@/lib/allowlist";
import { prisma } from "@/server/db";

/**
 * Password verification against the shared `users` table, the same four checks
 * budgettracker makes in `src/lib/auth.ts`: the email exists, the bcrypt hash
 * matches, the email is verified, and (added here) the address is allowlisted.
 *
 * Unlike budgettracker this never reports which check failed. The login page is
 * on the public internet, so a per-case message would say which addresses have
 * accounts; the caller gets one generic message for all four.
 */

/**
 * A real cost-12 hash of a string nobody can submit. Compared against when the
 * email is unknown, so an unknown address costs the same ~200ms as a known one
 * and the response time does not enumerate accounts.
 */
const ABSENT_USER_HASH = "$2b$12$slsZBlNXIIFhFAGrmtNmwOjH9cwAhpJsYG1FCZKrauOSlC3HzwFFC";

/** The user id when every check passes, else `null`. `email` must be lowercased. */
export async function verifyCredentials(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, emailVerified: true },
  });

  const passwordMatches = await compare(password, user?.password ?? ABSENT_USER_HASH);

  if (!user || !passwordMatches) return null;
  if (!user.emailVerified) return null;
  if (!isEmailAllowedByEnv(user.email)) return null;

  return user.id;
}
