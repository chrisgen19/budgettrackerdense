import { Panel } from "@/components/ui/panel";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/states";

/** The page's own shape in grey, so nothing moves when the data lands. */
export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the reports">
      <div className="h-7 w-28 rounded-[2px] bg-sk" />

      <Panel title="Income / spend">
        <SkeletonBlock height={150} />
      </Panel>

      <Panel title="Category × month" flush>
        <div className="px-2.5">
          {Array.from({ length: 12 }, (_, row) => (
            <SkeletonLine key={row} width={row === 11 ? "55%" : "100%"} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
