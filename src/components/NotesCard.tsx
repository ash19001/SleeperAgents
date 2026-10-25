"use client";

import { type FormEvent, useState } from "react";
import { BUTTON, BUTTON_QUIET, BUTTON_QUIET_SMALL } from "./ui";
import { fmtDate } from "@/lib/format";
import type { Note } from "@/lib/types";

// Household notes explain what bills can't show. Answers recall them from H-MEM and cite them as M#.
export function NotesCard({ notes, onAdd, suggestedNote, lastQuestion, onAsk }: {
  notes: Note[];
  onAdd: (text: string) => Promise<Note>;
  suggestedNote: string;
  lastQuestion: string;
  onAsk: (question: string) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ message: string; askAgain: boolean } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      setStatus({ message: "Write a note first.", askAgain: false });
      return;
    }
    try {
      const note = await onAdd(value);
      setText("");
      setStatus({ message: `Saved as ${note.id}.`, askAgain: Boolean(lastQuestion) });
    } catch (err) {
      setStatus({ message: `Couldn't save the note: ${(err as Error).message}`, askAgain: false });
    }
  }

  return (
    <section aria-labelledby="notes-title" className="grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-4">
      <h2 id="notes-title" className="headline text-xl leading-tight font-bold">Household notes</h2>
      <p className="text-sm text-muted">
        Things your bills can&apos;t show, like a new appliance or someone working from home. Answers use them to explain changes in use.
      </p>
      <ul className="grid gap-2">
        {notes.length ? (
          notes.map((n) => (
            <li key={n.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
              <span className="rounded-[5px] bg-accent-wash px-[5px] py-[3px] font-mono text-[0.7rem] leading-none">{n.id}</span>
              <span>{n.text}</span>
              <span className="col-start-2 text-sm text-muted">Added {fmtDate(n.created)}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">No notes yet.</li>
        )}
      </ul>

      <form onSubmit={save} className="grid gap-2">
        <label htmlFor="note-text" className="text-[0.95rem] font-semibold">Add a note</label>
        <textarea
          id="note-text"
          name="note"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="We installed a heat pump on 15 March 2026"
          className="min-h-16 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2.5 focus:border-accent focus:ring-3 focus:ring-accent-wash focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={BUTTON}>Save note</button>
          <button
            type="button"
            className={BUTTON_QUIET}
            onClick={() => {
              setText(suggestedNote);
              document.getElementById("note-text")?.focus();
            }}
          >
            Use the heat pump example
          </button>
        </div>
        <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {status?.message}
          {status?.askAgain && (
            <button type="button" className={BUTTON_QUIET_SMALL} onClick={() => onAsk(lastQuestion)}>
              Ask the last question again
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
