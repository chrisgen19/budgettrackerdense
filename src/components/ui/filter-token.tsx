"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export interface FilterTokenProps {
  children: ReactNode;
  /** Controlled state. Leave undefined to let the token manage its own. */
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

/**
 * A filter toggle (`.d-f`). Pressed inverts to ink-on-bg rather than using the
 * accent, so a row of them reads as a set of switches and the accent stays
 * reserved for selection and focus.
 */
export function FilterToken({
  children,
  pressed,
  defaultPressed = false,
  onPressedChange,
}: FilterTokenProps) {
  const [internal, setInternal] = useState(defaultPressed);
  const isPressed = pressed ?? internal;

  return (
    <button
      type="button"
      aria-pressed={isPressed}
      onClick={() => {
        const next = !isPressed;
        if (pressed === undefined) setInternal(next);
        onPressedChange?.(next);
      }}
      className={`h-control shrink-0 cursor-pointer rounded-panel border px-2 text-head whitespace-nowrap ${
        isPressed
          ? "border-ink bg-ink text-bg"
          : "border-rule bg-panel text-ink hover:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A labelled run of tokens (`.d-fgroup`).
 *
 * `shrink-0` because several groups sit side by side in one horizontal
 * scroller: without it flexbox compresses every group to share the width and
 * the chips collapse to slivers. The row around them is what scrolls.
 */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <b className="mr-0.5 ml-1.5 self-center text-label font-medium text-muted">{label}</b>
      {children}
    </div>
  );
}

/** The bar the search field and groups sit on (`.d-bar`). */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-2 flex flex-wrap items-center gap-1.5">{children}</div>;
}
