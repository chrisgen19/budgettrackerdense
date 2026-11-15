import { describe, expect, it } from "vitest";
import { budgetEditorUrl, budgetTrackerUrl, transactionUrl } from "./links";

describe("budgetTrackerUrl", () => {
  it("uses the configured base and drops trailing slashes", () => {
    expect(budgetTrackerUrl("https://budget.example.com/")).toBe("https://budget.example.com");
    expect(budgetTrackerUrl("https://budget.example.com///")).toBe("https://budget.example.com");
  });

  it("falls back when the variable is missing or blank", () => {
    expect(budgetTrackerUrl(undefined)).toBe("http://127.0.0.1:3111");
    expect(budgetTrackerUrl("   ")).toBe("http://127.0.0.1:3111");
  });
});

describe("derived links", () => {
  it("points at the plan editor and a transaction", () => {
    expect(budgetEditorUrl("https://b.example.com")).toBe("https://b.example.com/analytics");
    expect(transactionUrl("abc 1", "https://b.example.com")).toBe(
      "https://b.example.com/transactions?id=abc%201",
    );
  });
});

describe("label links", () => {
  it("points at budgettracker's labels page and this app's filtered ledger", async () => {
    const { labelsUrl, labelLedgerHref } = await import("./links");
    expect(labelsUrl("https://b.example.com")).toBe("https://b.example.com/labels");
    expect(labelLedgerHref("abc 1", "2026-09")).toBe("/ledger?month=2026-09&label=abc+1");
  });
});
