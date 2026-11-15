"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveEntry } from "@/app/(app)/new/actions";
import { parseCommand } from "@/lib/command-parser";
import { DISMISS_EVENT } from "@/lib/dismiss";
import { choose as chooseOverride, readyToSave, resolveDraft, type Overrides } from "@/lib/entry-draft";
import type { EntryContext, RecentEntry } from "@/server/queries/new-entry";
import { ParseTable, type Choose } from "./parse-table";
import { EntryLine, RecentEntries } from "./recent-entries";
import { FAILURE_TEXT, SaveBar } from "./save-bar";

/** A fresh idempotency key. Kept until a save succeeds, so a retry replays rather than duplicates. */
const newKey = () => `dense-${crypto.randomUUID()}`;

type Status =
  | { kind: "idle" }
  | { kind: "saved"; entry: RecentEntry; replayed: boolean }
  | { kind: "failed"; message: string };

/**
 * The command line, the parse table under it, and the save. `Enter` saves,
 * `Shift+Enter` saves and clears for the next entry, `Esc` clears (the shell's
 * dismiss event, which also blurs, so the line is focused again here).
 */
export function EntryForm({ context }: { context: EntryContext }) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [key, setKey] = useState(newKey);
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [recent, setRecent] = useState(context.recent);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseCommand(text, context), [text, context]);
  const draft = resolveDraft(parsed, overrides);
  const verdict = readyToSave(draft, parsed, context);
  const signature = JSON.stringify(verdict.ok ? verdict.input : null);
  const alreadySaved = savedDraft !== null && savedDraft === signature;

  const clear = () => {
    setText("");
    setOverrides({});
    setSavedDraft(null);
    input.current?.focus();
  };

  useEffect(() => {
    const onDismiss = () => {
      clear();
      setStatus({ kind: "idle" });
    };
    document.addEventListener(DISMISS_EVENT, onDismiss);
    return () => document.removeEventListener(DISMISS_EVENT, onDismiss);
  }, []);

  const choose: Choose = (field, value) => setOverrides((current) => chooseOverride(current, field, value, parsed));

  const save = (thenClear: boolean) => {
    // Enter on a line already saved does nothing: a second save would need a new key and duplicate it.
    if (!context.canSave || !verdict.ok || pending || alreadySaved) return;
    const entry = verdict.input;

    startTransition(async () => {
      let result;
      try {
        result = await saveEntry(entry, key);
      } catch {
        setStatus({ kind: "failed", message: FAILURE_TEXT.WRITE_FAILED });
        return;
      }
      if (!result.ok) {
        setStatus({ kind: "failed", message: FAILURE_TEXT[result.reason] });
        return;
      }
      setStatus({ kind: "saved", entry: result.entry, replayed: result.replayed });
      setRecent((list) => [result.entry, ...list.filter((row) => row.id !== result.entry.id)].slice(0, 10));
      setKey(newKey());
      if (thenClear) clear();
      else setSavedDraft(signature);
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label className="flex h-12 items-center gap-2 rounded-panel border-2 border-accent bg-panel px-2.5">
          <span aria-hidden className="font-mono text-accent">›</span>
          <input
            ref={input}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              save(event.shiftKey);
            }}
            aria-label="Entry"
            placeholder="e.g. 241 transpo @tnvs indrive"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
          />
        </label>

        <ParseTable context={context} parsed={parsed} draft={draft} choose={choose} />

        <SaveBar
          canSave={context.canSave}
          problems={text.trim() === "" ? [] : verdict.ok ? [] : verdict.problems}
          warnings={parsed.warnings}
          pending={pending}
          onSave={() => save(false)}
        />

        <div role="status" aria-live="polite" className="mt-2 min-h-5 text-label">
          {status.kind === "saved" ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-income">✓ {status.replayed ? "already saved" : "saved"}</span>
              <EntryLine entry={status.entry} timezoneOffset={context.timezoneOffset} />
            </span>
          ) : status.kind === "failed" ? (
            <span className="text-expense">{status.message}</span>
          ) : null}
        </div>
      </div>

      <section className="min-w-0 rounded-panel border border-rule bg-panel">
        <header className="flex flex-wrap items-center justify-between gap-x-2 border-b border-rule px-2.5 py-1.5 text-head font-semibold">
          <span>Made here</span>
          <span className="font-normal text-muted">last 10</span>
        </header>
        <RecentEntries entries={recent} timezoneOffset={context.timezoneOffset} canSave={context.canSave} />
      </section>
    </div>
  );
}
