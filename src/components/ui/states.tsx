import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** One line in ink, e.g. "No entries for October 2026". */
  title: ReactNode;
  /** The next action, usually naming a shortcut. */
  children?: ReactNode;
}

/** `.d-empty`: centred, muted, with the headline in ink. */
export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="px-3 py-7 text-center text-muted">
      <b className="mb-1 block text-[14px] font-semibold text-ink">{title}</b>
      {children}
    </div>
  );
}

/**
 * The same shape as EmptyState but for a failed read. Separate component so a
 * page cannot accidentally report a broken query as "no data", which for money
 * is the one lie that matters.
 */
export function ErrorState({ title, children }: EmptyStateProps) {
  return (
    <div role="alert" className="px-3 py-7 text-center text-muted">
      <CircleAlert aria-hidden className="mx-auto mb-2 size-5 text-expense" strokeWidth={1.75} />
      <b className="mb-1 block text-[14px] font-semibold text-ink">{title}</b>
      {children}
    </div>
  );
}

/**
 * One loading bar (`.sk.l`). Skeletons mirror the panel they replace rather
 * than spinning: the layout is the point of this design, so it should not move
 * when the data lands.
 */
export function SkeletonLine({ width = "100%", height = 10 }: { width?: string; height?: number }) {
  return (
    <div className="my-[9px] rounded-[2px] bg-sk" style={{ width, height }} aria-hidden />
  );
}

/** `lines` bars, with the last one short so it reads as text. */
export function SkeletonLines({ lines = 6 }: { lines?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine key={index} width={index === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

/** A solid block, for a chart's area. */
export function SkeletonBlock({ height = 180 }: { height?: number }) {
  return <div className="rounded-[2px] bg-sk" style={{ height }} aria-hidden />;
}
