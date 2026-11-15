"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/**
 * A failed read never falls back to an empty form. Without the user's real
 * categories, labels and cards the parser would match nothing, and a form that
 * looks usable but cannot read a line is worse than one that says it failed.
 */
export default function NewEntryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("New entry failed to load", error);
  }, [error]);

  return (
    <div className="flex max-w-[760px] flex-col gap-2.5">
      <h1 className="text-title font-semibold">New entry</h1>

      <Panel flush>
        <ErrorState title="Could not load your categories, labels and cards">
          <p>
            The database did not answer, so the line cannot be read against your own lists. Nothing
            was saved.
          </p>
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
