import { CornerDownLeft } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import type { WriteFailure } from "@/server/writes";

/** What each refusal means to the person typing, and what to do next. */
export const FAILURE_TEXT: Record<WriteFailure, string> = {
  DENSE_NOT_DEPLOYED: "Saving is off: budgettracker does not have the DENSE source yet.",
  INVALID_INPUT: "budgettracker's rules refused this entry as typed. Check the amount, category and date.",
  LABELS_NOT_OWNED: "A label was deleted or is not yours. Pick the labels again.",
  CATEGORIES_NOT_OWNED: "That category was deleted, or does not fit this type of entry.",
  CARD_NOT_USABLE: "That card cannot take this entry: it is archived, or the entry is income.",
  NO_LONGER_PERMITTED: "Writes are no longer allowed for this session.",
  UNKNOWN_WHETHER_SAVED: "Not sure it saved. Press Enter again: it saves once, or confirms it already did.",
  WRITE_FAILED: "The save did not finish. Press Enter again: it saves once, or confirms it already did.",
};

/**
 * The Save button, and above it whatever stands between this line and a save.
 * While writes are off the button is disabled and says why, so the page reads
 * as a working preview rather than a broken form.
 */
export function SaveBar({
  canSave,
  problems,
  warnings,
  pending,
  onSave,
}: {
  canSave: boolean;
  problems: readonly string[];
  warnings: readonly string[];
  pending: boolean;
  onSave: () => void;
}) {
  const blocked = !canSave || problems.length > 0 || pending;

  return (
    <div className="flex flex-col gap-2 pt-2.5">
      {[...problems, ...warnings].length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-label">
          {problems.map((problem) => (
            <li key={problem} className="text-muted">{problem}</li>
          ))}
          {warnings.map((warning) => (
            <li key={warning} className="text-expense">{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onSave}
          disabled={blocked}
          aria-describedby={canSave ? undefined : "save-off"}
          className="inline-flex h-control cursor-pointer items-center gap-1.5 rounded-panel border border-accent bg-accent px-3 font-medium text-accent-ink disabled:cursor-not-allowed disabled:border-rule disabled:bg-bg disabled:text-muted"
        >
          <CornerDownLeft aria-hidden className="size-4" strokeWidth={1.75} />
          {pending ? "Saving…" : "Save entry"}
        </button>
        <span className="hidden flex-wrap items-center gap-2 text-label text-muted wide:flex">
          <Kbd>⏎</Kbd> save <Kbd>⇧⏎</Kbd> save + next <Kbd>esc</Kbd> clear
        </span>
      </div>

      {canSave ? null : (
        <p id="save-off" className="m-0 rounded-panel border border-rule bg-warn-bg px-2.5 py-1.5 text-label">
          <b className="font-semibold">Preview only.</b> Saving stays off until budgettracker ships the
          DENSE transaction source (plan 07, step 0). Everything else here works: type a line and the
          table shows exactly what would be saved.
        </p>
      )}
    </div>
  );
}
