/**
 * Money formatting, ported from `peso`/`pesoK` in
 * design-reference/shared/core.js.
 *
 * Two rules the mockup enforces and this app inherits: the minus is U+2212
 * MINUS SIGN, not a hyphen, so a negative figure lines up under a positive one
 * in a mono column; and the sign goes outside the symbol (`−₱241.00`).
 */

/** U+2212. `-` is narrower than a digit in IBM Plex Mono and breaks the column. */
export const MINUS = "−";

const FRACTION = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const WHOLE = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export interface MoneyOptions {
  /** Show a leading `+` on positive values. Off by default. */
  sign?: boolean;
  /** Decimal places: 2 (default) or 0 for the compact columns. */
  dp?: 0 | 2;
  /** Currency symbol. Defaults to the peso; `users.currency` is PHP. */
  symbol?: string;
}

/** `₱12,345.00`, `−₱241.00`, `+₱5,000`. */
export function formatMoney(value: number, options: MoneyOptions = {}): string {
  const { sign = false, dp = 2, symbol = "₱" } = options;
  const digits = (dp === 0 ? WHOLE : FRACTION).format(Math.abs(value));
  const prefix = value < 0 ? MINUS : sign && value > 0 ? "+" : "";

  return `${prefix}${symbol}${digits}`;
}

/** The same figure without the symbol, for columns whose header carries it. */
export function formatAmount(value: number, options: MoneyOptions = {}): string {
  return formatMoney(value, { ...options, symbol: "" });
}

/** `₱12.3k` for axis labels and other places a full figure will not fit. */
export function formatMoneyCompact(value: number, symbol = "₱"): string {
  const magnitude = Math.abs(value);
  if (magnitude < 1000) return `${value < 0 ? MINUS : ""}${symbol}${Math.round(magnitude)}`;

  const thousands = (magnitude / 1000).toFixed(magnitude >= 10_000 ? 0 : 1);
  return `${value < 0 ? MINUS : ""}${symbol}${thousands}k`;
}

/** `+12%` / `−3%` / `0%`, for deltas expressed as a ratio. */
export function formatPercent(ratio: number, { sign = false } = {}): string {
  const rounded = Math.round(ratio * 100);
  const prefix = rounded < 0 ? MINUS : sign && rounded > 0 ? "+" : "";

  return `${prefix}${Math.abs(rounded)}%`;
}
