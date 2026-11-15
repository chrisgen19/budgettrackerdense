import { describe, expect, it } from "vitest";
import {
  type LedgerFilters,
  isUnfiltered,
  ledgerHref,
  parseLedgerFilters,
  toggleLabel,
  toggleValue,
  toSearchParams,
  windowOf,
} from "./ledger-filters";

const MANILA = -480;
/** 2026-09-28 22:36 Manila, which is 14:36 UTC. */
const NOW = new Date(Date.UTC(2026, 8, 28, 14, 36));

const parse = (params: Record<string, string | string[] | undefined>) =>
  parseLedgerFilters(params, { timezoneOffset: MANILA, now: NOW });

describe("parseLedgerFilters: the date window", () => {
  it("defaults to the user's current month", () => {
    const filters = parse({});
    expect(filters).toMatchObject({ range: "month", month: "2026-09", from: null, to: null });
  });

  it("reads the month in the user's timezone, not UTC's", () => {
    // 30 Sep 17:30 UTC is already 1 Oct in Manila.
    const rollover = new Date(Date.UTC(2026, 8, 30, 17, 30));
    expect(parseLedgerFilters({}, { timezoneOffset: MANILA, now: rollover }).month).toBe("2026-10");
    expect(parseLedgerFilters({}, { timezoneOffset: 0, now: rollover }).month).toBe("2026-09");
  });

  it("resolves `today` to the user's local day", () => {
    expect(parse({ range: "today" })).toMatchObject({
      range: "today",
      from: "2026-09-28",
      to: "2026-09-28",
      month: null,
    });
  });

  it("resolves `7d` to seven days ending today, inclusive", () => {
    expect(parse({ range: "7d" })).toMatchObject({
      range: "7d",
      from: "2026-09-22",
      to: "2026-09-28",
    });
  });

  it("takes an explicit range over a month, as the shared queries require", () => {
    expect(parse({ from: "2026-09-01", to: "2026-09-07", month: "2026-08" })).toMatchObject({
      range: "custom",
      from: "2026-09-01",
      to: "2026-09-07",
      month: null,
    });
  });

  it("accepts a half-open custom range", () => {
    expect(parse({ from: "2026-09-10" })).toMatchObject({ range: "custom", from: "2026-09-10", to: null });
    expect(parse({ to: "2026-09-10" })).toMatchObject({ range: "custom", from: null, to: "2026-09-10" });
  });

  it("falls back to the month rather than erroring on junk", () => {
    expect(parse({ month: "September" }).month).toBe("2026-09");
    expect(parse({ from: "28/09/2026" })).toMatchObject({ range: "month", month: "2026-09" });
    expect(parse({ from: "2026-02-31" })).toMatchObject({ range: "month" });
    expect(parse({ range: "fortnight" })).toMatchObject({ range: "month" });
  });
});

describe("parseLedgerFilters: the other filters", () => {
  it("reads every filter", () => {
    const filters = parse({
      q: " coffee ",
      cat: "cat_1",
      label: ["lab_1", "lab_2"],
      card: "card_1",
      type: "income",
      min: "100",
      max: "2000.50",
      page: "3",
    });

    expect(filters).toMatchObject({
      search: "coffee",
      categoryId: "cat_1",
      labelIds: ["lab_1", "lab_2"],
      card: "card_1",
      type: "INCOME",
      amountMin: 100,
      amountMax: 2000.5,
      page: 3,
    });
  });

  it("accepts labels as a comma-separated list and de-duplicates", () => {
    expect(parse({ label: "lab_1,lab_2,lab_1" }).labelIds).toEqual(["lab_1", "lab_2"]);
    expect(parse({ label: ["lab_1", "lab_1"] }).labelIds).toEqual(["lab_1"]);
  });

  it("drops filters it cannot read", () => {
    expect(parse({ q: "   " }).search).toBeNull();
    expect(parse({ type: "transfer" }).type).toBeNull();
    expect(parse({ min: "-5" }).amountMin).toBeNull();
    expect(parse({ max: "lots" }).amountMax).toBeNull();
    expect(parse({ page: "0" }).page).toBe(1);
    expect(parse({ page: "-2" }).page).toBe(1);
    expect(parse({ page: "2.5" }).page).toBe(1);
  });

  it("knows when only the date window is narrowing the list", () => {
    expect(isUnfiltered(parse({}))).toBe(true);
    expect(isUnfiltered(parse({ range: "7d" }))).toBe(true);
    expect(isUnfiltered(parse({ q: "coffee" }))).toBe(false);
    expect(isUnfiltered(parse({ label: "lab_1" }))).toBe(false);
  });
});

describe("windowOf", () => {
  it("gives a month, a range, or an open window", () => {
    expect(windowOf(parse({}))).toEqual({ month: "2026-09" });
    expect(windowOf(parse({ range: "today" }))).toEqual({
      from: "2026-09-28",
      to: "2026-09-28",
    });
    expect(windowOf(parse({ from: "2026-09-01" }))).toEqual({ from: "2026-09-01" });
  });

  it("never passes both a month and a range, which the shared queries refuse", () => {
    const params = windowOf(parse({ from: "2026-09-01", to: "2026-09-07", month: "2026-08" }));
    expect(params).toEqual({ from: "2026-09-01", to: "2026-09-07" });
  });
});

describe("toSearchParams and ledgerHref", () => {
  it("leaves out everything at its default", () => {
    expect(toSearchParams(parse({})).toString()).toBe("month=2026-09");
  });

  it("round-trips through the URL", () => {
    const original = parse({ q: "coffee", label: ["a", "b"], card: "none", type: "EXPENSE", page: "2" });
    const roundTripped = parseLedgerFilters(
      Object.fromEntries(
        [...new Set([...toSearchParams(original).keys()])].map((key) => [
          key,
          toSearchParams(original).getAll(key),
        ]),
      ),
      { timezoneOffset: MANILA, now: NOW },
    );

    expect(roundTripped).toEqual(original);
  });

  it("returns to page 1 on any change but paging", () => {
    const onPageSeven: LedgerFilters = { ...parse({}), page: 7 };

    expect(ledgerHref(onPageSeven, { search: "coffee" })).toBe("/ledger?month=2026-09&q=coffee");
    expect(ledgerHref(onPageSeven, { page: 8 })).toBe("/ledger?month=2026-09&page=8");
  });

  it("drops the query string entirely when nothing is set", () => {
    const noMonth: LedgerFilters = { ...parse({}), month: null, range: "custom" };
    expect(ledgerHref(noMonth, {})).toBe("/ledger");
  });
});

describe("toggles", () => {
  it("adds and removes a label", () => {
    const filters = parse({ label: "lab_1" });
    expect(toggleLabel(filters, "lab_2")).toEqual(["lab_1", "lab_2"]);
    expect(toggleLabel(filters, "lab_1")).toEqual([]);
  });

  it("clears a radio-style value when the active one is picked again", () => {
    expect(toggleValue("EXPENSE", "EXPENSE")).toBeNull();
    expect(toggleValue("EXPENSE", "INCOME")).toBe("INCOME");
    expect(toggleValue(null, "INCOME")).toBe("INCOME");
  });
});
