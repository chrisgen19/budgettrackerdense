/**
 * Figures copied from design-reference/04-desktop.png (September 2026) so this
 * page can be held up against the mockup and compared number for number.
 *
 * Not real data and never read by the app: phase 06 wires the same components
 * to `src/server/queries`. Category colours are stand-ins, since the mockup's
 * come from the database.
 */
import type { BurnPoint } from "@/components/charts/burn-chart";
import type { MonthBar } from "@/components/charts/month-bars";

export const MONTH = {
  label: "September 2026",
  short: "Sep",
  key: "2026-09",
  daysInMonth: 30,
  lastDay: 28,
  income: 79_953.66,
  spent: 81_578.35,
  budget: 79_000,
  net: -1_624.69,
  remaining: -2_578.35,
  burnPerDay: 2_914,
  pace: 2_633,
  projected: 87_405,
  overFromDay: 27,
  vsPrevious: -13_736,
  previousLabel: "Aug",
} as const;

/** Daily spend for the month, shaped like the mockup's curve and summing to `spent`. */
const DAILY_SPEND: readonly number[] = [
  420, 310, 1_180, 640, 22_000, 980, 1_420, 760, 3_210, 890, 1_640, 520, 7_480, 1_120, 2_030, 760,
  1_380, 5_400, 940, 1_260, 3_020, 680, 1_540, 9_316, 1_180, 2_240, 4_120, 3_138.35, 0, 0,
];

export const CUMULATIVE: readonly BurnPoint[] = DAILY_SPEND.reduce<BurnPoint[]>(
  (points, daySpend, index) => {
    const previous = points[index - 1]?.spent ?? 0;
    points.push({ day: index + 1, spent: previous + daySpend, daySpend });
    return points;
  },
  [],
);

/** Twice the straight-line pace; days above it are drawn red. */
export const DAY_LIMIT = (MONTH.budget / MONTH.daysInMonth) * 2;

export const MONTHLY: readonly MonthBar[] = [
  { label: "Apr", income: 71_200, expense: 68_400 },
  { label: "May", income: 0, expense: 0, empty: true },
  { label: "Jun", income: 83_100, expense: 79_900 },
  { label: "Jul", income: 76_400, expense: 71_250 },
  { label: "Aug", income: 88_300, expense: 95_314 },
  { label: "Sep", income: 79_953.66, expense: 81_578.35 },
];

export interface SampleTransaction {
  id: string;
  day: string;
  time: string;
  description: string;
  category: { name: string; color: string };
  labels: string[];
  source: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
}

export const RECENT: readonly SampleTransaction[] = [
  ["t1", "28", "22:36", "Indrive: V mall to Mirea", "Transportation", "#2a9d8f", ["TNVS"], "Cash", 241],
  ["t2", "28", "19:02", "Jollibee 2 one piece chicken meal", "Food & Dining", "#e76f51", ["Family Budget"], "Cash", 210],
  ["t3", "28", "15:20", "Seattle's best coffee", "Food & Dining", "#e76f51", ["Personal"], "BPI", 220],
  ["t4", "28", "11:48", "Coffee ni mahal", "Food & Dining", "#e76f51", ["Personal"], "Cash", 165],
  ["t5", "28", "09:14", "Indrive: Mirea to Cardinal", "Transportation", "#2a9d8f", ["TNVS", "Work Budget"], "Cash", 317],
  ["t6", "28", "08:02", "2 palabok and 1 water", "Food & Dining", "#e76f51", ["Family Budget"], "Cash", 225],
  ["t7", "27", "20:41", "Bibingkinitan with Tea", "Food & Dining", "#e76f51", ["Family Budget"], "Cash", 250],
  ["t8", "27", "17:33", "Potato Corner: Giga", "Food & Dining", "#e76f51", ["Personal"], "Cash", 205],
  ["t9", "27", "10:05", "Anti Rabis and Anti Parasitic", "Pet", "#8d6e63", ["Family Budget"], "BPI", 1_000],
].map(([id, day, time, description, category, color, labels, source, amount]) => ({
  id: id as string,
  day: day as string,
  time: time as string,
  description: description as string,
  category: { name: category as string, color: color as string },
  labels: labels as string[],
  source: source as string,
  amount: amount as number,
  type: "EXPENSE" as const,
}));

export interface SampleCategory {
  name: string;
  color: string;
  total: number;
  delta: number;
  spark: number[];
}

export const CATEGORIES: readonly SampleCategory[] = [
  { name: "Housing", color: "#2e7d32", total: 22_000, delta: -1_049, spark: [23_049, 22_000, 23_049, 22_000, 23_049, 22_000] },
  { name: "Food & Dining", color: "#e76f51", total: 15_526, delta: 287, spark: [14_200, 15_900, 13_800, 16_400, 15_239, 15_526] },
  { name: "Utilities", color: "#7b5ea7", total: 9_316, delta: -2_179, spark: [8_400, 9_900, 11_200, 10_100, 11_495, 9_316] },
  { name: "Travel", color: "#1f6feb", total: 8_125, delta: 8_125, spark: [0, 0, 2_400, 0, 0, 8_125] },
  { name: "Transportation", color: "#2a9d8f", total: 6_324, delta: 1_998, spark: [5_100, 4_800, 5_600, 4_200, 4_326, 6_324] },
  { name: "Family Contributions", color: "#455a64", total: 5_400, delta: 0, spark: [5_400, 5_400, 5_400, 5_400, 5_400, 5_400] },
  { name: "Fun", color: "#43a047", total: 3_340, delta: 216, spark: [2_900, 3_600, 2_400, 3_900, 3_124, 3_340] },
  { name: "Groceries", color: "#c2185b", total: 2_971, delta: -6_096, spark: [7_200, 9_400, 6_800, 8_100, 9_067, 2_971] },
  { name: "Shopping", color: "#f4a261", total: 2_282, delta: -7_228, spark: [4_100, 9_600, 3_200, 8_400, 9_510, 2_282] },
  { name: "Pet", color: "#8d6e63", total: 2_196, delta: -307, spark: [1_800, 2_600, 2_100, 2_900, 2_503, 2_196] },
];

export interface SampleLabel {
  name: string;
  color: string;
  count: number;
  total: number;
}

export const LABELS: readonly SampleLabel[] = [
  { name: "Family Budget", color: "#e4572e", count: 37, total: 29_357 },
  { name: "With Mom and Dad Budget", color: "#f2a541", count: 4, total: 8_427 },
  { name: "Personal", color: "#7b5ea7", count: 15, total: 6_572 },
  { name: "TNVS", color: "#2a9d8f", count: 18, total: 4_782 },
  { name: "Work Budget", color: "#e76f51", count: 51, total: 4_596 },
  { name: "Pickleball Budget", color: "#4cc9f0", count: 11, total: 3_340 },
];

/** Six months of category totals for the heat table, newest last. */
export const HEAT_MONTHS = [
  { label: "Apr" },
  { label: "May", empty: true },
  { label: "Jun" },
  { label: "Jul" },
  { label: "Aug" },
  { label: "Sep" },
] as const;

export const HEAT_ROWS = CATEGORIES.slice(0, 6).map((category) => ({
  name: category.name,
  color: category.color,
  values: category.spark.map((value, index) => (index === 1 ? 0 : value)),
}));

export interface SampleSource {
  name: string;
  color?: string;
  /** Day of the month the statement is due, for a card. */
  dueDay?: number;
  spend: number;
  /** `null` where the question does not apply, e.g. cash has no balance. */
  owed: number | null;
  utilization: number | null;
}

export const SOURCES: readonly SampleSource[] = [
  { name: "Cash / debit", spend: 81_578, owed: null, utilization: null },
  { name: "BPI", color: "#d32f2f", dueDay: 28, spend: 0, owed: 76_566, utilization: 81.5 },
];
