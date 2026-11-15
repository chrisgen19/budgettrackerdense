import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// A generated client from before step 0, with no DENSE. Stated here rather than read from the
// real client, which has DENSE once `pnpm sync:schema` brings it in, so the refusal stays covered
// for any checkout whose client predates the value.
vi.mock("@prisma/client", async (original) => ({
  ...(await original<typeof import("@prisma/client")>()),
  TransactionSource: { APP: "APP", MCP: "MCP", TELEGRAM: "TELEGRAM" },
}));

const createTransactionBatch = vi.fn();
vi.mock("@bt/lib/transaction-writes", () => ({ createTransactionBatch }));
vi.mock("@/server/db", () => ({ prisma: { $queryRaw: vi.fn() } }));

const { checkWritesEnabled, createQuickEntry, denseSource } = await import("./writes");

const WITH_DENSE = { APP: "APP", MCP: "MCP", TELEGRAM: "TELEGRAM", DENSE: "DENSE" };
const WITHOUT = { APP: "APP", MCP: "MCP", TELEGRAM: "TELEGRAM" };

const enumError = () =>
  new Prisma.PrismaClientKnownRequestError(
    'Raw query failed. Code: `22P02`. Message: `invalid input value for enum "TransactionSource": "DENSE"`',
    { code: "P2010", clientVersion: "6", meta: { code: "22P02" } },
  );

describe("the writes-enabled guard", () => {
  it("is off while the generated client has no DENSE, without asking the database", async () => {
    const queryRaw = vi.fn();
    expect(await checkWritesEnabled({ $queryRaw: queryRaw } as never, WITHOUT)).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("is off while the database rejects the value", async () => {
    const queryRaw = vi.fn().mockRejectedValue(enumError());
    expect(await checkWritesEnabled({ $queryRaw: queryRaw } as never, WITH_DENSE)).toBe(false);
  });

  it("is on when both the client and the database know DENSE", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ value: "DENSE" }]);
    expect(await checkWritesEnabled({ $queryRaw: queryRaw } as never, WITH_DENSE)).toBe(true);
  });

  it("rethrows a database that cannot be reached, rather than calling it not deployed", async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error("Can't reach database server"));
    await expect(checkWritesEnabled({ $queryRaw: queryRaw } as never, WITH_DENSE)).rejects.toThrow(
      "Can't reach database server",
    );
  });

  it("reads DENSE from the enum it is given", () => {
    expect(denseSource(WITH_DENSE)).toBe("DENSE");
    expect(denseSource(WITHOUT)).toBeNull();
  });
});

describe("createQuickEntry with a client that predates DENSE", () => {
  it("refuses with DENSE_NOT_DEPLOYED and writes nothing", async () => {
    const result = await createQuickEntry(
      "u1",
      {
        type: "EXPENSE",
        amount: 241,
        categoryId: "c1",
        description: "indrive",
        date: "2026-09-28",
        timezoneOffset: -480,
      },
      "dense-3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f",
    );

    expect(result).toEqual({ ok: false, reason: "DENSE_NOT_DEPLOYED", retryable: false });
    expect(createTransactionBatch).not.toHaveBeenCalled();
  });
});
