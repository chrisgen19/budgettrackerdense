import { Panel } from "@/components/ui/panel";
import { SkeletonBlock, SkeletonLines } from "@/components/ui/states";

/**
 * The page's own shape in grey, not a spinner.
 *
 * The layout is what this design is for, so nothing should move when the data
 * lands: the KPI strip keeps its six cells, and each panel keeps its height.
 */
export default function OverviewLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the overview">
      <div className="h-7 w-32 rounded-[2px] bg-sk" />

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

      <div className="grid gap-2.5 desk:grid-cols-[1.6fr_1fr]">
        <Panel title="Cumulative spend vs budget">
          <SkeletonBlock height={160} />
          <div className="mt-2">
            <SkeletonBlock height={34} />
          </div>
        </Panel>
        <Panel title="Recent">
          <SkeletonLines lines={9} />
        </Panel>
      </div>

      <div className="grid gap-2.5 desk:grid-cols-3">
        <Panel title="Categories">
          <SkeletonLines lines={8} />
        </Panel>
        <Panel title="Labels">
          <SkeletonLines lines={6} />
        </Panel>
        <Panel title="Payment sources">
          <SkeletonLines lines={3} />
        </Panel>
      </div>
    </div>
  );
}
