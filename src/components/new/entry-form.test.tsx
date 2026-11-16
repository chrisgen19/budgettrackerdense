// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { EntryContext } from "@/server/queries/new-entry";
import { EntryForm } from "./entry-form";

// The server action cannot run in jsdom. It answers the way createQuickEntry
// does when the write commits: the stored row, here with an empty note because
// the line saved was "1 other".
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
      description: "",
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

afterEach(cleanup);

/** Types into the command line and saves with Enter, then lets the save settle. */
async function typeAndSave(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

describe("EntryForm confirmation", () => {
  test("says saved while the line is still the one that was saved", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other");

    const status = await screen.findByText(/✓ saved/);
    expect(status.textContent).toBe("✓ saved");
  });

  // Production row cmwimac300001ny014dbo401e: Enter at "1 other", the note
  // typed after, and the stale "✓ saved" read as the save of the full line.
  test("says saved earlier once the line is edited after the save", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    await typeAndSave(input, "1 other");
    await screen.findByText(/✓ saved/);
    fireEvent.change(input, { target: { value: "1 other dense first production test" } });

    expect(screen.getByText(/✓ saved/).textContent).toBe("✓ saved earlier");
  });

  test("says saved after Shift+Enter clears the line, until the next entry is typed", async () => {
    render(<EntryForm context={context} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "1 other" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    });
    expect((await screen.findByText(/✓ saved/)).textContent).toBe("✓ saved");

    fireEvent.change(input, { target: { value: "2 food" } });
    expect(screen.getByText(/✓ saved/).textContent).toBe("✓ saved earlier");
  });
});
