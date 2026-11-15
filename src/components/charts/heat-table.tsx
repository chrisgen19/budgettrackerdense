import Link from "next/link";
import { Money } from "@/components/ui/money";
import { Swatch } from "@/components/ui/data-table";

export interface HeatRow {
  name: string;
  /** Hex colour for the leading swatch, when the row is a category. */
  color?: string;
  /** One figure per column, in the same order as `months`. */
  values: readonly number[];
  /** Makes the row's name a link, e.g. to the Ledger filtered by it. */
  href?: string;
}

export interface HeatColumn {
  label: string;
  /** No rows that month: the cell shows a dot, not a zero. */
  empty?: boolean;
}

/**
 * A summary row under the matrix: Total spend, Income, Net.
 *
 * Unshaded, because the heat scale measures one category against another and a
 * column total is a different quantity on the same axis.
 */
export interface HeatSummaryRow {
  label: string;
  /** One figure per column, in the same order as `months`. */
  values: readonly number[];
  /**
   * `signed` colours each cell by its own sign, which is what Net needs;
   * `income` fixes the whole row green; `plain` leaves it in ink.
   */
  tone?: "plain" | "income" | "signed";
  /** Bold with a rule above it, the mockup's `tr.tot`. */
  emphasis?: boolean;
  /** What a month with no rows prints. Blank when omitted. */
  emptyText?: string;
}

export interface HeatTableProps {
  rows: readonly HeatRow[];
  months: readonly HeatColumn[];
  /** Trailing average column, computed over the non-empty months. */
  showAverage?: boolean;
  /** Rows under the matrix, outside the heat scale. */
  summary?: readonly HeatSummaryRow[];
  caption?: string;
  /** The first column's header. Defaults to "Category", what Reports shows. */
  rowHeader?: string;
}

/** The deepest a cell shades, from `report()` in 04-data-dense.html. */
const MAX_SHADE = 0.35;

/**
 * Category by month, shaded by share of the largest cell. Ported from
 * `report()`; the shade is `rgb(var(--heat) / share)` so it re-tints with the
 * theme instead of carrying a baked colour.
 */
export function HeatTable({
  rows,
  months,
  showAverage = true,
  summary,
  caption,
  rowHeader = "Category",
}: HeatTableProps) {
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
              {rowHeader}
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
                  {row.href ? (
                    <Link href={row.href} className="text-ink hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
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

        {summary && summary.length > 0 ? (
          <tfoot>
            {summary.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className={`h-row px-2.5 text-left whitespace-nowrap ${
                    row.emphasis
                      ? "border-t border-rule font-semibold"
                      : "border-b border-rule-2 font-normal"
                  }`}
                >
                  {row.label}
                </th>

                {row.values.map((value, index) => {
                  const month = months[index];
                  return (
                    <td
                      key={month?.label ?? index}
                      className={`h-row px-2.5 text-right tnum text-figure whitespace-nowrap ${
                        row.emphasis
                          ? "border-t border-rule font-semibold"
                          : "border-b border-rule-2"
                      }`}
                    >
                      {month?.empty ? (
                        <span className="text-muted">{row.emptyText ?? ""}</span>
                      ) : (
                        <Money
                          value={value}
                          tone={
                            row.tone === "income"
                              ? "income"
                              : row.tone === "signed"
                                ? value < 0
                                  ? "expense"
                                  : "income"
                                : "plain"
                          }
                          bare
                          dp={0}
                          sign={row.tone === "signed"}
                        />
                      )}
                    </td>
                  );
                })}

                {showAverage ? (
                  <td
                    className={`h-row px-2.5 ${
                      row.emphasis ? "border-t border-rule" : "border-b border-rule-2"
                    }`}
                  />
                ) : null}
              </tr>
            ))}
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
