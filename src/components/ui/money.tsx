import { formatAmount, formatMoney, type MoneyOptions } from "@/lib/money";

/**
 * Which colour a figure carries. Deliberately not derived from the sign: in the
 * mockup an expense is plain ink with a `−`, and only income is green, so the
 * caller says what the number *means*.
 */
export type MoneyTone = "plain" | "income" | "expense" | "muted";

const TONE_CLASS: Record<MoneyTone, string> = {
  plain: "",
  income: "text-income",
  expense: "text-expense",
  muted: "text-muted",
};

export interface MoneyProps extends MoneyOptions {
  value: number;
  tone?: MoneyTone;
  /** Leave the currency symbol off, for columns whose header carries it. */
  bare?: boolean;
  className?: string;
}

/**
 * Every figure in the app goes through here: IBM Plex Mono, tabular numerals,
 * U+2212 for the minus. See AGENTS.md's money rule and src/lib/money.ts.
 */
export function Money({
  value,
  tone = "plain",
  bare = false,
  className = "",
  ...options
}: MoneyProps) {
  const text = bare ? formatAmount(value, options) : formatMoney(value, options);

  return (
    <span className={`tnum text-figure ${TONE_CLASS[tone]} ${className}`.trim()}>{text}</span>
  );
}

export interface DeltaProps {
  /** Change in spend. Positive means more was spent, so it reads as a warning. */
  value: number;
  /** Decimal places; the mockup's delta column uses 0. */
  dp?: 0 | 2;
  className?: string;
}

/**
 * A month-on-month spend delta. Spending more is red, spending less is green,
 * and an exact zero is muted with no sign at all (`.d-t` delta column).
 */
export function Delta({ value, dp = 0, className = "" }: DeltaProps) {
  const tone: MoneyTone = value > 0 ? "expense" : value < 0 ? "income" : "muted";

  return <Money value={value} tone={tone} bare dp={dp} sign className={className} />;
}
