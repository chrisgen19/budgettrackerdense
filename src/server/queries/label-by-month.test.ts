import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { UNLABELED_ID, fetchLabelByMonth } from "./label-by-month";

const MANILA = -480;

function fakePrisma(rows: unknown[], captured: { where?: unknown } = {}) {
  return {
    transaction: {
      findMany: async ({ where }: { where: unknown }) => {
        captured.where = where;
        return rows;
      },
    },
  } as unknown as PrismaClient;
}

function row(date: string, amount: number, labels: Array<{ id: string; name: string }> = []) {
  return {
    amount,
    date: new Date(date),
    labels: labels.map((label) => ({ label: { ...label, color: "#0f0" } })),
  };
}

const params = { timezoneOffset: MANILA, endMonth: "2026-09", months: 2 };

describe("fetchLabelByMonth", () => {
  it("counts a multi-label transaction in full under each label", async () => {
    const rows = [
      row("2026-09-02T04:00:00.000Z", 300, [
        { id: "l1", name: "Family Budget" },
        { id: "l2", name: "Shopee" },
      ]),
    ];

    const matrix = await fetchLabelByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.rows.map((r) => [r.name, r.total])).toEqual([
      ["Family Budget", 300],
      ["Shopee", 300],
    ]);
  });

  it("keeps the month total to what was actually spent, despite overlapping labels", async () => {
    const rows = [
      row("2026-09-02T04:00:00.000Z", 300, [
        { id: "l1", name: "Family Budget" },
        { id: "l2", name: "Shopee" },
      ]),
    ];

    const matrix = await fetchLabelByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.monthTotals).toEqual([0, 300]);
    expect(matrix.total).toBe(300);
  });

  it("gives the untagged remainder a row of its own", async () => {
    const rows = [
      row("2026-09-02T04:00:00.000Z", 100, [{ id: "l1", name: "Personal" }]),
      row("2026-09-03T04:00:00.000Z", 250),
    ];

    const matrix = await fetchLabelByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.rows.find((r) => r.id === UNLABELED_ID)?.total).toBe(250);
    expect(matrix.total).toBe(350);
  });

  it("defaults to expenses and takes income only when asked", async () => {
    const expense: { where?: unknown } = {};
    await fetchLabelByMonth(fakePrisma([], expense), "u1", params);
    expect(expense.where).toMatchObject({ type: "EXPENSE" });

    const income: { where?: unknown } = {};
    await fetchLabelByMonth(fakePrisma([], income), "u1", { ...params, type: "INCOME" });
    expect(income.where).toMatchObject({ type: "INCOME" });
  });

  it("columns a transaction by the user's month, not the stored UTC month", async () => {
    const rows = [row("2026-08-31T16:30:00.000Z", 75, [{ id: "l1", name: "TNVS" }])];

    const matrix = await fetchLabelByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.months).toEqual(["2026-08", "2026-09"]);
    expect(matrix.rows[0]?.amounts).toEqual([0, 75]);
  });
});
