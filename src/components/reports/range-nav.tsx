import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonthKey } from "@bt/lib/credit-account-queries";
import { FilterLink } from "@/components/ui/filter-link";
import { monthLabel } from "@/lib/month-nav";
import { RANGE_OPTIONS, type RangeOption } from "@/server/queries/reports";

/** `/reports` with the range and end month it should carry. */
export function reportsHref(endMonth: string, range: RangeOption, isCurrent: boolean): string {
  const params = new URLSearchParams();
  if (!isCurrent) params.set("month", endMonth);
  if (range !== 6) params.set("months", String(range));

  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}

/**
 * How many months, and which month the range ends at.
 *
 * Both are URL parameters, so a view is linkable and the back button steps
 * through it. Changing one keeps the other.
 */
export function RangeNav({
  endMonth,
  range,
  currentMonth,
}: {
  endMonth: string;
  range: RangeOption;
  currentMonth: string;
}) {
  const step = (delta: number) => {
    const target = shiftMonthKey(endMonth, delta);
    return reportsHref(target, range, target === currentMonth);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Range">
        {RANGE_OPTIONS.map((option) => (
          <FilterLink
            key={option}
            href={reportsHref(endMonth, option, endMonth === currentMonth)}
            active={option === range}
          >
            {option} mo
          </FilterLink>
        ))}
      </div>

      <nav aria-label="Range end" className="flex items-center gap-1">
        <Link
          href={step(-1)}
          aria-label={`Back to ${monthLabel(shiftMonthKey(endMonth, -1))}`}
          className="flex size-7 items-center justify-center rounded-panel border border-rule bg-panel text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>

        <span className="min-w-[8.5rem] text-center text-head font-medium">
          {monthLabel(endMonth)}
        </span>

        <Link
          href={step(1)}
          aria-label={`Forward to ${monthLabel(shiftMonthKey(endMonth, 1))}`}
          className="flex size-7 items-center justify-center rounded-panel border border-rule bg-panel text-muted hover:text-ink"
        >
          <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>

        {endMonth === currentMonth ? null : (
          <Link href={reportsHref(currentMonth, range, true)} className="ml-1 text-label text-accent underline">
            This month
          </Link>
        )}
      </nav>
    </div>
  );
}
