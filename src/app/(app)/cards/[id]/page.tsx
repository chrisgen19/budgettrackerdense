import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MonthBalance } from "@/components/cards/month-balance";
import { MonthNav } from "@/components/overview/month-nav";
import { DataTable, Swatch, Token } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { budgetTrackerUrl } from "@/lib/links";
import { monthLabel, parseMonth } from "@/lib/month-nav";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import type { CardPurchaseRow } from "@bt/lib/credit-account-queries";
import type { CreditPayment } from "@prisma/client";
import { prisma } from "@/server/db";
import { fetchCardMonth } from "@/server/queries/cards";
import { getCurrentUser, requireCurrentUser } from "@/server/session";

/**
 * Names the card in the tab, and refuses an unknown one early.
 *
 * Known limitation: an unknown id renders the 404 page but the response status
 * stays **200**. The app shell streams before either this or the page body
 * runs, so the status line is already committed; calling `notFound()` from
 * here rather than from the page does not change that. Measured both ways, in
 * `next dev` and against a production build. A plain missing route still
 * returns a real 404. Worth revisiting in plan 08, where a deploy may care.
 */
export async function generateMetadata({ params }: PageProps<"/cards/[id]">): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: pageTitle("Card") };

  const { id } = await params;
  const card = await prisma.creditAccount.findFirst({
    where: { id, userId: user.id },
    select: { name: true },
  });

  if (!card) notFound();

  return { title: pageTitle(card.name) };
}

/** Local time of day, HH:mm, from the stored instant. */
const localDay = (date: Date, timezoneOffset: number) =>
  new Date(date.getTime() - timezoneOffset * 60_000).toISOString().slice(0, 10);

/**
 * One card for one month: what it owed at each end, what was bought on it, and
 * what was paid to it.
 *
 * The two lists are deliberately separate. A purchase is an ordinary EXPENSE
 * carrying `credit_account_id`; a payment is a `CreditPayment` row that is not
 * a transaction and must never reach an expense total
 * (budgettracker `.claude/rules/cards.md`).
 */
export default async function CardDetailPage({ params, searchParams }: PageProps<"/cards/[id]">) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const search = await searchParams;

  const thisMonth = currentMonthKey(user.timezoneOffset);
  const month = parseMonth(search.month) ?? thisMonth;

  const card = await fetchCardMonth(prisma, user.id, id, {
    timezoneOffset: user.timezoneOffset,
    month,
  });

  if (!card) notFound();

  const { detail } = card;
  const { account } = detail;

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/cards"
            className="flex size-7 items-center justify-center rounded-panel border border-rule bg-panel text-muted hover:text-ink"
            aria-label="Back to cards"
          >
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
          <h1 className="text-title font-semibold">
            <Swatch color={account.color} />
            {account.name}
          </h1>
        </div>
        <MonthNav month={month} currentMonth={thisMonth} basePath={`/cards/${id}`} />
      </header>

      <div className="grid gap-2.5 desk:grid-cols-[1fr_1fr]">
        <Panel
          title={`Balance, ${monthLabel(month)}`}
          meta="purchases and payments are counted separately"
        >
          <MonthBalance month={card} />
        </Panel>

        <Panel title="Card" meta={account.isActive ? undefined : "archived"}>
          <dl className="m-0 grid grid-cols-[8rem_1fr] text-body">
            <dt className="py-1 text-muted">Owed, all time</dt>
            <dd className="m-0 py-1">
              <Money value={account.balance} tone={account.balance > 0 ? "expense" : "income"} bare />
            </dd>

            <dt className="py-1 text-muted">Limit</dt>
            <dd className="m-0 py-1">
              {account.creditLimit === null ? (
                <span className="text-muted">not set</span>
              ) : (
                <Money value={account.creditLimit} bare dp={0} />
              )}
            </dd>

            <dt className="py-1 text-muted">Utilization</dt>
            <dd className="m-0 py-1">
              {account.utilization === null ? (
                <span className="text-muted">n/a</span>
              ) : (
                <span className={account.utilization > 80 ? "text-expense" : ""}>
                  {account.utilization.toFixed(1)}%
                </span>
              )}
            </dd>

            <dt className="py-1 text-muted">Statement / due</dt>
            <dd className="m-0 py-1 tnum text-figure">
              {account.statementDay ?? "n/a"} / {account.dueDay ?? "n/a"}
            </dd>

            <dt className="py-1 text-muted">Interest</dt>
            <dd className="m-0 py-1">
              {/* Untracked and zero are different answers: a card with no
                  interest history would read as free to carry. */}
              {card.interest.state === "untracked" ? (
                <span className="text-muted">not tracked</span>
              ) : card.interest.state === "none-this-period" ? (
                <span className="text-muted">none this month</span>
              ) : (
                <Money value={card.interest.amount} tone="expense" bare />
              )}
            </dd>

            <dt className="py-1 text-muted">Paid per month</dt>
            <dd className="m-0 py-1">
              {/* Null is "too little history to say", not zero. */}
              {detail.observedPayment.monthly === null ? (
                <span className="text-muted">
                  not enough history{" "}
                  {detail.observedPayment.months > 0
                    ? `(${detail.observedPayment.months} mo observed)`
                    : ""}
                </span>
              ) : (
                <>
                  <Money value={detail.observedPayment.monthly} bare dp={0} />
                  <span className="ml-1 text-label text-muted">
                    over {detail.observedPayment.months} mo
                  </span>
                </>
              )}
            </dd>

            <dt className="py-1 text-muted">Planned payment</dt>
            <dd className="m-0 py-1">
              {account.plannedPayment === null ? (
                <span className="text-muted">none set</span>
              ) : (
                <Money value={account.plannedPayment} bare dp={0} />
              )}
            </dd>
          </dl>

          <p className="mt-2 text-label text-muted">
            Terms and payments are edited in{" "}
            <a href={`${budgetTrackerUrl()}/cards/${id}`} className="text-accent underline">
              budgettracker
            </a>
            .
          </p>
        </Panel>
      </div>

      {card.isEmpty ? (
        <Panel flush>
          <EmptyState title={`Nothing on this card in ${monthLabel(month)}`}>
            No purchases and no payments. The balance carried over unchanged.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-2.5 desk:grid-cols-[1.6fr_1fr]">
          <Panel
            title="Purchases"
            meta={
              detail.truncated
                ? "capped list, totals are complete"
                : `${detail.purchases.length} row${detail.purchases.length === 1 ? "" : "s"}`
            }
            flush
          >
            <DataTable<CardPurchaseRow>
              caption={`Purchases on ${account.name} in ${monthLabel(month)}`}
              columns={[
                {
                  key: "date",
                  header: "Date",
                  cell: (row) => (
                    <span className="tnum text-figure text-muted">
                      {localDay(row.date, user.timezoneOffset).slice(5)}
                    </span>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  truncate: true,
                  cell: (row) => row.description,
                },
                {
                  key: "category",
                  header: "Category",
                  cell: (row) => (
                    <>
                      <Swatch color={row.category.color} />
                      {row.category.name}
                    </>
                  ),
                },
                {
                  key: "labels",
                  header: "Labels",
                  hideBelow: "wide",
                  cell: (row) =>
                    row.labels.map(({ labelId, label }) => (
                      <Token key={labelId}>{label.name}</Token>
                    )),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  numeric: true,
                  cell: (row) => <Money value={-row.amount} bare />,
                },
              ]}
              rows={detail.purchases}
              rowKey={(row) => row.id}
              empty={<EmptyState title="Nothing bought on this card this month" />}
            />
          </Panel>

          <Panel
            title="Payments"
            meta="not expenses, so they count in no spend total"
            flush
          >
            <DataTable<CreditPayment>
              caption={`Payments to ${account.name} in ${monthLabel(month)}`}
              columns={[
                {
                  key: "date",
                  header: "Date",
                  cell: (row) => (
                    <span className="tnum text-figure text-muted">
                      {localDay(row.date, user.timezoneOffset).slice(5)}
                    </span>
                  ),
                },
                {
                  key: "kind",
                  header: "Kind",
                  cell: (row) => (
                    <span className={row.kind === "CREDIT" ? "text-muted" : ""}>
                      {row.kind === "CREDIT" ? "Refund" : "Payment"}
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  numeric: true,
                  cell: (row) => <Money value={row.amount} tone="income" bare />,
                },
              ]}
              rows={detail.payments}
              rowKey={(row) => row.id}
              empty={<EmptyState title="No payments to this card this month" />}
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
