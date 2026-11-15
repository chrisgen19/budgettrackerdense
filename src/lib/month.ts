/**
 * The month key the shell prints, in the user's own timezone.
 *
 * `timezoneOffset` is `Date.getTimezoneOffset()` minutes, so UTC+8 is -480, and
 * local midnight is `Date.UTC(y, m, d) + tz * 60000` (AGENTS.md). Shifting the
 * instant the other way gives the local wall clock, whose month is the one the
 * user is looking at.
 */
export function currentMonthKey(timezoneOffset: number, now: Date = new Date()): string {
  const local = new Date(now.getTime() - timezoneOffset * 60_000);

  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}
