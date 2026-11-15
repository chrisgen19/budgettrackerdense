import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Anything that would let this app change budgettracker's schema. */
const FORBIDDEN_IN_SCRIPTS = ["migrate", "db push", "db pull", "db execute"];

describe("this app never changes the database schema", () => {
  it("has no prisma/migrations directory", () => {
    expect(existsSync(join(REPO_ROOT, "prisma", "migrations"))).toBe(false);
  });

  it("has no package.json script that migrates or writes the schema", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const offenders = Object.entries(pkg.scripts ?? {}).filter(([, command]) =>
      FORBIDDEN_IN_SCRIPTS.some((forbidden) => command.includes(forbidden)),
    );
    expect(offenders).toEqual([]);
  });

  it("has a generated schema with the GENERATED header", () => {
    const schema = readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
    expect(schema.startsWith("// GENERATED from budgettracker@")).toBe(true);
  });
});
