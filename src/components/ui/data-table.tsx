import type { ReactNode } from "react";

export interface Column<Row> {
  key: string;
  header: ReactNode;
  /** Right-align: every numeric column does (`.d-t .r`). */
  align?: "left" | "right";
  /** Mono + tabular numerals for the cell. Implied by `align: "right"` figures. */
  numeric?: boolean;
  /** Hide below 700px, the way `.hide-m` does. */
  hideBelow?: "wide";
  /** Clamp and ellipsis, for description columns (`.d-t .desc`). */
  truncate?: boolean;
  cell: (row: Row) => ReactNode;
}

export interface TableSection<Row> {
  key: string;
  /** The subtotal row's label, spanning the leading columns (`tr.sub`). */
  label: ReactNode;
  /** Right-aligned figure on the subtotal row. */
  total?: ReactNode;
  rows: Row[];
}

export interface DataTableProps<Row> {
  columns: readonly Column<Row>[];
  /** Flat rows, or `sections` for day-grouped ledgers. One or the other. */
  rows?: readonly Row[];
  sections?: readonly TableSection<Row>[];
  rowKey: (row: Row) => string;
  /** A final bold row with a rule above it (`tr.tot`). */
  footer?: { label: ReactNode; cells: ReactNode[] };
  /** Shown instead of the body when there is nothing to list. */
  empty?: ReactNode;
  /** Header row is sticky by default; turn it off inside a short panel. */
  stickyHeader?: boolean;
  /**
   * Hide the header row visually, the way the mockup's "Recent" panel does.
   * The `<thead>` is still rendered, off-screen, so the columns stay named for
   * a screen reader: the point is density, not stripping the table's meaning.
   */
  hideHeader?: boolean;
  caption?: string;
}

const alignClass = (column: Column<unknown>) => (column.align === "right" ? "text-right" : "");

const cellClass = <Row,>(column: Column<Row>) =>
  [
    "h-row border-b border-rule-2 px-2.5 whitespace-nowrap",
    column.align === "right" ? "text-right" : "",
    column.numeric ? "tnum text-figure" : "",
    column.truncate ? "max-w-[260px] overflow-hidden text-ellipsis" : "",
    column.hideBelow === "wide" ? "hidden wide:table-cell" : "",
  ]
    .filter(Boolean)
    .join(" ");

/**
 * The table from the mockup (`.d-t`): 28px rows, a sticky muted header, 1px
 * rules between rows, numbers right-aligned in mono.
 *
 * Server-rendered. Row selection (`j`/`k`) is layered on by wrapping this in
 * `<RowSelection>`, which works off the `data-row` attributes written here.
 */
export function DataTable<Row>({
  columns,
  rows,
  sections,
  rowKey,
  footer,
  empty,
  stickyHeader = true,
  hideHeader = false,
  caption,
}: DataTableProps<Row>) {
  const body = sections ?? (rows ? [{ key: "all", label: null, rows }] : []);
  const isEmpty = body.every((section) => section.rows.length === 0);

  if (isEmpty && empty) return <>{empty}</>;

  const renderRow = (row: Row) => (
    <tr key={rowKey(row)} data-row data-row-key={rowKey(row)} className="group hover:bg-accent-soft data-[selected]:bg-accent-soft">
      {columns.map((column) => (
        <td key={column.key} className={cellClass(column)}>
          {column.cell(row)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className={hideHeader ? "sr-only" : ""}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "border-b border-rule bg-panel px-2.5 py-[5px] text-meta font-medium text-muted whitespace-nowrap",
                  column.align === "right" ? "text-right" : "text-left",
                  column.hideBelow === "wide" ? "hidden wide:table-cell" : "",
                  stickyHeader && !hideHeader ? "sticky top-0 z-1" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {body.map((section) =>
            section.label === null ? (
              section.rows.map(renderRow)
            ) : (
              <SectionRows
                key={section.key}
                section={section}
                columns={columns}
                rowKey={rowKey}
                renderRow={renderRow}
              />
            ),
          )}
        </tbody>

        {footer ? (
          <tfoot>
            <tr>
              <th
                scope="row"
                className="h-row border-t border-rule px-2.5 text-left font-semibold whitespace-nowrap"
              >
                {footer.label}
              </th>
              {footer.cells.map((cell, index) => {
                const column = columns[index + 1];
                return (
                  <td
                    key={column?.key ?? index}
                    className={`h-row border-t border-rule px-2.5 font-semibold whitespace-nowrap ${
                      column ? alignClass(column as Column<unknown>) : "text-right"
                    } ${column?.numeric ? "tnum text-figure" : ""}`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** A day group: one subtotal row (`tr.sub`) followed by its rows. */
function SectionRows<Row>({
  section,
  columns,
  renderRow,
}: {
  section: TableSection<Row>;
  columns: readonly Column<Row>[];
  rowKey: (row: Row) => string;
  renderRow: (row: Row) => ReactNode;
}) {
  const trailing = section.total === undefined ? 0 : 1;
  const span = Math.max(columns.length - trailing, 1);

  return (
    <>
      <tr data-section className="bg-bg">
        <th
          scope="colgroup"
          colSpan={span}
          className="h-subrow border-b border-rule-2 px-2.5 text-left font-medium text-muted whitespace-nowrap"
        >
          {section.label}
        </th>
        {trailing ? (
          <td className="h-subrow border-b border-rule-2 px-2.5 text-right tnum text-figure font-medium text-muted">
            {section.total}
          </td>
        ) : null}
      </tr>
      {section.rows.map(renderRow)}
    </>
  );
}

/** A category/label colour chip (`.d-t .sw`). */
export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block size-[7px] rounded-[1px] align-middle"
      style={{ background: color }}
    />
  );
}

/** The inline share bar in the Labels table (`.d-t .bar`). */
export function ShareBar({ share, width = 60 }: { share: number; width?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 rounded-[1px] bg-accent align-middle opacity-80"
      style={{ width: `${Math.max(share, 0) * width}px` }}
    />
  );
}

/** A label pill inside a cell (`.d-tok`). */
export function Token({ children }: { children: ReactNode }) {
  return (
    <span className="mr-[3px] inline-block rounded-chip border border-rule px-1 text-label text-muted">
      {children}
    </span>
  );
}
