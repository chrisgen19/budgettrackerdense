"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/**
 * A failed read says so. It must not fall through to "no cards": a card that
 * owes money going missing is the one mistake this page cannot make.
 */
export default function CardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cards failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Cards</h1>

      <Panel flush>
        <ErrorState title="Could not read the cards">
          <p>The database did not answer, so no balances are shown rather than wrong ones.</p>
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
