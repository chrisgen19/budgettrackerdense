"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { PRIMARY_NAV, isCurrent } from "@/lib/nav";

/**
 * The sticky command bar (`.d-top`) plus, on a phone, the brand and the
 * scrolling tab row (`.d-tabs`). The command bar is a link to New entry rather
 * than a palette: the command *is* the entry line on that page.
 */
export function TopBar() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-5 flex flex-wrap items-center gap-2 border-b border-rule bg-panel px-3 py-2">
      <span className="mr-1 font-semibold tracking-[0.02em] desk:hidden">LEDGER</span>

      <Link
        href="/new"
        className="flex h-control min-w-[180px] flex-1 items-center gap-2 rounded-panel border border-rule bg-bg px-2 text-muted no-underline hover:text-ink"
      >
        <Terminal aria-hidden className="size-[15px] shrink-0" strokeWidth={1.75} />
        <span className="flex-1 truncate">Type an entry: 250 food @family</span>
        <Kbd>⌘K</Kbd>
      </Link>

      <nav
        aria-label="Pages"
        className="no-scrollbar -mx-3 -mb-2 mt-1 flex w-full overflow-x-auto border-t border-rule-2 px-2 desk:hidden"
      >
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
            className={`min-h-10 border-b-2 px-2.5 py-2 whitespace-nowrap no-underline ${
              isCurrent(item.href, pathname)
                ? "border-accent text-ink"
                : "border-transparent text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
