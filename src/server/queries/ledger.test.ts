import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { fetchLedger, type LedgerParams } from "./ledger";

const MANILA = -480;

interface Captured {
  where?: unknown;
  findMany?: Record<string, unknown>;
}

/** The three calls `fetchLedger` makes, with rows supplied by the test. */
function fakePrisma(rows: unknown[], captured: Captured = {}) {
  return {
    transaction: {
      count: async ({ where }: { where: unknown }) => {
        captured.where = where;
        return rows.length;
      },
      groupBy: async () => [
        { type: "EXPENSE", _sum: { amount: 1234.56 } },
        { type: "INCOME", _sum: { amount: 100 } },
      ],
      findMany: async (args: Record<string, unknown>) => {
        captured.findMany = args;
        return rows;
      },
    },
  } as unknown as PrismaClient;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    amount: 250,
    description: "Jollibee",
    type: "EXPENSE",
    date: new Date("2026-09-10T04:00:00.000Z"),
    categoryId: "c1",
    category: { name: "Food", icon: "utensils", color: "#f00" },
    creditAccountId: null,
    creditAccount: null,
    receiptGroupId: null,
    labels: [],
    ...overrides,
  };
}

const params: LedgerParams = { timezoneOffset: MANILA, month: "2026-09" };

describe("fetchLedger", () => {
  it("filters on the user's own month, both bounds inclusive", async () => {
    const captured: Captured = {};
    await fetchLedger(fakePrisma([], captured), "u1", params);

    expect(captured.where).toMatchObject({
      userId: "u1",
      date: {
        gte: new Date("2026-08-31T16:00:00.000Z"),
        lte: new Date("2026-09-30T15:59:59.999Z"),
      },
    });
  });

  it("filters by label, which the shared searchTransactions cannot", async () => {
    const captured: Captured = {};
    await fetchLedger(fakePrisma([], captured), "u1", { ...params, labelIds: ["l1", "l2"] });

    expect(captured.where).toMatchObject({ labels: { some: { labelId: { in: ["l1", "l2"] } } } });
  });

  it("treats an empty label list as unset rather than as 'match nothing'", async () => {
    const captured: Captured = {};
    await fetchLedger(fakePrisma([], captured), "u1", { ...params, labelIds: [] });

    expect(captured.where).not.toHaveProperty("labels");
  });

  it("filters by card, and by 'no card' for cash-only review", async () => {
    const byCard: Captured = {};
    await fetchLedger(fakePrisma([], byCard), "u1", { ...params, creditAccountId: "card1" });
    expect(byCard.where).toMatchObject({ creditAccountId: "card1" });

    const cashOnly: Captured = {};
    await fetchLedger(fakePrisma([], cashOnly), "u1", { ...params, creditAccountId: "none" });
    expect(cashOnly.where).toMatchObject({ creditAccountId: null });
  });

  it("groups rows by the user's calendar day, not by the stored UTC day", async () => {
    // 00:30 on 11 September in Manila, stored as the 10th in UTC.
    const rows = [
      row({ id: "a", date: new Date("2026-09-10T16:30:00.000Z"), amount: 100 }),
      row({ id: "b", date: new Date("2026-09-10T04:00:00.000Z"), amount: 50 }),
    ];

    const ledger = await fetchLedger(fakePrisma(rows), "u1", params);

    expect(ledger.rows.map((r) => r.localDate)).toEqual(["2026-09-11", "2026-09-10"]);
    expect(ledger.days.map((d) => d.day)).toEqual(["2026-09-11", "2026-09-10"]);
    expect(ledger.days.map((d) => d.expenses)).toEqual([100, 50]);
  });

  it("separates income from expenses in a day's subtotal", async () => {
    const rows = [
      row({ id: "a", type: "INCOME", amount: 2000 }),
      row({ id: "b", type: "EXPENSE", amount: 300 }),
    ];

    const [day] = (await fetchLedger(fakePrisma(rows), "u1", params)).days;

    expect(day).toMatchObject({ income: 2000, expenses: 300 });
  });

  it("reports totals over every match, not over the page", async () => {
    const ledger = await fetchLedger(fakePrisma([row()]), "u1", { ...params, limit: 1 });

    expect(ledger.totals).toEqual({ count: 1, income: 100, expenses: 1234.56, net: -1134.56 });
  });

  it("pages without letting a bad limit reverse or empty the window", async () => {
    const captured: Captured = {};
    await fetchLedger(fakePrisma([], captured), "u1", { ...params, page: 3, limit: -5 });

    expect(captured.findMany).toMatchObject({ take: 100, skip: 200 });
  });

  it("caps the page size so one request cannot pull the whole table", async () => {
    const captured: Captured = {};
    await fetchLedger(fakePrisma([], captured), "u1", { ...params, limit: 10_000 });

    expect(captured.findMany).toMatchObject({ take: 500 });
  });
});
