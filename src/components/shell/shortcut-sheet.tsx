"use client";

import { useEffect, useRef } from "react";
import { Kbd } from "@/components/ui/kbd";
import { groupedShortcuts } from "@/lib/keyboard";

/**
 * The `?` sheet. A native <dialog> so Escape, the backdrop and focus trapping
 * come from the platform rather than from a hand-rolled modal.
 */
export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Keyboard shortcuts"
      className="m-auto w-[min(92vw,460px)] rounded-panel border border-rule bg-panel p-0 text-ink backdrop:bg-black/40"
    >
      <header className="flex items-center justify-between border-b border-rule px-2.5 py-1.5 text-head font-semibold">
        Keyboard shortcuts
        <button type="button" onClick={onClose} className="font-normal text-muted hover:text-ink">
          <Kbd>esc</Kbd>
        </button>
      </header>

      <div className="px-2.5 py-2">
        {groupedShortcuts().map(([group, shortcuts]) => (
          <section key={group} className="mb-3 last:mb-0">
            <h3 className="mb-1 text-label font-medium text-muted">{group}</h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.hint} className="contents">
                  <dt className="text-right">
                    <Kbd>{shortcut.hint}</Kbd>
                  </dt>
                  <dd className="m-0">{shortcut.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
