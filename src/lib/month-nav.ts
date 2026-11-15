/**
 * Month navigation for pages that take `?month=YYYY-MM`.
 *
 * The month is a URL parameter so a view is linkable and the back button works
 * (docs/plans/06-pages.md). A malformed or out-of-range value falls back to the
 * caller's default rather than erroring: a bad link should show this month, not
 * a stack trace.
 */
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The earliest month worth asking for. Nothing in the database predates it. */
const FIRST_MONTH = "2000-01";

/** Narrows a `searchParams` value to a month key, or `null` when it is not one. */
export function parseMonth(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== "string") return null;

  const match = MONTH.exec(text.trim());
  if (!match || text.trim() < FIRST_MONTH) return null;

  return text.trim();
}

/** A long month name for a `YYYY-MM` key, in UTC so the key is read literally. */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** The short name alone, e.g. "Sep". */
export function monthShort(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}
