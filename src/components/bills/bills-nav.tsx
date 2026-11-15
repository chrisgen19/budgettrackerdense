import { FilterLink } from "@/components/ui/filter-link";
import {
  DAY_OPTIONS,
  HISTORY_OPTIONS,
  billsHref,
  type DayOption,
  type HistoryOption,
} from "@/lib/bills";

/**
 * How far ahead the Due panel looks and how far back the history goes. Both
 * are URL parameters, so a view is linkable; changing one keeps the other.
 */
export function BillsNav({ days, months }: { days: DayOption; months: HistoryOption }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex items-center gap-1" role="group" aria-label="Look ahead">
        <span className="mr-1 text-label text-muted">Ahead</span>
        {DAY_OPTIONS.map((option) => (
          <FilterLink key={option} href={billsHref(option, months)} active={option === days}>
            {option}d
          </FilterLink>
        ))}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="History">
        <span className="mr-1 text-label text-muted">History</span>
        {HISTORY_OPTIONS.map((option) => (
          <FilterLink key={option} href={billsHref(days, option)} active={option === months}>
            {option} mo
          </FilterLink>
        ))}
      </div>
    </div>
  );
}
