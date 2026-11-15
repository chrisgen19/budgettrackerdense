import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/states";
import type { RecentEntry } from "@/server/queries/new-entry";

/** A stored instant as the user's own `YYYY-MM-DD HH:mm`. */
export function localStamp(iso: string, timezoneOffset: number): string {
  return new Date(Date.parse(iso) - timezoneOffset * 60_000).toISOString().slice(0, 16).replace("T", " ");
}

/** The confirmation line's shape: `2026-09-28 22:36  −241.00  Transportation  [TNVS]`. */
export function EntryLine({ entry, timezoneOffset }: { entry: RecentEntry; timezoneOffset: number }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 font-mono text-figure">
      <span className="text-muted">{localStamp(entry.date, timezoneOffset)}</span>
      <Money
        value={entry.type === "EXPENSE" ? -entry.amount : entry.amount}
        tone={entry.type === "INCOME" ? "income" : "plain"}
        sign
        bare
      />
      <span>{entry.categoryName}</span>
      {entry.labelNames.length > 0 ? <span className="text-muted">[{entry.labelNames.join(", ")}]</span> : null}
      {entry.description ? <span className="min-w-0 truncate text-muted">{entry.description}</span> : null}
    </span>
  );
}

/** The last entries made on this page, newest first. */
export function RecentEntries({
  entries,
  timezoneOffset,
  canSave,
}: {
  entries: readonly RecentEntry[];
  timezoneOffset: number;
  canSave: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState title={canSave ? "No entries made here yet" : "Nothing can be saved here yet"}>
        <p>
          {canSave
            ? "Entries saved on this page are listed here, newest first."
            : "Once saving is on, entries made here are listed newest first."}
        </p>
      </EmptyState>
    );
  }

  return (
    <ol className="m-0 list-none p-0">
      {entries.map((entry) => (
        <li key={entry.id} className="border-b border-rule-2 px-2.5 py-1.5 last:border-b-0">
          <EntryLine entry={entry} timezoneOffset={timezoneOffset} />
        </li>
      ))}
    </ol>
  );
}
