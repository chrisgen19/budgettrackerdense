import type { ReactNode } from "react";

export interface ChipOption {
  id: string;
  label: string;
  /** A candidate the text matched but could not settle on: drawn with a ring. */
  highlight?: boolean;
}

/** `.d-opt`: a toggle chip. `aria-pressed` because it is a toggle, unlike FilterLink. */
export function Chip({
  pressed,
  highlight = false,
  disabled = false,
  onClick,
  children,
}: {
  pressed: boolean;
  highlight?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[30px] cursor-pointer rounded-chip border px-2 text-head disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed
          ? "border-accent bg-accent text-accent-ink"
          : highlight
            ? "border-accent bg-accent-soft text-ink ring-1 ring-accent"
            : "border-rule bg-bg text-ink hover:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}

/** One `dt`/`dd` pair of the parse table (`.d-parse`). */
export function ParseRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="m-0 border-t border-rule-2 px-2.5 py-1.5 text-muted">{term}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-t border-rule-2 px-2.5 py-1.5">
        {children}
      </dd>
    </>
  );
}

/** A row of single- or multi-select chips. */
export function ChipRow({
  options,
  selected,
  onToggle,
  disabled = false,
}: {
  options: readonly ChipOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {options.map((option) => (
        <Chip
          key={option.id}
          pressed={selected.includes(option.id)}
          highlight={option.highlight}
          disabled={disabled}
          onClick={() => onToggle(option.id)}
        >
          {option.label}
        </Chip>
      ))}
    </>
  );
}
