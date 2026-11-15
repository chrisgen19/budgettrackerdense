import { Money } from "@/components/ui/money";
import { formatDayKey } from "@/lib/bills";
import { labelsFor, type ParsedEntry } from "@/lib/command-parser";
import { QUICK_COUNT, type Draft, type Overrides } from "@/lib/entry-draft";
import type { EntryContext } from "@/server/queries/new-entry";
import { Chip, ChipRow, ParseRow, type ChipOption } from "./chip-row";

export type Choose = <Key extends keyof Overrides>(
  key: Key,
  value: NonNullable<Overrides[Key]>["value"],
) => void;

/** Quick categories of the draft's type, plus whatever the text or a choice points at. */
function categoryOptions(context: EntryContext, parsed: ParsedEntry, draft: Draft): ChipOption[] {
  const ofType = context.categories.filter((category) => category.type === draft.type);
  const shown = new Set(ofType.filter((c) => c.quick).slice(0, QUICK_COUNT).map((c) => c.id));
  if (shown.size === 0) ofType.slice(0, QUICK_COUNT).forEach((c) => shown.add(c.id));
  parsed.categoryCandidates.forEach((id) => shown.add(id));
  if (draft.categoryId) shown.add(draft.categoryId);

  return ofType
    .filter((category) => shown.has(category.id))
    .map((category) => ({
      id: category.id,
      label: category.name,
      highlight: parsed.categoryCandidates.includes(category.id),
    }));
}

function dateNote(draft: Draft, today: string): string {
  if (!draft.dateGiven) return "today, the default";
  return draft.date === today ? "today" : formatDayKey(draft.date);
}

/**
 * The parse table (`.d-parse`): every field the line was read into, as chips
 * that can be changed. What these chips say is what gets saved.
 */
export function ParseTable({
  context,
  parsed,
  draft,
  choose,
}: {
  context: EntryContext;
  parsed: ParsedEntry;
  draft: Draft;
  choose: Choose;
}) {
  const others = context.categories.filter(
    (category) => category.type === draft.type && !categoryOptions(context, parsed, draft).some((o) => o.id === category.id),
  );
  const labelCandidates = new Set(parsed.labels.filter((m) => m.ids.length > 1).flatMap((m) => m.ids));
  const cardCandidates = new Set(parsed.card && parsed.card.ids.length > 1 ? parsed.card.ids : []);
  const selectedLabels = draft.labelIds ?? [];

  return (
    <dl className="m-0 grid grid-cols-[76px_minmax(0,1fr)] border-x border-b border-rule bg-panel wide:grid-cols-[90px_minmax(0,1fr)]">
      <ParseRow term="Amount">
        {draft.amount === null ? (
          <span className="text-muted">type an amount, e.g. 241</span>
        ) : (
          <Money value={draft.type === "EXPENSE" ? -draft.amount : draft.amount} tone={draft.type === "INCOME" ? "income" : "plain"} sign />
        )}
      </ParseRow>

      <ParseRow term="Type">
        <Chip pressed={draft.type === "EXPENSE"} onClick={() => choose("type", "EXPENSE")}>Expense</Chip>
        <Chip pressed={draft.type === "INCOME"} onClick={() => choose("type", "INCOME")}>Income</Chip>
      </ParseRow>

      <ParseRow term="Category">
        <ChipRow
          options={categoryOptions(context, parsed, draft)}
          selected={draft.categoryId ? [draft.categoryId] : []}
          onToggle={(id) => choose("categoryId", draft.categoryId === id ? null : id)}
        />
        {others.length > 0 ? (
          <select
            aria-label="More categories"
            value=""
            onChange={(event) => event.target.value && choose("categoryId", event.target.value)}
            className="min-h-[30px] rounded-chip border border-rule bg-bg px-1 text-head text-muted"
          >
            <option value="">More…</option>
            {others.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
      </ParseRow>

      <ParseRow term="Labels">
        <ChipRow
          options={labelsFor(context.labels, draft.type).map((label) => ({
            id: label.id,
            label: label.name,
            highlight: labelCandidates.has(label.id),
          }))}
          selected={selectedLabels}
          onToggle={(id) =>
            choose(
              "labelIds",
              selectedLabels.includes(id) ? selectedLabels.filter((x) => x !== id) : [...selectedLabels, id],
            )
          }
        />
        {draft.labelIds === undefined ? (
          <span className="text-label text-muted">none named: label schedules apply</span>
        ) : null}
      </ParseRow>

      <ParseRow term="Source">
        <Chip pressed={draft.cardId === null} onClick={() => choose("cardId", null)}>Cash</Chip>
        <ChipRow
          options={context.cards.map((card) => ({ id: card.id, label: card.name, highlight: cardCandidates.has(card.id) }))}
          selected={draft.cardId ? [draft.cardId] : []}
          onToggle={(id) => choose("cardId", id)}
        />
      </ParseRow>

      <ParseRow term="Note">
        {draft.description ? (
          <span className="min-w-0 break-words font-mono text-figure">{draft.description}</span>
        ) : (
          <span className="text-muted">none</span>
        )}
      </ParseRow>

      <ParseRow term="Date">
        <span className="tnum text-figure">{draft.date}</span>
        <span className="text-label text-muted">{dateNote(draft, context.today)}</span>
      </ParseRow>
    </dl>
  );
}
