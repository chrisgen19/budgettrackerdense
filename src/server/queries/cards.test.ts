import { describe, expect, it } from "vitest";
import { computeAccountBalance } from "@bt/lib/credit-account-queries";
import { describeCardInterest, utilizationOf } from "@bt/lib/card-interest";

/**
 * The rules the Cards pages have to keep, pinned against the vendored
 * arithmetic they are built on (budgettracker `.claude/rules/cards.md`).
 *
 * These assert the shared contract rather than re-testing budgettracker's own
 * code: if a sync ever changes one of these answers, the pages built on them
 * are wrong and this is where it shows.
 */
describe("a card payment is not a transaction", () => {
  const openingBalance = 74_270.8;
  const totals = { purchases: 7_295.28, payments: 5_000, credits: 0 };

  it("lowers what the card owes, and is never added to spending", () => {
    // What the card owes: the payment comes off.
    expect(computeAccountBalance(openingBalance, totals)).toBe(76_566.08);

    // What was spent on the card: purchases alone. A payment moves money from
    // the bank to the card; counting it here would bill the same peso twice,
    // once as the purchase and once as settling it.
    expect(totals.purchases).toBe(7_295.28);
    expect(totals.purchases + totals.payments).not.toBe(totals.purchases);
  });

  it("a refund the card issues is a credit, not a payment", () => {
    // Both lower the balance, and they are summed separately so an average of
    // what is actually being paid does not count money nobody chose to pay.
    const withCredit = { purchases: 1_000, payments: 0, credits: 400 };
    expect(computeAccountBalance(0, withCredit)).toBe(600);
  });

  it("does not clamp a card that holds a credit", () => {
    expect(computeAccountBalance(0, { purchases: 0, payments: 500, credits: 0 })).toBe(-500);
  });
});

describe("utilization", () => {
  it("is not clamped, so being over the limit is visible", () => {
    expect(utilizationOf(76_566.08, 94_000)).toBe(81.5);
    expect(utilizationOf(101_520, 94_000)).toBe(108);
    expect(utilizationOf(-500, 94_000)).toBe(-0.5);
  });

  it("is null when there is no limit to measure against", () => {
    expect(utilizationOf(5_000, null)).toBeNull();
    expect(utilizationOf(5_000, 0)).toBeNull();
  });
});

describe("interest", () => {
  it("tells an untracked card apart from a month with none", () => {
    // This card: no interest row has ever been logged, so the balance drifts
    // below the statement and a "0" would present that as a free card.
    expect(describeCardInterest({ period: 0, everLogged: false })).toEqual({ state: "untracked" });
    expect(describeCardInterest({ period: 0, everLogged: true })).toEqual({
      state: "none-this-period",
    });
    expect(describeCardInterest({ period: 412.5, everLogged: true })).toEqual({
      state: "charged",
      amount: 412.5,
    });
  });

  it("reports a refunded fee rather than calling the month empty", () => {
    expect(describeCardInterest({ period: -120, everLogged: true })).toEqual({
      state: "charged",
      amount: -120,
    });
  });
});
