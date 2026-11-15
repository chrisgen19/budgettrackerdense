import { describe, expect, it } from "vitest";
import type { LabelItem } from "@bt/lib/budget-query-types";
import type { LabelMonthMatrix } from "./label-by-month";
import { buildLabelRows } from "./labels";

const label = (id: string, name: string): LabelItem => ({
  id,
  name,
  color: "#0f0",
  applicableTo: "EXPENSE",
  transactionCount: 0,
  schedules: [],
});

const matrix: LabelMonthMatrix = {
  months: ["2026-08", "2026-09"],
  rows: [
    { id: "l1", name: "Family", color: "#f00", icon: "", amounts: [100, 300], total: 400, counts: [1, 3], count: 4 },
    { id: "l2", name: "TNVS", color: "#0ff", icon: "", amounts: [50, 300], total: 350, counts: [1, 2], count: 3 },
    { id: "unlabeled", name: "Unlabeled", color: "#64748b", icon: "", amounts: [0, 400], total: 400, counts: [0, 4], count: 4 },
    { id: "gone", name: "Old label", color: "#999", icon: "", amounts: [20, 0], total: 20, counts: [1, 0], count: 1 },
  ],
  // September: 300 tagged Family + TNVS on one row, 400 untagged. Spent 700, not 1,000.
  monthTotals: [170, 700],
  total: 870,
};

describe("buildLabelRows", () => {
  const rows = buildLabelRows(matrix, [label("l1", "Family"), label("l2", "TNVS"), label("l3", "Unused")]);

  it("takes the month shown from the last column", () => {
    const family = rows.find((r) => r.id === "l1");
    expect(family).toMatchObject({ amount: 300, count: 3, windowTotal: 400, windowCount: 4 });
    expect(family?.trend).toEqual([100, 300]);
  });

  it("shares against everything spent, so overlapping labels can sum past 100%", () => {
    const shares = rows.filter((r) => r.id === "l1" || r.id === "l2").map((r) => r.share);
    expect(shares).toEqual([300 / 700, 300 / 700]);
    expect(rows.reduce((sum, r) => sum + r.share, 0)).toBeGreaterThan(1);
  });

  it("keeps a label with nothing in the window, as zero", () => {
    expect(rows.find((r) => r.id === "l3")).toMatchObject({ amount: 0, count: 0, trend: [0, 0] });
  });

  it("keeps a deleted label that still has rows, without an applicableTo", () => {
    expect(rows.find((r) => r.id === "gone")).toMatchObject({ windowTotal: 20, applicableTo: null });
  });

  it("orders by the month, then the window, with unlabeled always last", () => {
    expect(rows.map((r) => r.id)).toEqual(["l1", "l2", "gone", "l3", "unlabeled"]);
  });

  it("gives zero shares in a month with nothing spent", () => {
    const empty = { ...matrix, monthTotals: [170, 0] };
    expect(buildLabelRows(empty, [label("l1", "Family")]).every((r) => r.share === 0)).toBe(true);
  });
});
