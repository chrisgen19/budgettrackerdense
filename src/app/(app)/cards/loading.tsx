import { Panel } from "@/components/ui/panel";
import { SkeletonLine } from "@/components/ui/states";

/** The list's own shape in grey, so the table does not jump when it lands. */
export default function CardsLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the cards">
      <div className="h-7 w-20 rounded-[2px] bg-sk" />

      <Panel title="Balances" flush>
        <div className="px-2.5">
          {Array.from({ length: 4 }, (_, row) => (
            <SkeletonLine key={row} width={row === 3 ? "45%" : "100%"} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
