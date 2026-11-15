"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/**
 * A failed read says so. It must never fall through to the empty state:
 * "nothing is due" and "the bills could not be read" are different answers,
 * and believing the first when the second is true is how a bill goes unpaid.
 */
export default function BillsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Bills failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Bills</h1>

      <Panel flush>
        <ErrorState title="Could not read your bills">
          <p>
            The database did not answer. This is not the same as nothing being due, so nothing is
            shown either way.
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
