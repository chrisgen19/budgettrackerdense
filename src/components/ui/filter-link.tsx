import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A filter chip that is a link, not a button.
 *
 * The Ledger keeps every filter in the URL, so toggling one is a navigation:
 * the back button steps through filter changes and a filtered view can be
 * shared. Visually identical to `FilterToken`, which stays for filters that are
 * genuinely client state.
 *
 * `aria-current` rather than `aria-pressed`: a link is not a toggle button, and
 * `aria-pressed` on an anchor is ignored by screen readers.
 */
export function FilterLink({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex h-control shrink-0 items-center rounded-panel border px-2 text-head whitespace-nowrap no-underline ${
        active
          ? "border-ink bg-ink text-bg"
          : "border-rule bg-panel text-ink hover:bg-accent-soft"
      }`}
    >
      {children}
    </Link>
  );
}
