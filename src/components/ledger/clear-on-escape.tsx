"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DISMISS_EVENT } from "@/lib/dismiss";

/**
 * Escape clears the filters, as the shortcut sheet promises.
 *
 * Renders nothing. It only mounts when something is actually filtered, so
 * Escape on an unfiltered list does not push a pointless history entry.
 */
export function ClearOnEscape({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    const onDismiss = () => router.push(href, { scroll: false });

    document.addEventListener(DISMISS_EVENT, onDismiss);
    return () => document.removeEventListener(DISMISS_EVENT, onDismiss);
  }, [href, router]);

  return null;
}
