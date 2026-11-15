/**
 * What the New entry form will save: the parsed command line with the user's
 * chip choices on top. The chips, not the text, are what gets saved
 * (docs/plans/07-quick-entry-writes.md).
 *
 * A chip choice remembers the parsed value it replaced. While the text still
 * parses to that value the choice stands, so fixing a typo in the description
 * does not undo a category the user picked. Once the text says something new
 * about that field, the text wins again.
 */
import { labelsFor, type EntryType, type ParseContext, type ParsedEntry } from "./command-parser";

/** Quick categories per type: the chips shown before the rest fold into "More". */
export const QUICK_COUNT = 9;

export interface Override<Value> {
  value: Value;
  /** The parsed value's signature when the choice was made. */
  basis: string;
}

export interface Overrides {
  type?: Override<EntryType>;
  categoryId?: Override<string | null>;
  /** `[]` is an explicit "no labels", which turns label schedules off for this entry. */
  labelIds?: Override<string[]>;
  cardId?: Override<string | null>;
}

export interface Draft {
  amount: number | null;
  type: EntryType;
  categoryId: string | null;
  /** Undefined: no label named or chosen, so budgettracker's schedules decide. */
  labelIds: string[] | undefined;
  cardId: string | null;
  description: string;
  date: string;
  dateGiven: boolean;
  /** A label chip choice is in force, which settles any ambiguous `@` token. */
  labelsChosen: boolean;
}

/** The signature each override is checked against. */
export const basisOf = {
  type: (parsed: ParsedEntry) => parsed.type,
  categoryId: (parsed: ParsedEntry) =>
    `${parsed.type}|${parsed.categoryId ?? ""}|${parsed.categoryCandidates.join(",")}`,
  labelIds: (parsed: ParsedEntry) => `${parsed.type}|${JSON.stringify(parsed.labels)}`,
  cardId: (parsed: ParsedEntry) => JSON.stringify(parsed.card),
};

const holds = <Value>(override: Override<Value> | undefined, basis: string): boolean =>
  override !== undefined && override.basis === basis;

const pick = <Value>(override: Override<Value> | undefined, basis: string, fallback: Value): Value =>
  override && holds(override, basis) ? override.value : fallback;

/** Labels the text resolved to one id each. Undefined when no `@` token was typed. */
const parsedLabelIds = (parsed: ParsedEntry): string[] | undefined => {
  if (parsed.labels.length === 0) return undefined;
  return parsed.labels.flatMap((match) => (match.ids.length === 1 ? match.ids : []));
};

export const resolveDraft = (parsed: ParsedEntry, overrides: Overrides): Draft => ({
  amount: parsed.amount,
  type: pick(overrides.type, basisOf.type(parsed), parsed.type),
  categoryId: pick(overrides.categoryId, basisOf.categoryId(parsed), parsed.categoryId),
  labelIds: pick<string[] | undefined>(overrides.labelIds, basisOf.labelIds(parsed), parsedLabelIds(parsed)),
  cardId: pick(
    overrides.cardId,
    basisOf.cardId(parsed),
    parsed.card && parsed.card.ids.length === 1 ? (parsed.card.ids[0] ?? null) : null,
  ),
  description: parsed.description,
  date: parsed.date,
  dateGiven: parsed.dateGiven,
  labelsChosen: holds(overrides.labelIds, basisOf.labelIds(parsed)),
});

/** A choice to remember against the current parse. */
export const choose = <Key extends keyof Overrides>(
  overrides: Overrides,
  key: Key,
  value: NonNullable<Overrides[Key]>["value"],
  parsed: ParsedEntry,
): Overrides => ({ ...overrides, [key]: { value, basis: basisOf[key](parsed) } });

export interface SaveReady {
  type: EntryType;
  amount: number;
  categoryId: string;
  labelIds?: string[];
  creditAccountId?: string | null;
  description: string;
  date: string;
}

/**
 * The draft as the write seam takes it, or what is still missing. Problems are
 * phrased for the user. A card on income is not one of them: the write itself
 * refuses it, and the page shows that refusal rather than a second rule here.
 */
export const readyToSave = (
  draft: Draft,
  parsed: ParsedEntry,
  context: Pick<ParseContext, "categories" | "labels">,
): { ok: true; input: SaveReady } | { ok: false; problems: string[] } => {
  const problems: string[] = [];
  if (draft.amount === null) problems.push("Type an amount.");

  const category = context.categories.find((item) => item.id === draft.categoryId);
  if (!category) {
    problems.push(parsed.categoryCandidates.length > 1 ? "Pick one of the matching categories." : "Pick a category.");
  } else if (category.type !== draft.type) {
    problems.push(`${category.name} is not an ${draft.type.toLowerCase()} category.`);
  }

  const ambiguous = parsed.labels.filter((match) => match.ids.length > 1);
  if (ambiguous.length > 0 && !draft.labelsChosen) {
    problems.push(`Pick a label for ${ambiguous.map((match) => match.token).join(", ")}.`);
  }
  if (parsed.card && parsed.card.ids.length > 1 && draft.cardId === null) {
    problems.push(`Pick a card for ${parsed.card.token}.`);
  }

  if (problems.length > 0 || draft.amount === null || !category) return { ok: false, problems };

  const usable = new Set(labelsFor(context.labels, draft.type).map((label) => label.id));
  return {
    ok: true,
    input: {
      type: draft.type,
      amount: draft.amount,
      categoryId: category.id,
      ...(draft.labelIds !== undefined && { labelIds: draft.labelIds.filter((id) => usable.has(id)) }),
      ...(draft.cardId !== null && { creditAccountId: draft.cardId }),
      description: draft.description,
      date: draft.date,
    },
  };
};
