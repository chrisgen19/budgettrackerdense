import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Swatch } from "@/components/ui/data-table";
import { HIGH_UTILIZATION, LimitBar } from "@/components/cards/limit-bar";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { budgetTrackerUrl } from "@/lib/links";
import { prisma } from "@/server/db";
import { fetchCards } from "@/server/queries/cards";
import { requireCurrentUser } from "@/server/session";
import type { CreditAccountSummary } from "@bt/lib/credit-account-queries";

export const metadata: Metadata = {
  title: pageTitle("Cards"),
};

/**
 * Every card, and what each owes.
 *
 * What is owed is `opening balance + purchases - payments - credits`, derived
 * on every read. A purchase is an ordinary expense that already counts
 * everywhere expenses count; a payment is a `CreditPayment` row that is not a
 * transaction at all and never joins a spend total
 * (budgettracker `.claude/rules/cards.md`).
 */
export default async function CardsPage() {
  const user = await requireCurrentUser();
  const { cards, totalOwed, utilization, isEmpty } = await fetchCards(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
  });

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-title font-semibold">Cards</h1>
        {isEmpty ? null : (
          <p className="flex items-center gap-2 text-label text-muted">
            <span>
              owed <Money value={totalOwed} tone="expense" bare />
            </span>
            {utilization ? (
              <span>
                {utilization.percent}% of limit
                {utilization.omitted > 0
                  ? ` across ${utilization.counted} of ${utilization.counted + utilization.omitted} cards`
                  : ""}
              </span>
            ) : (
              <span>no limit recorded</span>
            )}
          </p>
        )}
      </header>

      <Panel title="Balances" meta="owed = opening + purchases − payments − credits" flush>
        <DataTable<CreditAccountSummary>
          caption="Credit cards and what each owes"
          columns={[
            {
              key: "name",
              header: "Card",
              cell: (card) => (
                <Link href={`/cards/${card.id}`} className="hover:underline">
                  <Swatch color={card.color} />
                  {card.name}
                  {card.isActive ? null : <span className="ml-1 text-muted">archived</span>}
                </Link>
              ),
            },
            {
              key: "owed",
              header: "Owed",
              align: "right",
              numeric: true,
              cell: (card) => (
                <Money value={card.balance} tone={card.balance > 0 ? "expense" : "income"} bare />
              ),
            },
            {
              key: "limit",
              header: "Limit",
              align: "right",
              numeric: true,
              hideBelow: "wide",
              cell: (card) =>
                card.creditLimit === null ? (
                  <span className="text-muted">not set</span>
                ) : (
                  <Money value={card.creditLimit} bare dp={0} />
                ),
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              numeric: true,
              hideBelow: "wide",
              cell: (card) =>
                card.availableCredit === null ? (
                  <span className="text-muted">n/a</span>
                ) : (
                  <Money
                    value={card.availableCredit}
                    tone={card.availableCredit < 0 ? "expense" : "plain"}
                    bare
                    dp={0}
                  />
                ),
            },
            {
              key: "utilization",
              header: "Util",
              align: "right",
              numeric: true,
              cell: (card) =>
                card.utilization === null ? (
                  <span className="text-muted">n/a</span>
                ) : (
                  <span className={card.utilization > HIGH_UTILIZATION ? "text-expense" : ""}>
                    {card.utilization.toFixed(1)}%
                  </span>
                ),
            },
            {
              key: "bar",
              header: "",
              hideBelow: "wide",
              cell: (card) =>
                card.utilization === null ? null : <LimitBar utilization={card.utilization} />,
            },
            {
              key: "statement",
              header: "Stmt",
              align: "right",
              numeric: true,
              hideBelow: "wide",
              cell: (card) =>
                card.statementDay === null ? (
                  <span className="text-muted">n/a</span>
                ) : (
                  card.statementDay
                ),
            },
            {
              key: "due",
              header: "Due",
              align: "right",
              numeric: true,
              cell: (card) =>
                card.dueDay === null ? <span className="text-muted">n/a</span> : card.dueDay,
            },
            {
              key: "planned",
              header: "Planned",
              align: "right",
              numeric: true,
              hideBelow: "wide",
              // Null is unknown, not zero: no plan has been set, and a 0 would
              // read as a decision to pay nothing.
              cell: (card) =>
                card.plannedPayment === null ? (
                  <span className="text-muted">none</span>
                ) : (
                  <Money value={card.plannedPayment} bare dp={0} />
                ),
            },
          ]}
          rows={cards}
          rowKey={(card) => card.id}
          empty={
            <EmptyState title="No cards recorded">
              Cards are added in{" "}
              <a href={`${budgetTrackerUrl()}/cards`} className="text-accent underline">
                budgettracker
              </a>
              .
            </EmptyState>
          }
        />
      </Panel>
    </div>
  );
}
