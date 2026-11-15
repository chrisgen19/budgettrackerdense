import { describe, expect, it } from "vitest";
import { overBudgetFigures, planFigures } from "./overview";

describe("planFigures", () => {
  it("is null only when no plan exists", () => {
    expect(planFigures(false, 0, 5_000, 30)).toBeNull();
  });

  it("keeps a plan with no expense allocations as a plan of zero", () => {
    expect(planFigures(true, 0, 5_000, 30)).toEqual({
      planned: 0,
      remaining: -5_000,
      usedPct: null,
      pace: 0,
    });
  });

  it("works out the usual figures for a funded plan", () => {
    expect(planFigures(true, 30_000, 12_000, 30)).toEqual({
      planned: 30_000,
      remaining: 18_000,
      usedPct: 0.4,
      pace: 1_000,
    });
  });
});

describe("overBudgetFigures", () => {
  it("flags any spending against a zero plan, without dividing by zero", () => {
    const budget = planFigures(true, 0, 5_000, 30);
    expect(overBudgetFigures(budget, 5_000, 10_000, "2026-11-03")).toEqual({
      amountOver: 5_000,
      dayCrossed: "2026-11-03",
      projected: 10_000,
      overBy: null,
    });
  });

  it("gives the projected overshoot as a ratio of the plan", () => {
    const budget = planFigures(true, 30_000, 33_000, 30);
    expect(overBudgetFigures(budget, 33_000, 36_000, "2026-11-20")?.overBy).toBeCloseTo(0.2, 10);
  });

  it("is null within the plan or with no plan", () => {
    expect(overBudgetFigures(planFigures(true, 30_000, 12_000, 30), 12_000, 25_000, null)).toBeNull();
    expect(overBudgetFigures(null, 12_000, 25_000, null)).toBeNull();
  });
});
