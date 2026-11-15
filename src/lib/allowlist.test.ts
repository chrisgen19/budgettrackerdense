import { describe, expect, it } from "vitest";
import { isAllowedEmail, isEmailAllowedByEnv, parseAllowedEmails } from "./allowlist";

describe("parseAllowedEmails", () => {
  it("splits, trims and lowercases", () => {
    expect(parseAllowedEmails(" One@Example.com , two@example.com ")).toEqual([
      "one@example.com",
      "two@example.com",
    ]);
  });

  it("drops empty entries and duplicates", () => {
    expect(parseAllowedEmails("a@b.com,,A@B.com, ,a@b.com")).toEqual(["a@b.com"]);
  });

  it("treats missing, empty and whitespace as an empty list", () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
    expect(parseAllowedEmails(null)).toEqual([]);
    expect(parseAllowedEmails("")).toEqual([]);
    expect(parseAllowedEmails("  ,  ")).toEqual([]);
  });
});

describe("isAllowedEmail", () => {
  const allowed = parseAllowedEmails("me@example.com");

  it("matches regardless of case or padding", () => {
    expect(isAllowedEmail("ME@Example.com", allowed)).toBe(true);
    expect(isAllowedEmail("  me@example.com  ", allowed)).toBe(true);
  });

  it("refuses an address that is not listed", () => {
    expect(isAllowedEmail("someone@example.com", allowed)).toBe(false);
  });

  it("fails closed on an empty allowlist", () => {
    expect(isAllowedEmail("me@example.com", [])).toBe(false);
  });
});

describe("isEmailAllowedByEnv", () => {
  it("parses the raw list it is given", () => {
    expect(isEmailAllowedByEnv("me@example.com", "me@example.com,you@example.com")).toBe(true);
    expect(isEmailAllowedByEnv("me@example.com", "you@example.com")).toBe(false);
    expect(isEmailAllowedByEnv("me@example.com", undefined)).toBe(false);
  });
});
