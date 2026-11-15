"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyCredentials } from "@/server/credentials";
import { loginLimiter, loginLimiterKey } from "@/server/login-limiter";
import { createSession } from "@/server/session";

/**
 * The one message every failure returns: bad password, unknown email,
 * unverified email, address not on `ALLOWED_EMAILS`, malformed input and rate
 * limited all look identical from outside.
 */
const GENERIC_ERROR = "Email or password is incorrect";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

/** What the login form renders. `undefined` error means nothing submitted yet. */
export interface LoginState {
  error?: string;
}

/** Verifies credentials, opens a session and lands on `/overview`. */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: GENERIC_ERROR };

  const { email, password } = parsed.data;
  const key = loginLimiterKey(clientIpFrom(await headers()), email);

  // Checked before the password, so a locked-out key is refused even when the
  // credentials are correct.
  if (loginLimiter.isBlocked(key)) return { error: GENERIC_ERROR };

  const userId = await verifyCredentials(email, password);

  if (!userId) {
    loginLimiter.recordFailure(key);
    return { error: GENERIC_ERROR };
  }

  loginLimiter.clear(key);
  await createSession(userId);

  redirect("/overview");
}
