// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { saveEntry } from "@/app/(app)/new/actions";
import type { EntryContext } from "@/server/queries/new-entry";
import { EntryForm } from "./entry-form";

// The server action cannot run in jsdom. It answers the way createQuickEntry
// does when the write commits: the stored row for the line "1 other taxi".
vi.mock("@/app/(app)/new/actions", () => ({
  saveEntry: vi.fn(async () => ({
    ok: true,
    transactionId: "t1",
    replayed: false,
    entry: {
      id: "t1",
      date: "2026-11-16T02:01:00.000Z",
      amount: 1,
      type: "EXPENSE",
      description: "taxi",
      categoryName: "Other Expense",
      labelNames: ["Work Budget"],
    },
  })),
}));

const context: EntryContext = {
  today: "2026-11-16",
  timezoneOffset: -480,
  categories: [
    { id: "c-food", name: "Food & Dining", type: "EXPENSE", quick: true },
    { id: "c-other", name: "Other Expense", type: "EXPENSE", quick: false },
  ],
  labels: [{ id: "l-work", name: "Work Budget", applicableTo: "BOTH" }],
  cards: [],
  canSave: true,
  recent: [],
};

afterEach(() => {
  cleanup();
  vi.mocked(saveEntry).mockClear();
});

/** Types into the command line and saves with Enter, then lets the save settle. */
async function typeAndSave(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

describe("EntryForm note", () => {
  // Production row cmwimac300001ny014dbo401e: Enter at "1 other", a complete
  // line, saved it before the note was typed, and the row stored no note.
  test("refuses Enter at a line with no note, and says why", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other");

    expect(saveEntry).not.toHaveBeenCalled();
    expect(screen.getByText("Add a note.")).toBeTruthy();
    expect(screen.queryByText(/✓ saved/)).toBeNull();
  });

  test("saves once the note is typed", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other");
    await typeAndSave(input, "1 other taxi");

    expect(saveEntry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveEntry).mock.calls[0]?.[0]).toMatchObject({ description: "taxi" });
  });
});

describe("EntryForm confirmation", () => {
  test("says saved while the line is still the one that was saved", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other taxi");

    const status = await screen.findByText(/✓ saved/);
    expect(status.textContent).toBe("✓ saved");
  });

  // An edit after a save must not read as the save of the edited line (PR 6).
  test("says saved earlier once the line is edited after the save", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other taxi");
    await screen.findByText(/✓ saved/);
    fireEvent.change(input, { target: { value: "1 other taxi home" } });

    expect(screen.getByText(/✓ saved/).textContent).toBe("✓ saved earlier");
  });

  test("says saved after Shift+Enter clears the line, until the next entry is typed", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "1 other taxi" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    });
    expect((await screen.findByText(/✓ saved/)).textContent).toBe("✓ saved");

    fireEvent.change(input, { target: { value: "2 food lunch" } });
    expect(screen.getByText(/✓ saved/).textContent).toBe("✓ saved earlier");
  });
});
