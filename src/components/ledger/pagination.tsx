import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, type LedgerFilters, ledgerHref } from "@/lib/ledger-filters";

/**
 * Server-side paging. Links, not buttons: a page is part of the view's
 * address, so it survives a reload and the back button steps through it.
 *
 * Labelled "Ledger pages" because the shell's mobile tab row is already the
 * "Pages" landmark, and two landmarks with one name cannot be told apart.
 */
export function Pagination({
  filters,
  page,
  totalPages,
  total,
  shown,
}: {
  filters: LedgerFilters;
  page: number;
  totalPages: number;
  total: number;
  shown: number;
}) {
  if (totalPages <= 1) return null;

  const first = (page - 1) * PAGE_SIZE + 1;
  const step = (delta: number) => ledgerHref(filters, { page: page + delta });

  return (
    <nav
      aria-label="Ledger pages"
      className="flex items-center justify-between gap-2 border-t border-rule px-2.5 py-1.5 text-label text-muted"
    >
      <span className="tnum">
        {first}-{first + shown - 1} of {total}
      </span>

      <span className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={step(-1)}
            rel="prev"
            className="flex size-6 items-center justify-center rounded-panel border border-rule bg-panel hover:text-ink"
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden className="size-3.5" strokeWidth={1.75} />
          </Link>
        ) : null}

        <span className="tnum px-1">
          {page} / {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={step(1)}
            rel="next"
            className="flex size-6 items-center justify-center rounded-panel border border-rule bg-panel hover:text-ink"
            aria-label="Next page"
          >
            <ChevronRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
