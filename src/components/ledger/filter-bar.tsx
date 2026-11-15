import { Search, X } from "lucide-react";
import Link from "next/link";
import { FilterGroup } from "@/components/ui/filter-token";
import { FilterLink } from "@/components/ui/filter-link";
import { Kbd } from "@/components/ui/kbd";
import { Swatch } from "@/components/ui/data-table";
import type { CategoryItem, LabelItem } from "@bt/lib/budget-query-types";
import type { CreditAccountSummary } from "@bt/lib/credit-account-queries";
import { SEARCH_FIELD_ATTRIBUTE } from "@/lib/keyboard";
import {
  type LedgerFilters,
  isUnfiltered,
  ledgerHref,
  toggleLabel,
  toggleValue,
  toSearchParams,
} from "@/lib/ledger-filters";
import { monthShort } from "@/lib/month-nav";

/**
 * The filter bar. Every control is a link or a GET form, so the server renders
 * the result and nothing depends on JavaScript being ready.
 */
export function FilterBar({
  filters,
  categories,
  labels,
  cards,
  usedCategoryIds,
  clearedHref,
}: {
  filters: LedgerFilters;
  categories: readonly CategoryItem[];
  labels: readonly LabelItem[];
  cards: readonly CreditAccountSummary[];
  /** Categories that actually appear in this window, shown before the rest. */
  usedCategoryIds: readonly string[];
  /** The same list with every filter but the date window dropped. */
  clearedHref: string;
}) {
  // The text form posts itself; everything else has to ride along as hidden
  // fields or a search would silently clear the chips.
  const carried = toSearchParams({ ...filters, search: null, amountMin: null, amountMax: null, page: 1 });

  const shown = categories
    .filter((category) => usedCategoryIds.includes(category.id) || category.id === filters.categoryId)
    .slice(0, 8);

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Wraps rather than overflowing: the amount inputs and Apply cannot
            shrink below their content, which pushed the whole page sideways at
            390 before. The page never scrolls horizontally; only tables do. */}
        <form
          method="get"
          action="/ledger"
          className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-1.5"
        >
          {[...carried].map(([key, value]) => (
            <input key={`${key}=${value}`} type="hidden" name={key} value={value} />
          ))}

          <label className="flex h-control min-w-0 flex-[1_1_9rem] items-center gap-1.5 rounded-panel border border-rule bg-panel px-2">
            <Search aria-hidden className="size-[15px] shrink-0 text-muted" strokeWidth={1.75} />
            <span className="sr-only">Filter rows</span>
            <input
              {...{ [SEARCH_FIELD_ATTRIBUTE]: "" }}
              type="search"
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder="Filter rows"
              className="min-w-0 flex-1 border-0 bg-transparent font-sans text-body text-ink outline-0"
            />
            <Kbd>/</Kbd>
          </label>

          <label className="flex h-control items-center gap-1 rounded-panel border border-rule bg-panel px-2 text-label text-muted">
            min
            <input
              type="number"
              name="min"
              min={0}
              step="0.01"
              defaultValue={filters.amountMin ?? ""}
              className="w-14 min-w-0 border-0 bg-transparent tnum text-figure text-ink outline-0"
            />
          </label>
          <label className="flex h-control items-center gap-1 rounded-panel border border-rule bg-panel px-2 text-label text-muted">
            max
            <input
              type="number"
              name="max"
              min={0}
              step="0.01"
              defaultValue={filters.amountMax ?? ""}
              className="w-14 min-w-0 border-0 bg-transparent tnum text-figure text-ink outline-0"
            />
          </label>

          <button
            type="submit"
            className="h-control cursor-pointer rounded-panel border border-rule bg-panel px-2 text-head hover:bg-accent-soft"
          >
            Apply
          </button>
        </form>

        {isUnfiltered(filters) ? null : (
          <Link
            href={clearedHref}
            className="flex h-control items-center gap-1 rounded-panel border border-rule bg-panel px-2 text-head text-muted no-underline hover:text-ink"
          >
            <X aria-hidden className="size-[13px]" strokeWidth={1.75} />
            Clear
            <Kbd>esc</Kbd>
          </Link>
        )}
      </div>

      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        <FilterGroup label="Date">
          <FilterLink
            href={ledgerHref(filters, { range: "today", month: null, from: null, to: null })}
            active={filters.range === "today"}
          >
            Today
          </FilterLink>
          <FilterLink
            href={ledgerHref(filters, { range: "7d", month: null, from: null, to: null })}
            active={filters.range === "7d"}
          >
            7d
          </FilterLink>
          <FilterLink
            href={ledgerHref(filters, { range: "month", from: null, to: null })}
            active={filters.range === "month"}
          >
            {filters.month ? monthShort(filters.month) : "Month"}
          </FilterLink>
        </FilterGroup>

        <FilterGroup label="Type">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <FilterLink
              key={type}
              href={ledgerHref(filters, { type: toggleValue(filters.type, type) })}
              active={filters.type === type}
            >
              {type === "EXPENSE" ? "Out" : "In"}
            </FilterLink>
          ))}
        </FilterGroup>

        {/* Nothing matched, so there are no categories to offer: a bare "Cat"
            label with no chips reads as a broken control. */}
        {shown.length === 0 ? null : (
        <FilterGroup label="Cat">
          {shown.map((category) => (
            <FilterLink
              key={category.id}
              href={ledgerHref(filters, {
                categoryId: toggleValue(filters.categoryId, category.id),
              })}
              active={filters.categoryId === category.id}
            >
              <Swatch color={category.color} />
              {category.name}
            </FilterLink>
          ))}
        </FilterGroup>
        )}

        <FilterGroup label="Label">
          {labels.map((label) => (
            <FilterLink
              key={label.id}
              href={ledgerHref(filters, { labelIds: toggleLabel(filters, label.id) })}
              active={filters.labelIds.includes(label.id)}
            >
              <Swatch color={label.color} />
              {label.name}
            </FilterLink>
          ))}
        </FilterGroup>

        <FilterGroup label="Card">
          <FilterLink
            href={ledgerHref(filters, { card: toggleValue(filters.card, "none") })}
            active={filters.card === "none"}
          >
            Cash
          </FilterLink>
          {cards.map((card) => (
            <FilterLink
              key={card.id}
              href={ledgerHref(filters, { card: toggleValue(filters.card, card.id) })}
              active={filters.card === card.id}
            >
              <Swatch color={card.color} />
              {card.name}
            </FilterLink>
          ))}
        </FilterGroup>
      </div>
    </div>
  );
}
