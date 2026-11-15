import { SkeletonLine } from "@/components/ui/states";

const ROWS = ["Amount", "Type", "Category", "Labels", "Source", "Note", "Date"];

/** The page's own shape in grey: the command line, then the parse table's rows. */
export default function NewEntryLoading() {
  return (
    <div className="flex max-w-[760px] flex-col gap-2.5" aria-busy="true" aria-label="Loading New entry">
      <div className="h-7 w-32 rounded-[2px] bg-sk" />

      <div>
        <div className="flex h-12 items-center rounded-panel border-2 border-rule bg-panel px-2.5">
          <div className="h-3 w-2/3 rounded-[2px] bg-sk" />
        </div>
        <dl className="m-0 grid grid-cols-[76px_minmax(0,1fr)] border-x border-b border-rule bg-panel wide:grid-cols-[90px_minmax(0,1fr)]">
          {ROWS.map((term) => (
            <div key={term} className="contents">
              <dt className="m-0 border-t border-rule-2 px-2.5 py-1.5 text-muted">{term}</dt>
              <dd className="m-0 border-t border-rule-2 px-2.5 py-1">
                <SkeletonLine width={term === "Note" || term === "Date" ? "40%" : "80%"} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
