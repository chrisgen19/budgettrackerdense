import { describe, expect, it } from "vitest";
import { parseCommand, type ParseContext } from "./command-parser";
import { choose, readyToSave, resolveDraft, type Overrides } from "./entry-draft";

const context: ParseContext = {
  today: "2026-09-28",
  categories: [
    { id: "transport", name: "Transportation", type: "EXPENSE", quick: true },
    { id: "food", name: "Food & Dining", type: "EXPENSE", quick: true },
    { id: "salary", name: "Salary", type: "INCOME", quick: true },
    { id: "sales", name: "Sales", type: "INCOME", quick: true },
  ],
  labels: [
    { id: "tnvs", name: "TNVS", applicableTo: "EXPENSE" },
    { id: "withmom", name: "With Mom and Dad Budget", applicableTo: "EXPENSE" },
    { id: "work", name: "Work Budget", applicableTo: "EXPENSE" },
    { id: "bonus", name: "Bonus", applicableTo: "INCOME" },
  ],
  cards: [
    { id: "bdo1", name: "BDO Gold" },
    { id: "bdo2", name: "BDO Platinum" },
  ],
};

const parse = (text: string) => parseCommand(text, context);
const draftOf = (text: string, overrides: Overrides = {}) => resolveDraft(parse(text), overrides);

describe("resolveDraft", () => {
  it("takes every field from the text when nothing was chosen", () => {
    expect(draftOf("241 transpo @tnvs indrive")).toMatchObject({
      amount: 241,
      type: "EXPENSE",
      categoryId: "transport",
      labelIds: ["tnvs"],
      cardId: null,
      description: "indrive",
      labelsChosen: false,
    });
  });

  it("leaves labels undefined when none were typed, so schedules decide", () => {
    expect(draftOf("241 transpo").labelIds).toBeUndefined();
  });

  it("keeps a chip choice while the text says the same about that field", () => {
    const parsed = parse("241 transpo grab");
    const overrides = choose({}, "categoryId", "food", parsed);
    // Editing the description leaves the category's parse unchanged, so the choice stands.
    expect(draftOf("241 transpo grab to bgc", overrides).categoryId).toBe("food");
  });

  it("drops a chip choice once the text names that field differently", () => {
    const overrides = choose({}, "categoryId", "food", parse("241 transpo"));
    expect(draftOf("241 transpo", overrides).categoryId).toBe("food");
    // A shorter word that still parses to Transportation leaves the choice standing:
    // the basis is what the text means, not how it is spelled.
    expect(draftOf("241 trans", overrides).categoryId).toBe("food");
    // Text that no longer names a category: the text wins again.
    expect(draftOf("241 grab", overrides).categoryId).toBeNull();
  });

  it("holds an explicit empty label choice, which is not the same as none typed", () => {
    const overrides = choose({}, "labelIds", [], parse("241 transpo"));
    const draft = draftOf("241 transpo", overrides);
    expect(draft.labelIds).toEqual([]);
    expect(draft.labelsChosen).toBe(true);
  });
});

describe("readyToSave", () => {
  const ready = (text: string, overrides: Overrides = {}) => {
    const parsed = parse(text);
    return readyToSave(resolveDraft(parsed, overrides), parsed, context);
  };

  it("builds the seam's input, without labelIds when none were named", () => {
    expect(ready("241 transpo indrive y")).toEqual({
      ok: true,
      input: {
        type: "EXPENSE",
        amount: 241,
        categoryId: "transport",
        description: "indrive",
        date: "2026-09-27",
      },
    });
  });

  it("asks for a note when the line has none, even if blank space follows", () => {
    expect(ready("241 transpo")).toEqual({ ok: false, problems: ["Add a note."] });
    expect(ready("241 transpo   ")).toEqual({ ok: false, problems: ["Add a note."] });
  });

  it("asks for an amount and a category", () => {
    expect(ready("indrive")).toEqual({ ok: false, problems: ["Type an amount.", "Pick a category."] });
  });

  it("asks to pick between two matching categories", () => {
    expect(ready("+900 sal payroll")).toEqual({ ok: false, problems: ["Pick one of the matching categories."] });
  });

  it("refuses a category of the other type after the type chip is flipped", () => {
    const overrides = choose({}, "type", "INCOME", parse("241 transpo grab"));
    expect(ready("241 transpo grab", overrides)).toEqual({
      ok: false,
      problems: ["Transportation is not an income category."],
    });
  });

  it("asks to settle an ambiguous label, and accepts the chip choice", () => {
    expect(ready("241 transpo grab @w")).toEqual({ ok: false, problems: ["Pick a label for @w."] });
    const overrides = choose({}, "labelIds", ["work"], parse("241 transpo grab @w"));
    expect(ready("241 transpo grab @w", overrides)).toMatchObject({ ok: true, input: { labelIds: ["work"] } });
  });

  it("asks to settle an ambiguous card", () => {
    expect(ready("241 transpo grab #bdo")).toEqual({ ok: false, problems: ["Pick a card for #bdo."] });
    const overrides = choose({}, "cardId", "bdo2", parse("241 transpo grab #bdo"));
    expect(ready("241 transpo grab #bdo", overrides)).toMatchObject({ ok: true, input: { creditAccountId: "bdo2" } });
  });

  it("blocks an unmatched label instead of saving it as no labels", () => {
    expect(ready("241 transpo grab @tvns")).toEqual({
      ok: false,
      problems: ["Fix or remove @tvns, or pick labels."],
    });
    // One good label beside a typo still blocks: the typo was meant to be a label too.
    expect(ready("241 transpo grab @tnvs @zzz")).toMatchObject({ ok: false });
  });

  it("saves an unmatched label once the chips settle it", () => {
    const overrides = choose({}, "labelIds", ["tnvs"], parse("241 transpo grab @tvns"));
    expect(ready("241 transpo grab @tvns", overrides)).toMatchObject({ ok: true, input: { labelIds: ["tnvs"] } });
  });

  it("blocks an unmatched card instead of saving it as cash", () => {
    expect(ready("241 transpo grab #bpii")).toEqual({
      ok: false,
      problems: ["Fix or remove #bpii, or pick a card or Cash."],
    });
  });

  it("saves an unmatched card once a card or Cash is picked", () => {
    const parsed = parse("241 transpo grab #bpii");
    expect(ready("241 transpo grab #bpii", choose({}, "cardId", "bdo1", parsed))).toMatchObject({
      ok: true,
      input: { creditAccountId: "bdo1" },
    });
    const cash = ready("241 transpo grab #bpii", choose({}, "cardId", null, parsed));
    expect(cash.ok).toBe(true);
    expect(cash.ok && cash.input.creditAccountId).toBeUndefined();
  });

  it("lets an explicit Cash pick settle an ambiguous card", () => {
    const overrides = choose({}, "cardId", null, parse("241 transpo grab #bdo"));
    expect(ready("241 transpo grab #bdo", overrides)).toMatchObject({ ok: true });
  });

  it("sends an explicit empty label list when labels were cleared", () => {
    const overrides = choose({}, "labelIds", [], parse("241 transpo grab @tnvs"));
    expect(ready("241 transpo grab @tnvs", overrides)).toMatchObject({ ok: true, input: { labelIds: [] } });
  });

  it("drops labels the entry's type cannot carry after a type flip", () => {
    const parsed = parse("+500 salary @bonus sept");
    let overrides = choose({}, "labelIds", ["bonus", "tnvs"], parsed);
    overrides = choose(overrides, "type", "INCOME", parsed);
    expect(ready("+500 salary @bonus sept", overrides)).toMatchObject({ ok: true, input: { labelIds: ["bonus"] } });
  });
});
