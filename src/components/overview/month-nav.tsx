import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonthKey } from "@bt/lib/credit-account-queries";
import { monthLabel } from "@/lib/month-nav";

/**
 * Previous / next month, as links so the back button works and a month is
 * shareable. The current month carries no `?month=`, so the default URL always
 * means "now" rather than freezing on whatever month it was opened in.
 */
export function MonthNav({
  month,
  currentMonth,
  basePath = "/overview",
}: {
  month: string;
  currentMonth: string;
  basePath?: string;
}) {
  const href = (target: string) =>
    target === currentMonth ? basePath : `${basePath}?month=${target}`;

  return (
    <nav aria-label="Month" className="flex items-center gap-1">
      <Link
        href={href(shiftMonthKey(month, -1))}
        aria-label={`Previous month, ${monthLabel(shiftMonthKey(month, -1))}`}
        className="flex size-7 items-center justify-center rounded-panel border border-rule bg-panel text-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
      </Link>

      <span className="min-w-[8.5rem] text-center text-head font-medium">
        {monthLabel(month)}
      </span>

      <Link
        href={href(shiftMonthKey(month, 1))}
        aria-label={`Next month, ${monthLabel(shiftMonthKey(month, 1))}`}
        className="flex size-7 items-center justify-center rounded-panel border border-rule bg-panel text-muted hover:text-ink"
      >
        <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
      </Link>

      {month === currentMonth ? null : (
        <Link href={basePath} className="ml-1 text-label text-accent underline">
          This month
        </Link>
      )}
    </nav>
  );
}
