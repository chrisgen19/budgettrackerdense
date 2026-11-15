import { Money } from "@/components/ui/money";
import type { LedgerTotals } from "@bt/lib/credit-account-queries";
import type { CardMonth } from "@/server/queries/cards";

function Line({
  label,
  value,
  tone,
  emphasis = false,
  note,
}: {
  label: string;
  value: number;
  tone?: "plain" | "income" | "expense";
  emphasis?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        emphasis ? "border-t border-rule font-semibold" : "border-b border-rule-2"
      }`}
    >
      <span className={emphasis ? "" : "text-muted"}>
        {label}
        {note ? <span className="ml-1 text-label text-muted">{note}</span> : null}
      </span>
      <Money value={value} tone={tone} bare />
    </div>
  );
}

/**
 * How the month moved the balance.
 *
 * Purchases and payments are listed on separate lines and never summed into one
 * "spent" figure: a purchase is an expense that already counts everywhere, and
 * a payment is money going to the bank, not spending
 * (budgettracker `.claude/rules/cards.md`).
 */
export function MonthBalance({ month }: { month: CardMonth }) {
  const totals: LedgerTotals = month.detail.period.totals;

  return (
    <div className="text-body">
      <Line label="Opening balance" value={month.openingBalance} />

      {month.openedWith !== 0 ? (
        <Line
          label="Card opened with"
          value={month.openedWith}
          note="recorded balance, dated inside this month"
        />
      ) : null}

      <Line label="Purchases" value={totals.purchases} tone="expense" />
      <Line label="Payments" value={-totals.payments} tone="income" />

      {totals.credits !== 0 ? (
        <Line label="Credits" value={-totals.credits} tone="income" note="refunds the card issued" />
      ) : null}

      <Line label="Closing balance" value={month.closingBalance} emphasis />
    </div>
  );
}
