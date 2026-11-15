import type { Metadata } from "next";
import { pageTitle } from "@/lib/app";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Overview"),
};

/**
 * Placeholder. The real Overview arrives with the design system and pages,
 * docs/plans/05-design-system.md and docs/plans/06-pages.md. It exists now
 * because it is where signing in lands, and it proves the gate works.
 */
export default async function OverviewPage() {
  const user = await requireCurrentUser();

  return (
    <main className="flex flex-1 flex-col items-start gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm opacity-60">
          Signed in as {user.name} ({user.email}).
        </p>
      </div>

      <form method="post" action="/logout">
        <button type="submit" className="rounded border border-current/20 px-3 py-1.5 text-sm">
          Sign out
        </button>
      </form>
    </main>
  );
}
