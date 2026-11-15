import { Panel } from "@/components/ui/panel";
import { SkeletonLine, SkeletonLines } from "@/components/ui/states";

/** The page's own shape in grey, so nothing moves when the data lands. */
export default function BudgetsLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the budget">
      <div className="h-7 w-28 rounded-[2px] bg-sk" />

      <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-panel border border-rule bg-panel desk:grid-cols-6">
        {Array.from({ length: 6 }, (_, cell) => (
          <div
            key={cell}
            className="border-r border-b border-rule-2 px-2.5 py-2 last:border-r-0 desk:border-b-0"
          >
            <div className="my-[9px] h-[10px] w-1/2 rounded-[2px] bg-sk" />
            <div className="my-[9px] h-4 w-4/5 rounded-[2px] bg-sk" />
          </div>
        ))}
      </dl>

      <Panel title="Allocations" flush>
        <div className="px-2.5">
          {Array.from({ length: 8 }, (_, row) => (
            <SkeletonLine key={row} width={row === 7 ? "45%" : "100%"} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-2.5 desk:grid-cols-[1fr_1fr]">
        <Panel title="Safe to spend">
          <SkeletonLines lines={4} />
        </Panel>
        <Panel title="How these figures are counted">
          <SkeletonLines lines={4} />
        </Panel>
      </div>
    </div>
  );
}
