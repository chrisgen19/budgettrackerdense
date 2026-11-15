import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findDrift, type ReadRepoFile } from "./lib/drift";
import { REPO_ROOT } from "./lib/paths";
import { compareHeadToPinned, pinnedSha, pinnedSource } from "./lib/source";
import { VENDOR_DIR, existingVendorFiles, planVendorSync } from "./lib/vendor-sync";

// The commit this tree was synced from (prisma/.source-sha), read from git, so
// the result does not depend on which branch the budgettracker checkout has open.
const source = pinnedSource();
const plan = planVendorSync(source);
const read: ReadRepoFile = (path) => readFileSync(join(REPO_ROOT, path), "utf8");
const present = existingVendorFiles(REPO_ROOT);
const drift = (reader: ReadRepoFile = read, files: string[] = present) =>
  findDrift(reader, files, source);

describe("the vendored copy is generated output", () => {
  it("covers the entry files this app imports", () => {
    for (const entry of [
      "lib/budget-queries.ts",
      "lib/budget-plans.ts",
      "lib/credit-account-queries.ts",
      "lib/transaction-writes.ts",
      "lib/period-progress.ts",
      "types/index.ts",
    ]) {
      expect(plan.targets.has(entry), `${entry} missing from the sync plan`).toBe(true);
    }
  });

  it("follows imports transitively instead of a hand-kept list", () => {
    // Reached only through budget-queries and credit-account-queries.
    expect(plan.targets.has("lib/bill-estimate.ts")).toBe(true);
    expect(plan.targets.has("lib/card-owed.ts")).toBe(true);
    expect(plan.targets.has("lib/validations.ts")).toBe(true);
  });

  it("copies no tests and no query layer this app does not use", () => {
    for (const target of plan.targets) {
      expect(target.endsWith(".test.ts")).toBe(false);
    }
    expect(plan.targets.has("lib/assessment-facts-query.ts")).toBe(false);
  });

  it("rewrites every @/ specifier to @bt/, so the copy resolves against itself", () => {
    for (const file of plan.files) {
      if (file.path.endsWith("MANIFEST.json")) continue;
      // The prisma shim is the one seam that points back at this app.
      if (file.path.endsWith("/lib/prisma.ts")) continue;
      expect(file.content, `${file.path} still imports from "@/"`).not.toMatch(
        /(?:from|import|require)\s*\(?\s*["']@\//,
      );
    }
  });

  it("gives the shared prisma client this app's client", () => {
    const shim = plan.files.find((file) => file.path.endsWith("/lib/prisma.ts"));
    expect(shim?.content).toContain('export { prisma } from "@/server/db"');
  });

  it("marks every file GENERATED", () => {
    for (const file of existingVendorFiles(REPO_ROOT)) {
      if (file === "MANIFEST.json") continue;
      expect(read(join(VENDOR_DIR, file)).startsWith("// GENERATED"), file).toBe(true);
    }
  });

  it("records each file's source and hash in MANIFEST.json", () => {
    const manifest = JSON.parse(read(join(VENDOR_DIR, "MANIFEST.json"))) as {
      source: string;
      files: Array<{ target: string; source: string; sha256: string }>;
    };
    expect(manifest.source).toMatch(/^budgettracker@/);
    expect(manifest.files.length).toBe(plan.targets.size - 1);
    for (const entry of manifest.files) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("check:drift", () => {
  it("passes on the tree as synced", () => {
    expect(drift().problems).toEqual([]);
  });

  it("compares the checkout's HEAD with the pinned commit, whatever branch is open", () => {
    // HEAD depends on the machine, so only the shape is fixed here.
    expect(compareHeadToPinned()).toEqual({ head: expect.stringMatching(/^[0-9a-f]{7,}$/), matches: expect.any(Boolean) });
  });

  it("gives no HEAD comparison when the pinned commit cannot be resolved", () => {
    expect(compareHeadToPinned("0000000")).toBeNull();
  });

  it("says how to recover when the pinned commit is not in the checkout", () => {
    expect(() => pinnedSource("0000000")).toThrow(/not in .*git fetch/);
  });

  it("checks against the pinned commit, not the checkout's HEAD", () => {
    expect(source.sha).toBe(pinnedSha());
    expect(drift().sha).toBe(pinnedSha());
  });

  it("fails when a vendored file is edited by hand", () => {
    const edited = "src/vendor/bt/lib/money.ts";
    const withEdit: ReadRepoFile = (path) =>
      path === edited ? `${read(path)}\n// hand edit\n` : read(path);

    expect(drift(withEdit).problems).toContain(`${edited}: differs from a fresh sync`);
  });

  it("fails when a vendored file loses its GENERATED header", () => {
    const stripped = "src/vendor/bt/lib/money.ts";
    const withStrip: ReadRepoFile = (path) =>
      path === stripped ? read(path).split("\n").slice(1).join("\n") : read(path);

    expect(drift(withStrip).problems).toContain(`${stripped}: no GENERATED header`);
  });

  it("fails when a file is added under the vendor directory by hand", () => {
    const withExtra = [...present, "lib/my-helper.ts"];

    expect(drift(read, withExtra).problems).toContain(
      "src/vendor/bt/lib/my-helper.ts: not produced by a sync (hand-added or stale)",
    );
  });
});
