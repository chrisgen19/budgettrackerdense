import { Panel } from "@/components/ui/panel";
import { SkeletonLine, SkeletonLines } from "@/components/ui/states";

/** One card's page in grey: two summary panels, then the two lists. */
export default function CardDetailLoading() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading the card">
      <div className="h-7 w-32 rounded-[2px] bg-sk" />

      <div className="grid gap-2.5 desk:grid-cols-[1fr_1fr]">
        <Panel title="Balance">
          <SkeletonLines lines={5} />
        </Panel>
        <Panel title="Card">
          <SkeletonLines lines={7} />
        </Panel>
      </div>

      <div className="grid gap-2.5 desk:grid-cols-[1.6fr_1fr]">
        <Panel title="Purchases" flush>
          <div className="px-2.5">
            {Array.from({ length: 6 }, (_, row) => (
              <SkeletonLine key={row} width={row === 5 ? "50%" : "100%"} />
            ))}
          </div>
        </Panel>
        <Panel title="Payments" flush>
          <div className="px-2.5">
            {Array.from({ length: 3 }, (_, row) => (
              <SkeletonLine key={row} width={row === 2 ? "60%" : "100%"} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
