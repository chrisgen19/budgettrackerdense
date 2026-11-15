import type { Metadata } from "next";
import Link from "next/link";
import { BillsNav } from "@/components/bills/bills-nav";
import { DueTable } from "@/components/bills/due-table";
import { HistoryPanel } from "@/components/bills/history-panel";
import { Kpi, KpiStrip } from "@/components/ui/kpi-strip";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { formatDayKey, parseDays, parseHistory } from "@/lib/bills";
import { billsUrl } from "@/lib/links";
import { prisma } from "@/server/db";
import { fetchBills, type Bills } from "@/server/queries/bills";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Bills"),
};

function ManageLink({ children = "budgettracker" }: { children?: string }) {
  return (
    <Link href={billsUrl()} className="text-accent underline">
      {children}
    </Link>
  );
}

function Totals({ bills }: { bills: Bills }) {
  const paid = bills.timelines.reduce((sum, t) => sum + t.summary.paid, 0);
  const late = bills.timelines.reduce((sum, t) => sum + t.summary.paidLate, 0);
  const skipped = bills.timelines.reduce((sum, t) => sum + t.summary.skipped, 0);

  return (
    <KpiStrip>
      <Kpi
        label="Overdue"
        value={<Money value={bills.overdue.total} tone={bills.overdue.total > 0 ? "expense" : "plain"} />}
        note={`${bills.overdue.bills.length} bill${bills.overdue.bills.length === 1 ? "" : "s"}${
          bills.overdue.isEstimate ? ", partly estimated" : ""
        }`}
      />
      <Kpi
        label={`Due next ${bills.days} days`}
        value={<Money value={bills.upcoming.total} />}
        note={`${bills.upcoming.bills.length} bill${bills.upcoming.bills.length === 1 ? "" : "s"}${
          bills.upcoming.isEstimate ? ", partly estimated" : ""
        }`}
      />
      <Kpi label="Active bills" value={bills.activeCount} note={`${bills.billCount} set up`} />
      <Kpi label={`Paid, ${bills.months} mo`} value={paid} note={`${paid - late} on time`} />
      <Kpi label="Paid late" value={late} note="after the due day" />
      <Kpi label="Skipped" value={skipped} note={`${bills.months} months`} />
    </KpiStrip>
  );
}

/**
 * Bills: what is overdue and due soon, then each bill's paid, skipped and
 * snoozed occurrences.
 *
 * Read-only: paying, skipping and snoozing all go through budgettracker's
 * `settleBill`, and this app has no write path for them. Every bill date is a
 * calendar day rendered as stored, never shifted by the user's offset
 * (budgettracker `.claude/rules/bills.md`).
 */
export default async function BillsPage({ searchParams }: PageProps<"/bills">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const days = parseDays(params.days);
  const months = parseHistory(params.months);

  const bills = await fetchBills(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
    days,
    months,
  });

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-title font-semibold">Bills</h1>
      <BillsNav days={days} months={months} />
    </header>
  );

  if (bills.billCount === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel flush>
          <EmptyState title="No bills set up">
            <p>
              Recurring bills are created in <ManageLink />. Once one exists, it shows here with
              its due date and every payment against it.
            </p>
          </EmptyState>
        </Panel>
      </div>
    );
  }

  const dueCount = bills.overdue.bills.length + bills.upcoming.bills.length;
  const range = `${formatDayKey(bills.history.from)} to ${formatDayKey(bills.history.to)}`;

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      <Totals bills={bills} />

      <Panel
        title="Due"
        meta={`today ${formatDayKey(bills.today)}`}
        actions={<ManageLink>Pay in budgettracker</ManageLink>}
        flush
      >
        {dueCount === 0 ? (
          <EmptyState title={`Nothing due in the next ${bills.days} days`}>
            <p>Nothing is overdue either. Inactive bills are not listed.</p>
          </EmptyState>
        ) : (
          <DueTable bills={bills} />
        )}
      </Panel>

      <section aria-labelledby="history-heading" className="flex flex-col gap-2.5">
        <h2 id="history-heading" className="m-0 flex flex-wrap items-baseline gap-x-2 text-head font-semibold">
          History
          <span className="font-normal text-muted">{range}</span>
        </h2>

        {bills.timelines.length === 0 ? (
          <Panel flush>
            <EmptyState title="No occurrences paid, skipped or snoozed in this window">
              <p>Try a longer history, or settle a bill in <ManageLink />.</p>
            </EmptyState>
          </Panel>
        ) : (
          <div className="grid gap-2.5 desk:grid-cols-2">
            {bills.timelines.map((timeline) => (
              <HistoryPanel key={timeline.summary.billId} timeline={timeline} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
