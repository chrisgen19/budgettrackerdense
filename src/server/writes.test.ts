import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seam with DENSE present, as it will be after step 0: a generated enum
 * that has the value and a database that accepts it. Everything below that is
 * budgettracker's `createTransactionBatch`, replaced so each of its results can
 * be mapped.
 *
 * The replacement is a plain function recording its calls, not a `vi.fn` spy.
 * In Vitest 5.1 a spy whose implementation throws fails the test even when the
 * code under test catches the error, which is the one case this file must
 * exercise.
 */
vi.mock("@prisma/client", async (original) => ({
  ...(await original<typeof import("@prisma/client")>()),
  TransactionSource: { APP: "APP", MCP: "MCP", TELEGRAM: "TELEGRAM", DENSE: "DENSE" },
}));

type BatchCall = {
  userId: string;
  clientBatchId: string;
  createdVia: string;
  items: Array<Record<string, unknown>>;
};

const batch = vi.hoisted(() => ({
  calls: [] as BatchCall[],
  impl: (async () => undefined) as (call: BatchCall) => Promise<unknown>,
}));

vi.mock("@bt/lib/transaction-writes", () => ({
  createTransactionBatch: (call: BatchCall) => {
    batch.calls.push(call);
    return batch.impl(call);
  },
}));
vi.mock("@/server/db", () => ({ prisma: { $queryRaw: async () => [{ value: "DENSE" }] } }));

const { createQuickEntry } = await import("./writes");

const KEY = "dense-3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f";
const input = {
  type: "EXPENSE" as const,
  amount: 241,
  categoryId: "c1",
  description: "indrive v mall to mirea",
  date: "2026-09-28T22:36",
  timezoneOffset: -480,
};

const savedRow = {
  id: "t1",
  date: new Date("2026-09-28T14:36:00.000Z"),
  amount: 241,
  type: "EXPENSE",
  description: "indrive v mall to mirea",
  category: { name: "Transportation" },
  labels: [{ label: { name: "TNVS" } }],
};

const resolves = (value: unknown) => {
  batch.impl = async () => value;
};

beforeEach(() => {
  batch.calls.length = 0;
  resolves({ ok: true, transactions: [savedRow], replayed: false });
});

describe("createQuickEntry", () => {
  it("writes through createTransactionBatch as DENSE, under the key, with the date resolved", async () => {
    const result = await createQuickEntry("u1", input, KEY);

    expect(batch.calls).toHaveLength(1);
    const call = batch.calls[0];
    expect(call).toMatchObject({ userId: "u1", clientBatchId: KEY, createdVia: "DENSE" });
    // 22:36 in Manila is 14:36 UTC: the wall clock resolved with the user's offset.
    expect(call?.items).toEqual([
      expect.objectContaining({ amount: 241, categoryId: "c1", date: "2026-09-28T14:36:00.000Z" }),
    ]);
    expect(call?.items[0]).not.toHaveProperty("timezoneOffset");
    expect(result).toEqual({
      ok: true,
      transactionId: "t1",
      replayed: false,
      entry: {
        id: "t1",
        date: "2026-09-28T14:36:00.000Z",
        amount: 241,
        type: "EXPENSE",
        description: "indrive v mall to mirea",
        categoryName: "Transportation",
        labelNames: ["TNVS"],
      },
    });
  });

  it("gives a bare day the user's current clock, not UTC midnight", async () => {
    await createQuickEntry("u1", { ...input, date: "2026-09-28" }, KEY);
    const date = String(batch.calls[0]?.items[0]?.date);
    expect(date).toMatch(/^2026-09-2[78]T\d{2}:\d{2}:\d{2}\.000Z$/);
    expect(date).not.toBe("2026-09-28T00:00:00.000Z");
  });

  it("leaves labelIds out when none were named, so schedules can apply", async () => {
    await createQuickEntry("u1", input, KEY);
    expect(batch.calls[0]?.items[0]).not.toHaveProperty("labelIds");
  });

  it("keeps an explicit empty label list", async () => {
    await createQuickEntry("u1", { ...input, labelIds: [] }, KEY);
    expect(batch.calls[0]?.items[0]?.labelIds).toEqual([]);
  });

  it("reports a replay as a success, not a second row", async () => {
    resolves({ ok: true, transactions: [savedRow], replayed: true });
    expect(await createQuickEntry("u1", input, KEY)).toMatchObject({ ok: true, replayed: true });
  });

  it.each([
    ["LABELS_NOT_OWNED", false],
    ["CATEGORIES_NOT_OWNED", false],
    ["CARD_NOT_USABLE", false],
    ["NO_LONGER_PERMITTED", false],
    ["UNKNOWN_WHETHER_SAVED", true],
  ])("maps %s, retryable %s", async (reason, retryable) => {
    resolves({ ok: false, reason });
    expect(await createQuickEntry("u1", input, KEY)).toEqual({ ok: false, reason, retryable });
  });

  it("treats a thrown write as unknown and retryable under the same key", async () => {
    batch.impl = async () => {
      throw new Error("connection reset");
    };
    expect(await createQuickEntry("u1", input, KEY)).toEqual({
      ok: false,
      reason: "WRITE_FAILED",
      retryable: true,
    });
  });

  it("refuses a key without the dense- prefix before writing", async () => {
    const result = await createQuickEntry("u1", input, "3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f");
    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT", retryable: false });
    expect(batch.calls).toHaveLength(0);
  });

  it("refuses what budgettracker's schema refuses, before writing", async () => {
    expect(await createQuickEntry("u1", { ...input, amount: -5 }, KEY)).toMatchObject({
      reason: "INVALID_INPUT",
    });
    expect(await createQuickEntry("u1", { ...input, categoryId: "" }, KEY)).toMatchObject({
      reason: "INVALID_INPUT",
    });
    expect(batch.calls).toHaveLength(0);
  });
});
