import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { calendarDays, fetchDailySpend } from "./daily-spend";

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

const row = (date: string, amount: number) => ({ amount, date: new Date(date) });

/** Mid-month in Manila (4 September, 14:00), so a September window is still running. */
const NOW = new Date("2026-09-04T06:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("calendarDays", () => {
  it("includes both ends and crosses a month boundary", () => {
    expect(calendarDays("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("fetchDailySpend", () => {
  const params = { timezoneOffset: MANILA, month: "2026-09" };

  it("fills a day with nothing logged rather than skipping it", async () => {
    const rows = [row("2026-08-31T16:30:00.000Z", 100), row("2026-09-03T04:00:00.000Z", 50)];

    const { days } = await fetchDailySpend(fakePrisma(rows), "u1", params);

    expect(days.map((d) => [d.day, d.amount])).toEqual([
      ["2026-09-01", 100],
      ["2026-09-02", 0],
      ["2026-09-03", 50],
      ["2026-09-04", 0],
    ]);
  });

  it("stops at the user's today instead of drawing the rest of the month at zero", async () => {
    const { days, period } = await fetchDailySpend(fakePrisma([]), "u1", params);

    expect(days.at(-1)).toMatchObject({ day: "2026-09-04", isToday: true });
    expect(period.to).toBe("2026-09-30");
    expect(period.isPartial).toBe(true);
  });

  it("runs to the window's own last day once the month has finished", async () => {
    const { days } = await fetchDailySpend(fakePrisma([]), "u1", {
      ...params,
      month: "2026-08",
    });

    expect(days).toHaveLength(31);
    expect(days.at(-1)?.day).toBe("2026-08-31");
  });

  it("accumulates the burn line and the total from the same figures", async () => {
    const rows = [
      row("2026-09-01T04:00:00.000Z", 10),
      row("2026-09-02T04:00:00.000Z", 20),
      row("2026-09-02T05:00:00.000Z", 5),
    ];

    const { days, total } = await fetchDailySpend(fakePrisma(rows), "u1", params);

    expect(days.map((d) => d.cumulative)).toEqual([10, 35, 35, 35]);
    expect(total).toBe(35);
  });

  it("queries the window in the user's timezone", async () => {
    const captured: { where?: unknown } = {};
    await fetchDailySpend(fakePrisma([], captured), "u1", params);

    expect(captured.where).toMatchObject({
      userId: "u1",
      type: "EXPENSE",
      date: {
        gte: new Date("2026-08-31T16:00:00.000Z"),
        lte: new Date("2026-09-30T15:59:59.999Z"),
      },
    });
  });

  it("returns no days for a window entirely in the future", async () => {
    const { days, total } = await fetchDailySpend(fakePrisma([]), "u1", {
      ...params,
      month: "2026-12",
    });

    expect(days).toEqual([]);
    expect(total).toBe(0);
  });

  it("refuses an open window, which has no burn line to draw", async () => {
    await expect(
      fetchDailySpend(fakePrisma([]), "u1", { timezoneOffset: MANILA, from: "2026-09-01" }),
    ).rejects.toThrow(RangeError);
  });
});
