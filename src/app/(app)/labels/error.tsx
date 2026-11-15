"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";

/**
 * A failed read says so. It must never fall through to the empty state:
 * "nothing was tagged" and "the labels could not be read" are different
 * answers, and only one of them is true.
 */
export default function LabelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Labels failed to load", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="text-title font-semibold">Labels</h1>

      <Panel flush>
        <ErrorState title="Could not read your labels">
          <p>
            The database did not answer. This is not the same as nothing being tagged, so nothing
            is shown either way.
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
