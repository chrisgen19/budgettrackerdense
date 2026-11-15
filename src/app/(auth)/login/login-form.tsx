"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type LoginState, login } from "./actions";

const INITIAL_STATE: LoginState = {};

const FIELD_CLASS =
  "w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-current/60";

/** Submit button, disabled while the action is in flight. */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

/** Email and password, one generic error, no "forgot password" (budgettracker owns that). */
export function LoginForm() {
  const [state, formAction] = useActionState(login, INITIAL_STATE);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide opacity-60">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={FIELD_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide opacity-60">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD_CLASS}
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
