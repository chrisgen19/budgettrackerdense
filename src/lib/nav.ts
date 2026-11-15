/**
 * The navigation model, shared by the sidebar, the mobile tab row and the
 * keyboard map. Icon names are lucide-react exports, resolved in
 * src/components/shell/nav-icon.tsx so this module stays free of JSX.
 */
export interface NavItem {
  href: string;
  label: string;
  /** A lucide-react icon name. */
  icon: "Gauge" | "Table" | "SquarePlus" | "ChartColumn" | "CalendarClock" | "CreditCard" | "Target" | "Tag";
  /** The hint printed beside it, matching src/lib/keyboard.ts. */
  hint: string;
}

/** The four primary destinations, also the mobile tab row (`NAV` in the mockup). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/overview", label: "Overview", icon: "Gauge", hint: "g o" },
  { href: "/ledger", label: "Ledger", icon: "Table", hint: "g l" },
  { href: "/new", label: "New entry", icon: "SquarePlus", hint: "n" },
  { href: "/reports", label: "Reports", icon: "ChartColumn", hint: "g r" },
];

/** The "Accounts" group in the sidebar (`MORE` in the mockup). */
export const ACCOUNTS_NAV: readonly NavItem[] = [
  { href: "/bills", label: "Bills", icon: "CalendarClock", hint: "g b" },
  { href: "/cards", label: "Cards", icon: "CreditCard", hint: "g c" },
  { href: "/budgets", label: "Budgets", icon: "Target", hint: "g u" },
  { href: "/labels", label: "Labels", icon: "Tag", hint: "g t" },
];

/** Whether `href` is the page currently shown, for `aria-current`. */
export function isCurrent(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
