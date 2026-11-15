import "server-only";
import type { PrismaClient } from "@prisma/client";
import { userToday, utcDayKey } from "@bt/lib/bill-dates";
import { getBillHistory, getUpcomingBills } from "@bt/lib/budget-queries";
import { roundMoney } from "@bt/lib/money";
import type {
  BillHistory,
  BillHistorySummary,
  BillOccurrence,
  UpcomingBill,
} from "@bt/lib/budget-query-types";
import { daysBetween, type DayOption, type HistoryOption } from "@/lib/bills";

/**
 * The Bills page.
 *
 * Both halves are budgettracker's own reads: `getUpcomingBills` for what is due
 * (with its variable-bill estimates and its overdue rule) and `getBillHistory`
 * for settled occurrences (collapsed per occurrence, lateness in the user's
 * days). The timezone goes into both explicitly. Defaulted, "today" becomes
 * UTC's, and between Manila's midnight and UTC's a bill due today reads as due
 * tomorrow.
 *
 * Bill dates are calendar days, not instants (budgettracker
 * `.claude/rules/bills.md`): everything here works from `localDueDate`, which is
 * the stored UTC day, and never converts it.
 *
 * The one dense read is the bills' own settings, because `getUpcomingBills`
 * does not return the reminder and the page needs to tell "no bills at all"
 * apart from "none due".
 */

export interface DueBill extends UpcomingBill {
  /** Whole days from the user's today to the due day; negative when overdue. */
  daysUntil: number;
  /** Days before the due day the reminder goes out; 0 is the day itself. */
  reminderDaysBefore: number;
}

export interface DueGroup {
  bills: DueBill[];
  total: number;
  /** True when any bill's figure is an estimate, so the total is "about". */
  isEstimate: boolean;
}

export interface BillTimeline {
  summary: BillHistorySummary;
  /** Newest first, as `getBillHistory` orders them. */
  occurrences: BillOccurrence[];
}

export interface Bills {
  /** The user's calendar day, `YYYY-MM-DD`. */
  today: string;
  days: DayOption;
  months: HistoryOption;
  overdue: DueGroup;
  upcoming: DueGroup;
  history: Pick<BillHistory, "from" | "to">;
  /** One entry per bill with history in the window, worst average lateness first. */
  timelines: BillTimeline[];
  /** Every bill the user has set up, active or not. Zero is the page's empty state. */
  billCount: number;
  activeCount: number;
}

/**
 * Enough to cover every occurrence in a twelve-month window for any realistic
 * number of bills. `getBillHistory` slices occurrences to `limit` (default 50)
 * while its summaries cover the whole window, so the default would leave the
 * per-bill tables short of their own summary counts.
 */
const HISTORY_LIMIT = 2_000;

const group = (bills: DueBill[]): DueGroup => ({
  bills,
  total: roundMoney(bills.reduce((sum, bill) => sum + bill.amount, 0)),
  isEstimate: bills.some((bill) => bill.isEstimate),
});

export async function fetchBills(
  prisma: PrismaClient,
  userId: string,
  {
    timezoneOffset,
    days,
    months,
  }: { timezoneOffset: number; days: DayOption; months: HistoryOption },
): Promise<Bills> {
  const today = utcDayKey(userToday(timezoneOffset));

  const [upcoming, history, settings] = await Promise.all([
    getUpcomingBills(prisma, userId, { days, timezoneOffset }),
    getBillHistory(prisma, userId, { months, timezoneOffset, limit: HISTORY_LIMIT }),
    prisma.scheduledTransaction.findMany({
      where: { userId },
      select: { id: true, reminderDaysBefore: true, isActive: true },
    }),
  ]);

  const reminders = new Map(settings.map((bill) => [bill.id, bill.reminderDaysBefore]));

  const due: DueBill[] = upcoming.bills.map((bill) => ({
    ...bill,
    daysUntil: daysBetween(today, bill.localDueDate),
    reminderDaysBefore: reminders.get(bill.id) ?? 0,
  }));

  const byBill = new Map<string, BillOccurrence[]>();
  for (const occurrence of history.occurrences) {
    const list = byBill.get(occurrence.billId) ?? [];
    list.push(occurrence);
    byBill.set(occurrence.billId, list);
  }

  return {
    today,
    days,
    months,
    // `isOverdue` is budgettracker's own rule (due day before the user's today),
    // so this split and its dashboard's cannot disagree.
    overdue: group(due.filter((bill) => bill.isOverdue)),
    upcoming: group(due.filter((bill) => !bill.isOverdue)),
    history: { from: history.from, to: history.to },
    timelines: history.summaries.map((summary) => ({
      summary,
      occurrences: byBill.get(summary.billId) ?? [],
    })),
    billCount: settings.length,
    activeCount: settings.filter((bill) => bill.isActive).length,
  };
}
