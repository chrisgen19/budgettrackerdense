import { Panel } from "@/components/ui/panel";
import { SkeletonLine } from "@/components/ui/states";

/** The page's own shape in grey, so nothing moves when the data lands. */
export default function LabelsLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading labels">
      <div className="h-7 w-24 rounded-[2px] bg-sk" />

      <Panel title={<span className="inline-block h-3 w-28 rounded-[2px] bg-sk" />} flush>
        <div className="px-2.5">
          {Array.from({ length: 10 }, (_, row) => (
            <SkeletonLine key={row} width={row === 9 ? "45%" : "100%"} />
          ))}
        </div>
      </Panel>

      <Panel title="Six months" flush>
        <div className="px-2.5">
          {Array.from({ length: 9 }, (_, row) => (
            <SkeletonLine key={row} width={row === 8 ? "45%" : "100%"} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
