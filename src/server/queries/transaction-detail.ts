import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getReceiptItems } from "@bt/lib/budget-queries";
import { localCalendarDay } from "@bt/lib/period-progress";
import type { ReceiptItem, TransactionType } from "@bt/lib/budget-query-types";

/**
 * One transaction, read-only, for the Ledger's detail drawer.
 *
 * `fetchLedger` deliberately does not carry provenance or the receipt: a table
 * of 50 rows does not need either, and joining them per row would be three more
 * reads for data nobody is looking at. This is the one-row read.
 *
 * Scoped by `userId` in the `where`, not checked after: a detail route that
 * fetches by id and then compares is one forgotten comparison away from showing
 * somebody else's money.
 */
export interface TransactionDetail {
  id: string;
  amount: number;
  description: string;
  type: TransactionType;
  /** The stored instant. */
  date: Date;
  /** The same moment as the user's own calendar day, YYYY-MM-DD. */
  localDate: string;
  /** Local time of day, HH:mm. */
  localTime: string;
  categoryName: string;
  categoryColor: string;
  creditAccountName: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
  /** Which surface created the row, and which last edited it. */
  createdVia: string;
  updatedVia: string | null;
  /** The bill this row settles, when it was logged against one. */
  billName: string | null;
  billId: string | null;
  receiptGroupId: string | null;
  /** The scanned line items, empty when the row carries no breakdown. */
  receiptItems: ReceiptItem[];
  /** Sum of the line items, which may differ from `amount` on a split receipt. */
  receiptTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function fetchTransactionDetail(
  prisma: PrismaClient,
  userId: string,
  id: string,
  timezoneOffset: number,
): Promise<TransactionDetail | null> {
  const row = await prisma.transaction.findFirst({
    where: { id, userId },
    include: {
      category: { select: { name: true, color: true } },
      creditAccount: { select: { name: true } },
      // A bill has no name of its own: `description` is what it is called.
      bill: { select: { id: true, description: true } },
      labels: { include: { label: { select: { id: true, name: true, color: true } } } },
    },
  });

  if (!row) return null;

  // Only ask for the receipt when the row says it has one.
  const receipt = row.receiptBreakdown
    ? await getReceiptItems(prisma, userId, {
        receiptGroupId: row.receiptGroupId ?? undefined,
        timezoneOffset,
      })
    : null;

  const items = receipt?.items.filter((item) => item.transactionId === row.id) ?? [];
  const localDate = localCalendarDay(row.date, timezoneOffset);

  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    type: row.type,
    date: row.date,
    localDate,
    localTime: new Date(row.date.getTime() - timezoneOffset * 60_000)
      .toISOString()
      .slice(11, 16),
    categoryName: row.category.name,
    categoryColor: row.category.color,
    creditAccountName: row.creditAccount?.name ?? null,
    labels: row.labels.map(({ label }) => label),
    createdVia: row.createdVia,
    updatedVia: row.updatedVia,
    billName: row.bill?.description || null,
    billId: row.billId,
    receiptGroupId: row.receiptGroupId,
    receiptItems: items,
    receiptTotal: items.reduce((sum, item) => sum + item.amount, 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
