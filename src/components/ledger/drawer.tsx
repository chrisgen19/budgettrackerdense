"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * The shell the detail panel sits in: a native `<dialog>`, so Escape, focus
 * trapping and the backdrop come from the platform.
 *
 * The content is a server component passed as `children`; this only owns the
 * opening and closing. Closing navigates rather than setting state, because the
 * drawer is a URL (`?tx=`) and the back button has to close it too.
 */
export function Drawer({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => router.push(closeHref, { scroll: false });

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, not its content.
        if (event.target === ref.current) close();
      }}
      aria-label="Transaction detail"
      className="m-auto w-[min(94vw,520px)] rounded-panel border border-rule bg-panel p-0 text-ink backdrop:bg-black/40"
    >
      {children}
    </dialog>
  );
}
