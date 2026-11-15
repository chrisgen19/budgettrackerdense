import { localCalendarDay, shiftCalendarDay } from "@bt/lib/period-progress";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import type { PeriodParams, TransactionType } from "@bt/lib/budget-query-types";
import { parseMonth } from "./month-nav";

/**
 * The Ledger's filter state, which lives entirely in the URL.
 *
 * Every filter is a search parameter so a view is linkable, the back button
 * steps through filter changes, and the server renders the result rather than
 * shipping the whole month to the browser to filter there
 * (docs/plans/06-pages.md).
 *
 * Pure: `now` and `timezoneOffset` are arguments, never read from the ambient
 * clock, so "today" means the user's today and the tests can pin it.
 */

/** Rows per page. The plan's figure; a dense table shows a lot at once. */
export const PAGE_SIZE = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The date presets on the bar, plus `custom` for an explicit `from`/`to`. */
export type DateRange = "month" | "today" | "7d" | "custom";

export interface LedgerFilters {
  range: DateRange;
  /** The month, when `range` is `month`. */
  month: string | null;
  /** Resolved local day bounds, for `today`, `7d` and `custom`. */
  from: string | null;
  to: string | null;
  search: string | null;
  categoryId: string | null;
  labelIds: string[];
  /** A card id, or `"none"` for rows paid without one. */
  card: string | null;
  type: TransactionType | null;
  amountMin: number | null;
  amountMax: number | null;
  page: number;
}

/** What `searchParams` gives a server component. */
export type RawParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | null => {
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
};

const many = (value: string | string[] | undefined): string[] => {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  // A single parameter may also carry a comma-separated list, which is how a
  // hand-edited URL tends to be written.
  return [
    ...new Set(
      values
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
};

/**
 * A local day, or null.
 *
 * The round-trip through `shiftCalendarDay` is the real check: `Date.parse`
 * accepts "2026-02-31" and rolls it over to 3 March, so a typo in a URL would
 * silently query a different week. Re-formatting the parsed day and comparing
 * catches that, using the same arithmetic the shared queries use.
 */
const day = (value: string | string[] | undefined): string | null => {
  const text = one(value);
  if (!text || !DAY.test(text)) return null;

  return shiftCalendarDay(text, 0) === text ? text : null;
};

const money = (value: string | string[] | undefined): number | null => {
  const text = one(value);
  if (text === null) return null;

  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const positiveInt = (value: string | string[] | undefined): number => {
  const parsed = Number(one(value));
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
};

const transactionType = (value: string | string[] | undefined): TransactionType | null => {
  const text = one(value)?.toUpperCase();
  return text === "INCOME" || text === "EXPENSE" ? text : null;
};

/**
 * Reads the filters out of `searchParams`.
 *
 * Anything malformed is dropped rather than raised: a hand-edited or stale link
 * should show an unfiltered month, not an error page.
 */
export function parseLedgerFilters(
  params: RawParams,
  { timezoneOffset, now = new Date() }: { timezoneOffset: number; now?: Date },
): LedgerFilters {
  const today = localCalendarDay(now, timezoneOffset);
  const from = day(params.from);
  const to = day(params.to);
  const requested = one(params.range);

  const base = {
    search: one(params.q),
    categoryId: one(params.cat),
    labelIds: many(params.label),
    card: one(params.card),
    type: transactionType(params.type),
    amountMin: money(params.min),
    amountMax: money(params.max),
    page: positiveInt(params.page),
  };

  if (requested === "today") {
    return { ...base, range: "today", month: null, from: today, to: today };
  }

  if (requested === "7d") {
    return { ...base, range: "7d", month: null, from: shiftCalendarDay(today, -6), to: today };
  }

  // An explicit day range wins over a month, matching the shared queries, which
  // refuse both at once.
  if (from || to) {
    return { ...base, range: "custom", month: null, from, to };
  }

  return {
    ...base,
    range: "month",
    month: parseMonth(params.month) ?? currentMonthKey(timezoneOffset, now),
    from: null,
    to: null,
  };
}

/** The window half of the filters, in the shape the shared queries take. */
export function windowOf(filters: LedgerFilters): PeriodParams {
  if (filters.range === "month" && filters.month) return { month: filters.month };

  return {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}

/** True when nothing but the date window is narrowing the list. */
export function isUnfiltered(filters: LedgerFilters): boolean {
  return (
    filters.search === null &&
    filters.categoryId === null &&
    filters.labelIds.length === 0 &&
    filters.card === null &&
    filters.type === null &&
    filters.amountMin === null &&
    filters.amountMax === null
  );
}

/** The filters back as URL parameters, leaving out everything at its default. */
export function toSearchParams(filters: LedgerFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.range === "month") {
    if (filters.month) params.set("month", filters.month);
  } else if (filters.range === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  } else {
    params.set("range", filters.range);
  }

  if (filters.search) params.set("q", filters.search);
  if (filters.categoryId) params.set("cat", filters.categoryId);
  for (const label of filters.labelIds) params.append("label", label);
  if (filters.card) params.set("card", filters.card);
  if (filters.type) params.set("type", filters.type);
  if (filters.amountMin !== null) params.set("min", String(filters.amountMin));
  if (filters.amountMax !== null) params.set("max", String(filters.amountMax));
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

/**
 * A link to the same page with one filter changed.
 *
 * Any change but paging returns to page 1: staying on page 7 of a list that now
 * has two pages shows an empty table and looks like "no results".
 */
export function ledgerHref(
  filters: LedgerFilters,
  change: Partial<LedgerFilters>,
  basePath = "/ledger",
): string {
  const next: LedgerFilters = {
    ...filters,
    ...change,
    page: change.page ?? 1,
  };

  const query = toSearchParams(next).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * A link to one row's detail, keeping the filters so closing the drawer returns
 * to the same list. The drawer is a URL, not client state, so a row can be
 * shared and the back button closes it.
 */
export function detailHref(filters: LedgerFilters, id: string, basePath = "/ledger"): string {
  const params = toSearchParams(filters);
  params.set("tx", id);

  return `${basePath}?${params.toString()}`;
}

/** The same list with the drawer closed. */
export function closeDetailHref(filters: LedgerFilters, basePath = "/ledger"): string {
  const query = toSearchParams(filters).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Toggles one label on or off, for the label chips. */
export function toggleLabel(filters: LedgerFilters, labelId: string): string[] {
  return filters.labelIds.includes(labelId)
    ? filters.labelIds.filter((id) => id !== labelId)
    : [...filters.labelIds, labelId];
}

/** Toggles a value that behaves as a radio: picking the active one clears it. */
export function toggleValue<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}
