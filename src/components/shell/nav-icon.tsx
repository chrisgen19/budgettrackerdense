import {
  CalendarClock,
  ChartColumn,
  CreditCard,
  Gauge,
  SquarePlus,
  Table,
  Tag,
  Target,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

const ICONS = { Gauge, Table, SquarePlus, ChartColumn, CalendarClock, CreditCard, Target, Tag };

/**
 * Resolves a nav item's icon name to a lucide component at 15px / 1.75 stroke,
 * the weights the mockup renders icons at (`.m svg.lucide`, `iconStroke`).
 */
export function NavIcon({ name }: { name: NavItem["icon"] }) {
  const Icon = ICONS[name];

  return <Icon aria-hidden className="size-[15px] shrink-0" strokeWidth={1.75} />;
}
