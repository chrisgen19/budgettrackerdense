"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kbd } from "@/components/ui/kbd";
import { ACCOUNTS_NAV, type NavItem, PRIMARY_NAV, isCurrent } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { ThemeToggle } from "./theme-toggle";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const current = isCurrent(item.href, pathname);

  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-2 rounded-panel px-2 py-[5px] ${
        current ? "bg-accent-soft text-ink" : "text-muted hover:bg-rule-2 hover:text-ink"
      }`}
    >
      <NavIcon name={item.icon} />
      {item.label}
      <span className="ml-auto">
        <Kbd>{item.hint}</Kbd>
      </span>
    </Link>
  );
}

/**
 * The 196px sidebar from the mockup (`.d-side`), desktop only. Sticky below the
 * command bar, with the Accounts group and the footer hints.
 */
export function Sidebar({ monthLabel }: { monthLabel: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-sidebar flex-col gap-px self-start border-r border-rule bg-panel px-2 py-2.5 desk:row-span-2 desk:flex"
    >
      <div className="flex justify-between px-2 pt-1 pb-3 font-semibold">
        <span>LEDGER</span>
        <span className="tnum text-label text-muted">{monthLabel}</span>
      </div>

      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <h2 className="mx-2 mt-3 mb-1 text-label font-medium text-muted">Accounts</h2>
      {ACCOUNTS_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="mt-auto p-2 text-label leading-[1.8] text-muted">
        <Kbd>/</Kbd> search &nbsp; <Kbd>?</Kbd> shortcuts
        <ThemeToggle />
      </div>
    </nav>
  );
}
