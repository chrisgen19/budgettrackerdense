import type { ReactNode } from "react";

/** One labelled block in the primitives page. */
export function Specimen({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-4 first:mt-0 ${className}`.trimEnd()}>
      <h3 className="mb-1.5 text-section font-semibold">
        {title}
        {note ? <span className="ml-2 text-head font-normal text-muted">{note}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** The two-column and three-column panel grids from the mockup (`.d-grid`). */
export function PanelGrid({ columns, children }: { columns: "a" | "b"; children: ReactNode }) {
  return (
    <div
      className={`mt-2.5 grid gap-2.5 ${
        columns === "a" ? "desk:grid-cols-[1.6fr_1fr]" : "desk:grid-cols-3"
      }`}
    >
      {children}
    </div>
  );
}
