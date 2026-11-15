import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  calls: 0,
  impl: (async () => [{ "?column?": 1 }]) as () => Promise<unknown>,
}));

vi.mock("@/server/db", () => ({
  prisma: {
    $queryRaw: () => {
      db.calls += 1;
      return db.impl();
    },
  },
}));

const { GET } = await import("./route");

const get = (query = "") => GET(new NextRequest(`http://localhost:3200/api/health${query}`));

beforeEach(() => {
  db.calls = 0;
  db.impl = async () => [{ "?column?": 1 }];
});

describe("GET /api/health", () => {
  it("answers 200 { ok: true } without touching the database", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(db.calls).toBe(0);
  });

  it("probes the database with ?db=1", async () => {
    const response = await get("?db=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.calls).toBe(1);
  });

  it("answers 503 { ok: false } when the probe fails, with no detail", async () => {
    db.impl = async () => {
      throw new Error("password authentication failed");
    };
    const response = await get("?db=1");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores other db values", async () => {
    for (const query of ["?db=true", "?db=0"]) {
      const response = await get(query);
      expect(response.status).toBe(200);
    }
    expect(db.calls).toBe(0);
  });
});
