"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/** A failed read on one card, with a way back to the list. */
export default function CardDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Card detail failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Card</h1>

      <Panel flush>
        <ErrorState title="Could not read this card">
          <p>The database did not answer, so no balance is shown rather than a wrong one.</p>
          {error.digest ? (
            <p className="mt-2 tnum text-label">Reference {error.digest}</p>
          ) : null}
          <span className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="h-control cursor-pointer rounded-panel border border-rule bg-panel px-3 hover:bg-accent-soft"
            >
              Try again
            </button>
            <Link
              href="/cards"
              className="flex h-control items-center rounded-panel border border-rule bg-panel px-3 no-underline hover:bg-accent-soft"
            >
              All cards
            </Link>
          </span>
        </ErrorState>
      </Panel>
    </div>
  );
}
