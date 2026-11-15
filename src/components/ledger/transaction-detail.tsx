import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";
import { Swatch, Token } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import { transactionUrl } from "@/lib/links";
import type { TransactionDetail } from "@/server/queries/transaction-detail";

/** Which surface a row came from, in words. */
const SOURCE_LABEL: Record<string, string> = {
  APP: "the app",
  MCP: "an MCP client",
  TELEGRAM: "Telegram",
  SCAN: "a receipt scan",
  DENSE: "this app",
};

const describeSource = (value: string) => SOURCE_LABEL[value] ?? value;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1.5 pr-3 text-muted">{label}</dt>
      <dd className="m-0 py-1.5">{children}</dd>
    </>
  );
}

/**
 * The read-only detail panel.
 *
 * Read-only on purpose: budgettracker owns editing and deleting in v1
 * (docs/plans/06-pages.md), so the only action here is a link there.
 */
export function TransactionDetailPanel({
  detail,
  closeHref,
}: {
  detail: TransactionDetail;
  closeHref: string;
}) {
  const itemsDiffer =
    detail.receiptItems.length > 0 &&
    Math.abs(detail.receiptTotal - detail.amount) > 0.005;

  return (
    <article>
      <header className="flex items-center justify-between gap-2 border-b border-rule px-2.5 py-1.5 text-head font-semibold">
        <span className="truncate">{detail.description}</span>
        <Link href={closeHref} scroll={false} className="font-normal text-muted hover:text-ink">
          <Kbd>esc</Kbd>
        </Link>
      </header>

      <div className="px-2.5 py-2">
        <p className="mb-2">
          <Money
            value={detail.type === "INCOME" ? detail.amount : -detail.amount}
            tone={detail.type === "INCOME" ? "income" : "plain"}
            sign={detail.type === "INCOME"}
            className="text-kpi"
          />
        </p>

        <dl className="m-0 grid grid-cols-[6.5rem_1fr] text-body">
          <Field label="When">
            <span className="tnum text-figure">
              {detail.localDate} {detail.localTime}
            </span>
          </Field>

          <Field label="Category">
            <Swatch color={detail.categoryColor} />
            {detail.categoryName}
          </Field>

          <Field label="Source">{detail.creditAccountName ?? "Cash / debit"}</Field>

          <Field label="Labels">
            {detail.labels.length === 0 ? (
              <span className="text-muted">none</span>
            ) : (
              detail.labels.map((label) => <Token key={label.id}>{label.name}</Token>)
            )}
          </Field>

          {detail.billName ? <Field label="Bill">{detail.billName}</Field> : null}

          <Field label="Created">
            {describeSource(detail.createdVia)}
            {detail.updatedVia ? `, last edited from ${describeSource(detail.updatedVia)}` : null}
          </Field>
        </dl>

        {detail.receiptItems.length > 0 ? (
          <section className="mt-3">
            <h3 className="mb-1 text-label font-medium text-muted">
              Receipt{detail.receiptGroupId ? ", part of a multi-category scan" : ""}
            </h3>
            <table className="w-full border-collapse">
              <caption className="sr-only">Scanned line items</caption>
              <tbody>
                {detail.receiptItems.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td className="h-subrow border-b border-rule-2 pr-2">{item.name}</td>
                    <td className="h-subrow border-b border-rule-2 text-right tnum text-figure">
                      <Money value={item.amount} bare />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itemsDiffer ? (
              <p className="mt-1 text-label text-muted">
                Line items total <Money value={detail.receiptTotal} bare />, which differs from the
                transaction. The transaction amount is what counts everywhere else.
              </p>
            ) : null}
          </section>
        ) : null}

        <p className="mt-3 text-label text-muted">
          Editing stays in budgettracker.{" "}
          <Link
            href={transactionUrl(detail.id)}
            className="text-accent underline"
            target="_blank"
            rel="noreferrer"
          >
            Open it there
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
