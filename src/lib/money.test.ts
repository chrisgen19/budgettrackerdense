import { describe, expect, it } from "vitest";
import { MINUS, formatAmount, formatMoney, formatMoneyCompact, formatPercent } from "./money";

describe("formatMoney", () => {
  it("formats the mockup's figures", () => {
    expect(formatMoney(81578.35)).toBe("₱81,578.35");
    expect(formatMoney(79000, { dp: 0 })).toBe("₱79,000");
    expect(formatMoney(241)).toBe("₱241.00");
  });

  it("uses U+2212 for negatives, outside the symbol", () => {
    expect(formatMoney(-2578.35)).toBe(`${MINUS}₱2,578.35`);
    expect(MINUS).toBe("−");
    expect(formatMoney(-1).includes("-")).toBe(false);
  });

  it("adds a plus only when asked", () => {
    expect(formatMoney(1624.69, { sign: true })).toBe("+₱1,624.69");
    expect(formatMoney(1624.69)).toBe("₱1,624.69");
    expect(formatMoney(0, { sign: true })).toBe("₱0.00");
  });

  it("honours a different currency symbol", () => {
    expect(formatMoney(10, { symbol: "$" })).toBe("$10.00");
  });
});

describe("formatAmount", () => {
  it("drops the symbol but keeps sign and grouping", () => {
    expect(formatAmount(79953.66)).toBe("79,953.66");
    expect(formatAmount(-6096, { dp: 0 })).toBe(`${MINUS}6,096`);
  });
});

describe("formatMoneyCompact", () => {
  it("switches to thousands at 1000 and drops the decimal at 10000", () => {
    expect(formatMoneyCompact(999)).toBe("₱999");
    expect(formatMoneyCompact(1000)).toBe("₱1.0k");
    expect(formatMoneyCompact(9999)).toBe("₱10.0k");
    expect(formatMoneyCompact(10_000)).toBe("₱10k");
    expect(formatMoneyCompact(-81_578)).toBe(`${MINUS}₱82k`);
  });
});

describe("formatPercent", () => {
  it("rounds and signs", () => {
    expect(formatPercent(1.03)).toBe("103%");
    expect(formatPercent(0.11, { sign: true })).toBe("+11%");
    expect(formatPercent(-0.034)).toBe(`${MINUS}3%`);
    expect(formatPercent(0)).toBe("0%");
  });
});
