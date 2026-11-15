"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/**
 * A failed read says so and offers a retry.
 *
 * It never degrades into the empty state: for money, "nothing was spent" and
 * "the query failed" are different answers and only one of them is reassuring.
 * The message stays generic because the digest is all the client is given;
 * the cause is in the server log.
 */
export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side causes are redacted in production, so surface what is left.
    console.error("Overview failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Overview</h1>

      <Panel flush>
        <ErrorState title="Could not read this month">
          <p>The database did not answer, so no figures are shown rather than wrong ones.</p>
          {error.digest ? (
            <p className="mt-2 tnum text-label">Reference {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-3 h-control cursor-pointer rounded-panel border border-rule bg-panel px-3 hover:bg-accent-soft"
          >
            Try again
          </button>
        </ErrorState>
      </Panel>
    </div>
  );
}
