import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { fetchCategoryByMonth, localMonth, matrixSpan } from "./category-by-month";

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

function row(date: string, amount: number, categoryId = "c1", name = "Food") {
  return {
    amount,
    date: new Date(date),
    categoryId,
    category: { name, color: "#f00", icon: "utensils" },
  };
}

describe("localMonth", () => {
  it("puts a late-evening Manila transaction in the month the user saw", () => {
    // 00:30 on 1 October in Manila, stored as 30 September in UTC.
    expect(localMonth(new Date("2026-09-30T16:30:00.000Z"), MANILA)).toBe("2026-10");
    expect(localMonth(new Date("2026-09-30T16:30:00.000Z"), 0)).toBe("2026-09");
  });
});

describe("matrixSpan", () => {
  it("spans whole Manila months, ending at the month asked for", () => {
    const span = matrixSpan({ timezoneOffset: MANILA, endMonth: "2026-09", months: 3 });

    expect(span.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(span.startDate.toISOString()).toBe("2026-06-30T16:00:00.000Z");
    expect(span.endDate.toISOString()).toBe("2026-09-30T15:59:59.999Z");
  });

  it("defaults to the user's current month, which UTC can disagree about", () => {
    const span = matrixSpan({ timezoneOffset: MANILA, months: 1 });

    expect(span.months).toHaveLength(1);
    expect(span.months[0]).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("fetchCategoryByMonth", () => {
  const params = { timezoneOffset: MANILA, endMonth: "2026-09", months: 3 };

  it("queries only expenses inside the span", async () => {
    const captured: { where?: unknown } = {};
    await fetchCategoryByMonth(fakePrisma([], captured), "u1", params);

    expect(captured.where).toMatchObject({
      userId: "u1",
      type: "EXPENSE",
      date: {
        gte: new Date("2026-06-30T16:00:00.000Z"),
        lte: new Date("2026-09-30T15:59:59.999Z"),
      },
    });
  });

  it("places each amount in the user's own month column", async () => {
    const rows = [
      row("2026-07-05T04:00:00.000Z", 100),
      row("2026-08-31T16:30:00.000Z", 40), // 1 September in Manila
      row("2026-09-02T04:00:00.000Z", 60),
    ];

    const matrix = await fetchCategoryByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.rows[0]?.amounts).toEqual([100, 0, 100]);
    expect(matrix.monthTotals).toEqual([100, 0, 100]);
    expect(matrix.total).toBe(200);
  });

  it("keeps a column at zero rather than omitting a month with nothing logged", async () => {
    const matrix = await fetchCategoryByMonth(fakePrisma([row("2026-09-02T04:00:00.000Z", 10)]), "u1", params);

    expect(matrix.months).toHaveLength(3);
    expect(matrix.rows[0]?.amounts).toEqual([0, 0, 10]);
  });

  it("orders categories by their total across the span, largest first", async () => {
    const rows = [
      row("2026-09-02T04:00:00.000Z", 10, "c1", "Food"),
      row("2026-08-02T04:00:00.000Z", 500, "c2", "Rent"),
    ];

    const matrix = await fetchCategoryByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.rows.map((r) => r.name)).toEqual(["Rent", "Food"]);
  });

  it("rounds once per cell, so centavo noise cannot accumulate", async () => {
    const rows = [
      row("2026-09-02T04:00:00.000Z", 0.004),
      row("2026-09-03T04:00:00.000Z", 0.004),
      row("2026-09-04T04:00:00.000Z", 0.004),
    ];

    const matrix = await fetchCategoryByMonth(fakePrisma(rows), "u1", params);

    expect(matrix.rows[0]?.amounts[2]).toBe(0.01);
    expect(matrix.total).toBe(0.01);
  });

  it("drops a row that falls outside the span rather than folding it into an edge column", async () => {
    const matrix = await fetchCategoryByMonth(
      fakePrisma([row("2026-06-15T04:00:00.000Z", 999)]),
      "u1",
      params,
    );

    expect(matrix.rows).toEqual([]);
    expect(matrix.total).toBe(0);
  });
});
