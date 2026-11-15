import { Money } from "@/components/ui/money";
import { Swatch } from "@/components/ui/data-table";

export interface HeatRow {
  name: string;
  /** Hex colour for the leading swatch, when the row is a category. */
  color?: string;
  /** One figure per column, in the same order as `months`. */
  values: readonly number[];
}

export interface HeatColumn {
  label: string;
  /** No rows that month: the cell shows a dot, not a zero. */
  empty?: boolean;
}

export interface HeatTableProps {
  rows: readonly HeatRow[];
  months: readonly HeatColumn[];
  /** Trailing average column, computed over the non-empty months. */
  showAverage?: boolean;
  caption?: string;
}

/** The deepest a cell shades, from `report()` in 04-data-dense.html. */
const MAX_SHADE = 0.35;

/**
 * Category by month, shaded by share of the largest cell. Ported from
 * `report()`; the shade is `rgb(var(--heat) / share)` so it re-tints with the
 * theme instead of carrying a baked colour.
 */
export function HeatTable({ rows, months, showAverage = true, caption }: HeatTableProps) {
  const max = Math.max(...rows.flatMap((row) => [...row.values]), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 z-1 border-b border-rule bg-panel px-2.5 py-[5px] text-left text-meta font-medium text-muted whitespace-nowrap"
            >
              Category
            </th>
            {months.map((month) => (
              <th
                key={month.label}
                scope="col"
                className="sticky top-0 z-1 border-b border-rule bg-panel px-2.5 py-[5px] text-right text-meta font-medium text-muted whitespace-nowrap"
              >
                {month.label}
              </th>
            ))}
            {showAverage ? (
              <th
                scope="col"
                className="sticky top-0 z-1 border-b border-rule bg-panel px-2.5 py-[5px] text-right text-meta font-medium text-muted"
              >
                Avg
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const real = row.values.filter((_, index) => !months[index]?.empty);
            const average = real.length
              ? real.reduce((sum, value) => sum + value, 0) / real.length
              : 0;

            return (
              <tr key={row.name}>
                <th
                  scope="row"
                  className="h-row border-b border-rule-2 px-2.5 text-left font-normal whitespace-nowrap"
                >
                  {row.color ? <Swatch color={row.color} /> : null}
                  {row.name}
                </th>

                {row.values.map((value, index) => {
                  const month = months[index];
                  return (
                    <td
                      key={month?.label ?? index}
                      className="h-row border-b border-rule-2 px-2.5 text-right tnum text-figure whitespace-nowrap"
                      style={{ background: `rgb(var(--heat) / ${((value / max) * MAX_SHADE).toFixed(3)})` }}
                    >
                      {month?.empty ? (
                        <span className="text-muted">·</span>
                      ) : value ? (
                        <Money value={value} bare dp={0} />
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                  );
                })}

                {showAverage ? (
                  <td className="h-row border-b border-rule-2 px-2.5 text-right tnum text-figure text-muted whitespace-nowrap">
                    <Money value={average} tone="muted" bare dp={0} />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
