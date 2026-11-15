/**
 * The New entry command line: `241 transpo @tnvs indrive v mall to mirea`.
 *
 * Deterministic and pure (docs/plans/07-quick-entry-writes.md). budgettracker's
 * Telegram path sends free text to a model; this one never guesses. A token
 * that matches two categories, labels or cards leaves the field unset and hands
 * back both as candidates for the user to pick from a chip.
 *
 * Tokens, in any order:
 * - amount: the first number, `241`, `241.50`, `1,250`; a leading `+` makes it income
 * - category: the first word (3+ characters) that starts a category name of the entry's type
 * - `@label`: a label name prefix, spaces ignored (`@withmom`)
 * - `#card`: a card name prefix
 * - date: `y`, `yesterday`, `today`, a weekday (`mon`, `monday`), `9/27`, `2026-09-27`
 * - anything else is the description, in its original case
 *
 * "Today" is the user's calendar day, passed in as a key so the parser has no
 * clock and no timezone of its own.
 */
import { parseCalendarDay, shiftCalendarDay } from "@bt/lib/period-progress";

export type EntryType = "EXPENSE" | "INCOME";

export interface ParseCategory {
  id: string;
  name: string;
  type: EntryType;
  /** Used recently. Searched first, so a common category wins over a rare one. */
  quick: boolean;
}

export interface ParseLabel {
  id: string;
  name: string;
  /** EXPENSE, INCOME or BOTH. */
  applicableTo: string;
}

export interface ParseCard {
  id: string;
  name: string;
}

export interface ParseContext {
  categories: readonly ParseCategory[];
  labels: readonly ParseLabel[];
  cards: readonly ParseCard[];
  /** The user's calendar day, `YYYY-MM-DD`. */
  today: string;
}

/** One `@` or `#` token and what it matched: one id is resolved, two or more is ambiguous. */
export interface TokenMatch {
  token: string;
  ids: string[];
}

export interface ParsedEntry {
  amount: number | null;
  type: EntryType;
  categoryId: string | null;
  /** Set when the category word matched more than one category. */
  categoryCandidates: string[];
  /** Every `@` token. Undefined-vs-empty for saving is decided from this, not here. */
  labels: TokenMatch[];
  card: TokenMatch | null;
  /** `YYYY-MM-DD`. Today when no date token was given. */
  date: string;
  /** Whether a date token was given, so the UI can say "today" was a default. */
  dateGiven: boolean;
  description: string;
  /** Things the user should see before saving: unknown labels, a card on income. */
  warnings: string[];
}

const AMOUNT = /^\+?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DAY = /^(\d{1,2})\/(\d{1,2})$/;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** Shorter than this is too likely to be "to", "v" or "at" to be read as a category. */
const MIN_CATEGORY_TOKEN = 3;

/** Lowercase, letters and digits only: "With Mom and Dad" becomes "withmomanddad". */
export const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");

const isRealDay = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A date token as a `YYYY-MM-DD` day, or null when the token is not a date.
 * A weekday is the most recent *past* one, never today: "mon" typed on a Monday
 * means last Monday, since today needs no token at all.
 */
export const parseDateToken = (token: string, today: string): string | null => {
  const word = token.toLowerCase();
  if (word === "today") return today;
  if (word === "y" || word === "yesterday") return shiftCalendarDay(today, -1);

  const weekday = WEEKDAYS.findIndex((short, index) => word === short || word === WEEKDAY_NAMES[index]);
  if (weekday !== -1) {
    const current = parseCalendarDay(today).getUTCDay();
    const back = (current - weekday + 7) % 7 || 7;
    return shiftCalendarDay(today, -back);
  }

  const iso = ISO_DAY.exec(token);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDay(year, month, day) ? token : null;
  }

  const slash = SLASH_DAY.exec(token);
  if (slash) {
    const [month, day] = [Number(slash[1]), Number(slash[2])];
    const year = Number(today.slice(0, 4));
    if (!isRealDay(year, month, day)) return null;
    const key = `${year}-${pad(month)}-${pad(day)}`;
    // A day later than today is last year's: nobody logs a purchase ahead of time.
    return key > today ? `${year - 1}-${pad(month)}-${pad(day)}` : key;
  }

  return null;
};

/** `1,250.50` to 1250.5, or null. */
const parseAmount = (token: string): number | null => {
  if (!AMOUNT.test(token)) return null;
  const value = Number(token.replace(/[+,]/g, ""));
  return Number.isFinite(value) ? value : null;
};

/**
 * Categories a word could mean. An exact name wins outright; otherwise quick
 * categories are searched first, and only when none of them matches are the rest.
 */
export const matchCategory = (word: string, categories: readonly ParseCategory[]): string[] => {
  const token = squash(word);
  if (token.length < MIN_CATEGORY_TOKEN) return [];

  const exact = categories.filter((category) => squash(category.name) === token);
  if (exact.length > 0) return exact.map((category) => category.id);

  const prefixed = categories.filter((category) => squash(category.name).startsWith(token));
  const quick = prefixed.filter((category) => category.quick);
  return (quick.length > 0 ? quick : prefixed).map((category) => category.id);
};

/** Ids whose squashed name starts with the squashed token; an exact name wins outright. */
const matchByName = <Item extends { id: string; name: string }>(
  token: string,
  items: readonly Item[],
): string[] => {
  const key = squash(token);
  if (key.length === 0) return [];
  const exact = items.filter((item) => squash(item.name) === key);
  if (exact.length > 0) return exact.map((item) => item.id);
  return items.filter((item) => squash(item.name).startsWith(key)).map((item) => item.id);
};

/** Labels the entry's type may carry, the same rule `createTransactionBatch` filters by. */
export const labelsFor = (labels: readonly ParseLabel[], type: EntryType) =>
  labels.filter((label) => label.applicableTo === "BOTH" || label.applicableTo === type);

export const parseCommand = (text: string, context: ParseContext): ParsedEntry => {
  const tokens = text.trim().split(/\s+/).filter(Boolean);

  let amount: number | null = null;
  let type: EntryType = "EXPENSE";
  const rest: string[] = [];

  // Amount first, because it decides the type, and the type decides which
  // categories and labels a word may mean.
  for (const token of tokens) {
    if (amount === null && !token.startsWith("@") && !token.startsWith("#")) {
      const value = parseAmount(token);
      if (value !== null) {
        amount = value;
        if (token.startsWith("+")) type = "INCOME";
        continue;
      }
    }
    rest.push(token);
  }

  const warnings: string[] = [];
  if (amount === 0) {
    amount = null;
    warnings.push("An amount of 0 cannot be saved.");
  }

  const categories = context.categories.filter((category) => category.type === type);
  const usableLabels = labelsFor(context.labels, type);

  let categoryId: string | null = null;
  let categoryCandidates: string[] = [];
  let categoryTaken = false;
  const labels: TokenMatch[] = [];
  let card: TokenMatch | null = null;
  let date: string | null = null;
  const description: string[] = [];

  for (const token of rest) {
    if (token.startsWith("@") && token.length > 1) {
      const ids = matchByName(token.slice(1), usableLabels);
      labels.push({ token, ids });
      if (ids.length === 0) warnings.push(`No ${type.toLowerCase()} label matches ${token}.`);
      continue;
    }

    if (token.startsWith("#") && token.length > 1 && card === null) {
      const ids = matchByName(token.slice(1), context.cards);
      card = { token, ids };
      if (ids.length === 0) warnings.push(`No card matches ${token}.`);
      continue;
    }

    if (date === null) {
      const day = parseDateToken(token, context.today);
      if (day !== null) {
        date = day;
        continue;
      }
    }

    if (!categoryTaken) {
      const ids = matchCategory(token, categories);
      if (ids.length > 0) {
        categoryTaken = true;
        if (ids.length === 1) categoryId = ids[0] ?? null;
        else categoryCandidates = ids;
        continue;
      }
    }

    description.push(token);
  }

  if (type === "INCOME" && card !== null) {
    warnings.push("A card can only pay for an expense; income cannot be put on one.");
  }

  return {
    amount,
    type,
    categoryId,
    categoryCandidates,
    labels,
    card,
    date: date ?? context.today,
    dateGiven: date !== null,
    description: description.join(" "),
    warnings,
  };
};
