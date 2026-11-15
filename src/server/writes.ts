import "server-only";
import { Prisma, TransactionSource, type PrismaClient } from "@prisma/client";
import { createTransactionBatch } from "@bt/lib/transaction-writes";
import { batchTransactionSchema, resolveTransactionDate } from "@bt/lib/validations";
import { prisma as defaultPrisma } from "@/server/db";

/**
 * The only place this app writes (AGENTS.md). Pages, actions and routes call
 * `createQuickEntry`; nothing else touches Prisma's create, update or delete.
 * Plan 09 swaps this implementation for an HTTP call and keeps the signature.
 *
 * Every transaction goes through budgettracker's own `createTransactionBatch`,
 * the function its app and MCP server use, with `createdVia: DENSE`. Label
 * scheduling, label type-filtering, the category and card checks and the
 * idempotency key are all its rules, not re-implemented here.
 *
 * Writes stay off until `DENSE` exists in both the generated client and the
 * database (plan 07 step 0). Until then `createQuickEntry` refuses with
 * `DENSE_NOT_DEPLOYED` and writes nothing.
 */

export interface QuickEntryInput {
  type: "EXPENSE" | "INCOME";
  amount: number;
  categoryId: string;
  /** Undefined lets label schedules decide; `[]` is an explicit "no labels". */
  labelIds?: string[];
  creditAccountId?: string | null;
  description: string;
  /** `YYYY-MM-DD` (given the current clock) or a local `YYYY-MM-DDTHH:mm`. */
  date: string;
  /**
   * The user's `timezone_offset`, which resolves `date` to an instant.
   * `createTransactionBatch` stores `new Date(date)` as given, so a bare day
   * left unresolved would land at UTC midnight: 08:00 in Manila, and the
   * previous day for anyone west of Greenwich.
   */
  timezoneOffset: number;
}

/** What the confirmation line needs, read back from the row actually written. */
export interface SavedEntry {
  id: string;
  date: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  description: string;
  categoryName: string;
  labelNames: string[];
}

export type WriteFailure =
  | "DENSE_NOT_DEPLOYED"
  | "INVALID_INPUT"
  | "LABELS_NOT_OWNED"
  | "CATEGORIES_NOT_OWNED"
  | "CARD_NOT_USABLE"
  | "NO_LONGER_PERMITTED"
  | "UNKNOWN_WHETHER_SAVED"
  | "WRITE_FAILED";

export type WriteResult =
  | { ok: true; transactionId: string; replayed: boolean; entry: SavedEntry }
  | { ok: false; reason: WriteFailure; retryable: boolean };

/** `dense-` plus a v4-shaped UUID, so a row can be traced back to this app. */
export const CLIENT_BATCH_ID = /^dense-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Whether a failure can be retried with the same key. Only the two where the
 * write may or may not have happened are: retrying under the same key either
 * replays the saved row or writes it once. The rest will fail the same way
 * until the input changes.
 */
const RETRYABLE: Record<WriteFailure, boolean> = {
  DENSE_NOT_DEPLOYED: false,
  INVALID_INPUT: false,
  LABELS_NOT_OWNED: false,
  CATEGORIES_NOT_OWNED: false,
  CARD_NOT_USABLE: false,
  NO_LONGER_PERMITTED: false,
  UNKNOWN_WHETHER_SAVED: true,
  WRITE_FAILED: true,
};

const fail = (reason: WriteFailure): WriteResult => ({ ok: false, reason, retryable: RETRYABLE[reason] });

/** The `DENSE` member of the generated enum, or null while the client predates it. */
export const denseSource = (
  values: Record<string, string> = TransactionSource,
): TransactionSource | null =>
  Object.values(values).includes("DENSE") ? ("DENSE" as TransactionSource) : null;

/** Postgres' "invalid input value for enum": the database does not know `DENSE` yet. */
const isMissingEnumValue = (error: unknown): boolean => {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? (error.meta as { code?: string } | undefined)?.code
      : undefined;
  return code === "22P02" || (error instanceof Error && /invalid input value for enum/i.test(error.message));
};

/**
 * Both halves of the guard. The generated client must know `DENSE` (a client
 * without it throws reading a DENSE row), and so must the database. A database
 * that cannot be reached is not "not deployed": that error is rethrown, so the
 * page reports a failed read instead of quietly saying writes are off.
 */
export async function checkWritesEnabled(
  prisma: Pick<PrismaClient, "$queryRaw">,
  enumValues: Record<string, string> = TransactionSource,
): Promise<boolean> {
  if (denseSource(enumValues) === null) return false;
  try {
    await prisma.$queryRaw`SELECT 'DENSE'::"TransactionSource" AS value`;
    return true;
  } catch (error) {
    if (isMissingEnumValue(error)) return false;
    throw error;
  }
}

/** Only a yes is remembered. The enum arrives with a sync and a redeploy, which restarts this. */
let confirmedEnabled = false;

export async function writesEnabled(): Promise<boolean> {
  if (confirmedEnabled) return true;
  confirmedEnabled = await checkWritesEnabled(defaultPrisma);
  return confirmedEnabled;
}

/** Create one transaction from the New entry page. See the module comment. */
export async function createQuickEntry(
  userId: string,
  input: QuickEntryInput,
  clientBatchId: string,
): Promise<WriteResult> {
  const source = denseSource();
  if (source === null || !(await writesEnabled())) return fail("DENSE_NOT_DEPLOYED");
  if (!CLIENT_BATCH_ID.test(clientBatchId)) return fail("INVALID_INPUT");

  const { timezoneOffset, ...fields } = input;
  const parsed = batchTransactionSchema.safeParse({
    ...fields,
    date: resolveTransactionDate(fields.date, timezoneOffset),
  });
  if (!parsed.success) return fail("INVALID_INPUT");

  try {
    const result = await createTransactionBatch({
      prisma: defaultPrisma,
      userId,
      items: [parsed.data],
      clientBatchId,
      createdVia: source,
    });
    if (!result.ok) return fail(result.reason);

    const row = result.transactions[0];
    if (!row) return fail("WRITE_FAILED");

    return {
      ok: true,
      transactionId: row.id,
      replayed: result.replayed,
      entry: {
        id: row.id,
        date: row.date.toISOString(),
        amount: row.amount,
        type: row.type,
        description: row.description,
        categoryName: row.category.name,
        labelNames: row.labels.map(({ label }) => label.name),
      },
    };
  } catch {
    // Thrown rather than returned: the database or the connection failed
    // mid-write. Whether anything committed is unknown, so the same key is kept
    // and a retry either replays the row or writes it once.
    return fail("WRITE_FAILED");
  }
}
