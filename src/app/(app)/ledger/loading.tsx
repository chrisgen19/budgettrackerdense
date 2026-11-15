import { Panel } from "@/components/ui/panel";
import { SkeletonLine } from "@/components/ui/states";

/**
 * The page's own shape in grey: a filter bar, then fifty rows at their real
 * height, so the table does not jump when the data lands.
 */
export default function LedgerLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the ledger">
      <div className="h-7 w-24 rounded-[2px] bg-sk" />

      <div className="mb-2 flex flex-col gap-1.5">
        <div className="h-control rounded-panel bg-sk" />
        <div className="flex gap-1">
          {Array.from({ length: 6 }, (_, chip) => (
            <div key={chip} className="h-control w-20 rounded-panel bg-sk" />
          ))}
        </div>
      </div>

      <Panel title="Ledger" flush>
        <div className="px-2.5">
          {Array.from({ length: 14 }, (_, row) => (
            <SkeletonLine key={row} width={row % 5 === 0 ? "40%" : "100%"} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
