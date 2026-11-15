import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageTitle } from "@/lib/app";
import { Showcase } from "./showcase";

export const metadata: Metadata = {
  title: pageTitle("Primitives"),
};

/**
 * Every primitive and chart, in both themes at once.
 *
 * The dark half is a `.dark` wrapper rather than a second page: the dark
 * variant is `&:where(.dark, .dark *)` (src/app/globals.css), so a subtree can
 * be dark while the page around it is light, which is what makes the two
 * columns comparable in one screenshot.
 *
 * Development only. `docs/plans/05-design-system.md` calls this page
 * `/dev/kitchen-sink`; it was built as `/dev/primitives` at Christian's request.
 */
export default function PrimitivesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-title font-semibold">Primitives</h1>
        <p className="text-muted">
          Ported from <code>design-reference/04-data-dense.html</code>. Light above, dark below.
        </p>
      </header>

      <section aria-label="Light theme">
        <Showcase />
      </section>

      <section aria-label="Dark theme" className="dark rounded-panel bg-bg p-3 text-ink">
        <Showcase />
      </section>
    </div>
  );
}
