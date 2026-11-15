/**
 * Display rules for the Bills page.
 *
 * Every bill date here is a calendar day, `YYYY-MM-DD`, as budgettracker's
 * `localDueDate` reports it: stored at midnight UTC and meaning "the 5th" for
 * every reader (budgettracker `.claude/rules/bills.md`). So day arithmetic is
 * done on the keys themselves, read as UTC midnights, and nothing is ever
 * shifted by the user's offset. Only "today" comes from the offset, through the
 * vendored `userToday`, before it reaches here as a key.
 */

/** How far ahead the Due panel looks, in days. `?days=`. */
export const DAY_OPTIONS = [7, 14, 30] as const;
export type DayOption = (typeof DAY_OPTIONS)[number];
export const DEFAULT_DAYS: DayOption = 30;

/** How far back the history looks, in months. `?months=`. */
export const HISTORY_OPTIONS = [3, 6, 12] as const;
export type HistoryOption = (typeof HISTORY_OPTIONS)[number];
export const DEFAULT_HISTORY: HistoryOption = 6;

const DAY_MS = 86_400_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `?days=`, falling back to the default for anything not on offer. */
export const parseDays = (value: string | string[] | undefined): DayOption => {
  const number = Number(first(value));
  return (DAY_OPTIONS as readonly number[]).includes(number) ? (number as DayOption) : DEFAULT_DAYS;
};

/** `?months=`, falling back to the default for anything not on offer. */
export const parseHistory = (value: string | string[] | undefined): HistoryOption => {
  const number = Number(first(value));
  return (HISTORY_OPTIONS as readonly number[]).includes(number)
    ? (number as HistoryOption)
    : DEFAULT_HISTORY;
};

/** `/bills` carrying only the parameters that differ from the defaults. */
export const billsHref = (days: DayOption, months: HistoryOption): string => {
  const params = new URLSearchParams();
  if (days !== DEFAULT_DAYS) params.set("days", String(days));
  if (months !== DEFAULT_HISTORY) params.set("months", String(months));
  const query = params.toString();
  return query ? `/bills?${query}` : "/bills";
};

/**
 * Whole days from `today` to `due`, both calendar-day keys. Negative is overdue.
 * Both are read as UTC midnights, so the difference is whole by construction.
 */
export const daysBetween = (today: string, due: string): number => {
  if (!DAY_KEY.test(today) || !DAY_KEY.test(due)) throw new RangeError("Expected YYYY-MM-DD");
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "12 days overdue", "today", "tomorrow", "in 3 days". */
export const describeDaysUntil = (days: number): string => {
  if (days < 0) return `${plural(-days, "day")} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${plural(days, "day")}`;
};

/** A reminder setting: 0 reminds on the due day itself (budgettracker `pending-bills.ts`). */
export const describeReminder = (daysBefore: number): string =>
  daysBefore <= 0 ? "on the day" : `${plural(daysBefore, "day")} before`;

/** A paid occurrence's lateness. Negative is early, and is kept: "2 days early" is an answer. */
export const describeLateness = (daysLate: number | null): string => {
  if (daysLate === null) return "";
  if (daysLate === 0) return "on time";
  return daysLate > 0 ? `${plural(daysLate, "day")} late` : `${plural(-daysLate, "day")} early`;
};

/** Where a variable bill's figure came from, in words. */
export const describeEstimateBasis = (
  basis: "same-month-last-year" | "last-payment" | "budgeted" | null,
): string => {
  switch (basis) {
    case "same-month-last-year":
      return "same month last year";
    case "last-payment":
      return "last payment";
    case "budgeted":
      return "budgeted amount";
    default:
      return "fixed";
  }
};

/** "Oct 5, 2026" for a calendar-day key, formatted in UTC so the day is read literally. */
export const formatDayKey = (key: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
