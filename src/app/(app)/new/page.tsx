import type { Metadata } from "next";
import { EntryForm } from "@/components/new/entry-form";
import { Panel } from "@/components/ui/panel";
import { Kbd } from "@/components/ui/kbd";
import { pageTitle } from "@/lib/app";
import { prisma } from "@/server/db";
import { fetchEntryContext } from "@/server/queries/new-entry";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("New entry"),
};

const HELP: ReadonlyArray<[string, string]> = [
  ["250", "amount"],
  ["food", "category prefix"],
  ["@tnvs", "label"],
  ["#bpi", "card"],
  ["+5000 salary", "income"],
  ["y", "yesterday"],
  ["fri", "last Friday"],
  ["9/27", "a date"],
];

/**
 * New entry: one command line, parsed into chips, saved through the one write
 * seam (`src/server/writes.ts`). Until budgettracker ships the DENSE source,
 * the page parses and previews and Save stays disabled with the reason shown.
 */
export default async function NewEntryPage() {
  const user = await requireCurrentUser();
  const context = await fetchEntryContext(prisma, user.id, { timezoneOffset: user.timezoneOffset });

  return (
    <div className="flex max-w-[760px] flex-col gap-2.5">
      <h1 className="text-title font-semibold">New entry</h1>

      <EntryForm context={context} />

      <Panel title="How a line is read" meta="tokens in any order">
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-label text-muted">
          {HELP.map(([token, meaning]) => (
            <li key={token} className="flex items-center gap-1.5">
              <Kbd>{token}</Kbd> {meaning}
            </li>
          ))}
        </ul>
        <p className="mt-2 mb-0 text-label text-muted">
          A word that matches two categories, labels or cards is never guessed: both are ringed, pick
          one. The chips, not the text, are what gets saved.
        </p>
      </Panel>
    </div>
  );
}
