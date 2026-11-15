import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BurnChart, dayPosition } from "./burn-chart";

describe("dayPosition", () => {
  it("spans the whole month, not just the days logged so far", () => {
    expect(dayPosition(1, 30, 520)).toBe(0);
    expect(dayPosition(30, 30, 520)).toBe(520);
    expect(dayPosition(15, 30, 290)).toBeCloseTo(140, 5);
  });

  it("puts a one-day month at the right edge", () => {
    expect(dayPosition(1, 1, 520)).toBe(520);
  });
});

describe("BurnChart in a running month", () => {
  // Day 15 of a 30-day month, exactly on pace for a 30,000 budget.
  const cumulative = Array.from({ length: 15 }, (_, index) => ({
    day: index + 1,
    spent: (index + 1) * 1000,
    daySpend: 1000,
  }));
  const html = renderToStaticMarkup(
    <BurnChart cumulative={cumulative} budget={30_000} daysInMonth={30} width={290} height={100} />,
  );

  it("ends the spending line at today, halfway across", () => {
    const line = /<polyline points="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(line.split(" ").at(-1)).toBe("140.0,53.7");
  });

  it("ends the pace line at the month's last day", () => {
    const lines = [...html.matchAll(/<line [^>]*x2="([\d.]+)"/g)].map((match) => Number(match[1]));
    expect(lines).toEqual([290, 290]);
  });
});
