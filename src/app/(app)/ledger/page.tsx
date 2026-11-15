import type { Metadata } from "next";
import { ClearOnEscape } from "@/components/ledger/clear-on-escape";
import { Drawer } from "@/components/ledger/drawer";
import { FilterBar } from "@/components/ledger/filter-bar";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { Pagination } from "@/components/ledger/pagination";
import { TransactionDetailPanel } from "@/components/ledger/transaction-detail";
import { Kbd } from "@/components/ui/kbd";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import {
  closeDetailHref,
  isUnfiltered,
  ledgerHref,
  parseLedgerFilters,
} from "@/lib/ledger-filters";
import { monthLabel } from "@/lib/month-nav";
import { prisma } from "@/server/db";
import { fetchLedgerPage } from "@/server/queries/ledger-page";
import { fetchTransactionDetail } from "@/server/queries/transaction-detail";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Ledger"),
};

/** What the window is called in a sentence. */
function windowLabel(filters: ReturnType<typeof parseLedgerFilters>): string {
  if (filters.range === "today") return "today";
  if (filters.range === "7d") return "the last 7 days";
  if (filters.range === "month" && filters.month) return monthLabel(filters.month);

  return [filters.from, filters.to].filter(Boolean).join(" to ") || "this range";
}

/**
 * Every transaction in the window, grouped by day.
 *
 * Filters, paging and the open row all live in `searchParams`, so a view is
 * linkable, the back button steps through it, and the server renders the
 * result rather than shipping the month to the browser to filter there.
 */
export default async function LedgerPage({ searchParams }: PageProps<"/ledger">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const filters = parseLedgerFilters(params, { timezoneOffset: user.timezoneOffset });
  const { ledger, categories, labels, cards, isEmpty } = await fetchLedgerPage(
    prisma,
    user.id,
    filters,
    user.timezoneOffset,
  );

  const openId = typeof params.tx === "string" ? params.tx : null;
  const detail = openId
    ? await fetchTransactionDetail(prisma, user.id, openId, user.timezoneOffset)
    : null;

  const { totals, pagination } = ledger;
  const usedCategoryIds = [...new Set(ledger.rows.map((row) => row.categoryId))];
  const clearedHref = ledgerHref(filters, {
    search: null,
    categoryId: null,
    labelIds: [],
    card: null,
    type: null,
    amountMin: null,
    amountMax: null,
  });

  return (
    <div className="flex flex-col gap-2.5">
      {isUnfiltered(filters) || detail ? null : <ClearOnEscape href={clearedHref} />}

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-title font-semibold">Ledger</h1>
        <p className="text-label text-muted">{windowLabel(filters)}</p>
      </header>

      <FilterBar
        filters={filters}
        categories={categories}
        labels={labels}
        cards={cards}
        usedCategoryIds={usedCategoryIds}
        clearedHref={clearedHref}
      />

      <Panel
        title={
          <>
            <span className="tnum">{totals.count}</span> row{totals.count === 1 ? "" : "s"}
          </>
        }
        meta={
          <span className="flex items-center gap-2">
            <span>
              in <Money value={totals.income} tone="income" bare sign />
            </span>
            <span>
              out <Money value={-totals.expenses} bare />
            </span>
            <span>
              net{" "}
              <Money
                value={totals.net}
                tone={totals.net < 0 ? "expense" : "income"}
                bare
                sign
              />
            </span>
          </span>
        }
        actions={
          <span className="hidden wide:inline">
            <Kbd>j</Kbd> <Kbd>k</Kbd> move, <Kbd>⏎</Kbd> open
          </span>
        }
        flush
      >
        {isEmpty ? (
          <EmptyState
            title={
              isUnfiltered(filters)
                ? `Nothing logged in ${windowLabel(filters)}`
                : "No rows match these filters"
            }
          >
            {isUnfiltered(filters) ? (
              <>
                Press <Kbd>n</Kbd> or type into the command bar to add an entry.
              </>
            ) : (
              <>
                Press <Kbd>esc</Kbd> or{" "}
                <a href={clearedHref} className="text-accent underline">
                  clear the filters
                </a>
                .
              </>
            )}
          </EmptyState>
        ) : (
          <>
            <LedgerTable
              days={ledger.days}
              filters={filters}
              timezoneOffset={user.timezoneOffset}
            />
            <Pagination
              filters={filters}
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              shown={ledger.rows.length}
            />
          </>
        )}
      </Panel>

      {detail ? (
        <Drawer closeHref={closeDetailHref(filters)}>
          <TransactionDetailPanel detail={detail} closeHref={closeDetailHref(filters)} />
        </Drawer>
      ) : null}
    </div>
  );
}
