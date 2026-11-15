import { describe, expect, it } from "vitest";
import { APP_NAME, pageTitle } from "@/lib/app";

describe("pageTitle", () => {
  it("returns the app name on its own when no page is given", () => {
    expect(pageTitle()).toBe(APP_NAME);
  });

  it("suffixes the app name to a page name", () => {
    expect(pageTitle("Ledger")).toBe("Ledger - Dense");
  });
});
