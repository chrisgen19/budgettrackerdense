import { describe, expect, it } from "vitest";
import { localCalendarDay } from "@bt/lib/period-progress";
import {
  matchCategory,
  parseCommand,
  parseDateToken,
  type ParseCategory,
  type ParseContext,
} from "./command-parser";

const cat = (id: string, name: string, type: "EXPENSE" | "INCOME" = "EXPENSE", quick = true): ParseCategory => ({
  id,
  name,
  type,
  quick,
});

// 2026-09-28 is a Monday.
const context: ParseContext = {
  today: "2026-09-28",
  categories: [
    cat("transport", "Transportation"),
    cat("food", "Food & Dining"),
    cat("family", "Family Contributions"),
    cat("fees", "Fees & Charges", "EXPENSE", false),
    cat("fam2", "Family Support", "EXPENSE", false),
    cat("utilities", "Utilities"),
    cat("salary", "Salary", "INCOME"),
    cat("sidegig", "Side Income", "INCOME"),
    cat("savings", "Savings Interest", "INCOME"),
    cat("sales", "Sales", "INCOME"),
  ],
  labels: [
    { id: "tnvs", name: "TNVS", applicableTo: "EXPENSE" },
    { id: "family", name: "Family Budget", applicableTo: "EXPENSE" },
    { id: "withmom", name: "With Mom and Dad Budget", applicableTo: "EXPENSE" },
    { id: "work", name: "Work Budget", applicableTo: "EXPENSE" },
    { id: "bonus", name: "Bonus", applicableTo: "INCOME" },
    { id: "shared", name: "Shared", applicableTo: "BOTH" },
  ],
  cards: [
    { id: "bpi", name: "BPI Rewards" },
    { id: "bdo1", name: "BDO Gold" },
    { id: "bdo2", name: "BDO Platinum" },
  ],
};

const parse = (text: string) => parseCommand(text, context);

describe("the mockup's example", () => {
  it("parses 241 transpo @tnvs indrive v mall to mirea", () => {
    const entry = parse("241 transpo @tnvs indrive v mall to mirea");
    expect(entry).toMatchObject({
      amount: 241,
      type: "EXPENSE",
      categoryId: "transport",
      labels: [{ token: "@tnvs", ids: ["tnvs"] }],
      card: null,
      date: "2026-09-28",
      dateGiven: false,
      description: "indrive v mall to mirea",
      warnings: [],
    });
  });
});

describe("amount", () => {
  it.each([
    ["241", 241],
    ["241.50", 241.5],
    ["1,250", 1250],
    ["12,345.67", 12345.67],
  ])("reads %s", (token, value) => {
    expect(parse(`${token} food`).amount).toBe(value);
  });

  it("takes the first number and leaves later ones in the description", () => {
    const entry = parse("150 food 2 pcs");
    expect(entry.amount).toBe(150);
    expect(entry.description).toBe("2 pcs");
  });

  it("finds the amount anywhere in the line", () => {
    expect(parse("food 99 lunch").amount).toBe(99);
  });

  it("refuses three decimals and malformed thousands", () => {
    expect(parse("1.234 food").amount).toBeNull();
    expect(parse("12,34 food").amount).toBeNull();
  });

  it("refuses zero, with a warning", () => {
    const entry = parse("0 food");
    expect(entry.amount).toBeNull();
    expect(entry.warnings).toContain("An amount of 0 cannot be saved.");
  });

  it("leaves the amount unset when there is none", () => {
    expect(parse("transpo grab").amount).toBeNull();
  });
});

describe("type", () => {
  it("is income with a leading +", () => {
    const entry = parse("+5000 salary");
    expect(entry).toMatchObject({ amount: 5000, type: "INCOME", categoryId: "salary" });
  });

  it("reads categories of the entry's own type only", () => {
    // "Sal" would be ambiguous across types (Salary, Sales), but an expense never sees either.
    expect(parse("100 sal").categoryId).toBeNull();
    expect(parse("100 sal").description).toBe("sal");
  });
});

describe("category", () => {
  it("matches a name prefix case-insensitively", () => {
    expect(parse("80 FOOD").categoryId).toBe("food");
    expect(parse("80 util").categoryId).toBe("utilities");
  });

  it("ignores punctuation in the name", () => {
    expect(parse("80 fooddining").categoryId).toBe("food");
  });

  it("never reads a short word as a category", () => {
    expect(matchCategory("tr", context.categories)).toEqual([]);
    expect(parse("80 to food").description).toBe("to");
  });

  it("prefers quick categories when only some match", () => {
    // "fam" starts Family Contributions (quick) and Family Support (not quick).
    expect(parse("500 fam").categoryId).toBe("family");
  });

  it("does not guess between two quick categories", () => {
    // "sa" is too short; "sal" matches Salary and Sales, both quick income categories.
    const entry = parse("+900 sal");
    expect(entry.categoryId).toBeNull();
    expect(entry.categoryCandidates).toEqual(["salary", "sales"]);
  });

  it("does not guess between two non-quick categories either", () => {
    const entry = parseCommand("10 fe", context);
    expect(entry.categoryId).toBeNull();
    const two = parseCommand("10 fee", {
      ...context,
      categories: [cat("a", "Fees", "EXPENSE", false), cat("b", "Feeding", "EXPENSE", false)],
    });
    expect(two.categoryCandidates).toEqual(["a", "b"]);
  });

  it("lets an exact name win over a longer one it prefixes", () => {
    const entry = parseCommand("10 fee", {
      ...context,
      categories: [cat("a", "Fee"), cat("b", "Feeding")],
    });
    expect(entry.categoryId).toBe("a");
  });

  it("takes only the first matching word; later ones are description", () => {
    const entry = parse("300 food utilities bill");
    expect(entry.categoryId).toBe("food");
    expect(entry.description).toBe("utilities bill");
  });
});

describe("labels", () => {
  it("matches a prefix with spaces ignored", () => {
    expect(parse("200 food @withmom").labels).toEqual([{ token: "@withmom", ids: ["withmom"] }]);
  });

  it("keeps several labels", () => {
    expect(parse("200 food @tnvs @work").labels.map((l) => l.ids)).toEqual([["tnvs"], ["work"]]);
  });

  it("reports an ambiguous label with both candidates", () => {
    // "@w" starts both With Mom and Dad Budget and Work Budget.
    expect(parse("200 food @w").labels).toEqual([{ token: "@w", ids: ["withmom", "work"] }]);
  });

  it("warns about a label that matches nothing", () => {
    const entry = parse("200 food @nope");
    expect(entry.labels).toEqual([{ token: "@nope", ids: [] }]);
    expect(entry.warnings).toContain("No expense label matches @nope.");
  });

  it("offers only labels the type may carry", () => {
    expect(parse("200 food @bonus").labels[0]?.ids).toEqual([]);
    expect(parse("+200 salary @bonus").labels[0]?.ids).toEqual(["bonus"]);
    expect(parse("+200 salary @shared").labels[0]?.ids).toEqual(["shared"]);
  });

  it("returns no labels when none were named, so schedules can decide", () => {
    expect(parse("200 food").labels).toEqual([]);
  });
});

describe("card", () => {
  it("matches a card by prefix", () => {
    expect(parse("1200 food #bpi").card).toEqual({ token: "#bpi", ids: ["bpi"] });
  });

  it("reports an ambiguous card", () => {
    expect(parse("1200 food #bdo").card).toEqual({ token: "#bdo", ids: ["bdo1", "bdo2"] });
  });

  it("warns that income cannot go on a card, and leaves the refusal to the write", () => {
    const entry = parse("+5000 salary #bpi");
    expect(entry.card?.ids).toEqual(["bpi"]);
    expect(entry.warnings).toContain("A card can only pay for an expense; income cannot be put on one.");
  });
});

describe("dates", () => {
  it("defaults to today", () => {
    expect(parse("50 food")).toMatchObject({ date: "2026-09-28", dateGiven: false });
  });

  it.each([
    ["y", "2026-09-27"],
    ["yesterday", "2026-09-27"],
    ["today", "2026-09-28"],
    ["sun", "2026-09-27"],
    ["fri", "2026-09-25"],
    ["tuesday", "2026-09-22"],
    ["9/27", "2026-09-27"],
    ["2026-09-01", "2026-09-01"],
  ])("reads %s", (token, day) => {
    expect(parse(`50 food ${token}`)).toMatchObject({ date: day, dateGiven: true });
  });

  it("reads a weekday as the previous one, never today", () => {
    expect(parseDateToken("mon", "2026-09-28")).toBe("2026-09-21");
  });

  it("puts a day later than today in last year", () => {
    expect(parseDateToken("12/25", "2026-09-28")).toBe("2025-12-25");
  });

  it("refuses days that do not exist", () => {
    expect(parseDateToken("2026-02-31", "2026-09-28")).toBeNull();
    expect(parseDateToken("2/30", "2026-09-28")).toBeNull();
    expect(parse("50 food 2026-02-31").description).toBe("2026-02-31");
  });

  it("crosses a month and a year", () => {
    expect(parseDateToken("y", "2026-03-01")).toBe("2026-02-28");
    expect(parseDateToken("y", "2027-01-01")).toBe("2026-12-31");
  });

  it("takes today from the user's offset around midnight in UTC+8", () => {
    // 16:30 UTC on the 27th is 00:30 on the 28th in Manila: "y" is the 27th there, the 26th in UTC.
    const instant = new Date("2026-09-27T16:30:00Z");
    const manila = localCalendarDay(instant, -480);
    expect(manila).toBe("2026-09-28");
    expect(parseDateToken("y", manila)).toBe("2026-09-27");
    expect(parseDateToken("y", localCalendarDay(instant, 0))).toBe("2026-09-26");
  });
});

describe("description", () => {
  it("keeps the original case and order of the leftover words", () => {
    expect(parse("120 food Jollibee BGC").description).toBe("Jollibee BGC");
  });

  it("is empty when every word was a field", () => {
    expect(parse("120 food @tnvs y").description).toBe("");
  });

  it("parses an empty line to nothing", () => {
    expect(parse("   ")).toMatchObject({
      amount: null,
      categoryId: null,
      labels: [],
      card: null,
      description: "",
      dateGiven: false,
    });
  });
});
