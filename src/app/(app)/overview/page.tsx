import type { Metadata } from "next";
import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { pageTitle } from "@/lib/app";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Overview"),
};

/**
 * Still a placeholder: the real Overview is docs/plans/06-pages.md. It now sits
 * inside the shell and uses the primitives, so the design system has somewhere
 * to be seen outside /dev/primitives.
 */
export default async function OverviewPage() {
  const user = await requireCurrentUser();

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Overview</h1>

      <Panel title="Signed in" meta={user.email}>
        <p>
          {user.name}, {user.currency}, timezone offset{" "}
          <span className="tnum text-figure">{user.timezoneOffset}</span>.
        </p>
        <p className="mt-2 text-muted">
          Pages arrive in phase 06. The design system is on{" "}
          <Link href="/dev/primitives" className="text-accent underline">
            /dev/primitives
          </Link>
          . Press <Kbd>?</Kbd> for shortcuts, <Kbd>t</Kbd> to switch theme.
        </p>
      </Panel>

      <form method="post" action="/logout">
        <button
          type="submit"
          className="h-control cursor-pointer rounded-panel border border-rule bg-panel px-3 hover:bg-accent-soft"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
