"use client";

import { ChevronRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { BUTTON, BUTTON_QUIET, BUTTON_QUIET_SMALL, FIELD, HEADING } from "./ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { AuditEntry, Note } from "@/lib/types";

// Household notes explain what bills can't show. Answers recall them from
// H-MEM and cite them as M#. A note flagged for review (an answer that used
// it was marked not useful) isn't used until the household keeps it. Under
// the notes, H-MEM's trust ledger as the memory audit (live mode).
export function NotesCard({ notes, audit, onAdd, onKeep, suggestedNote, lastQuestion, onAsk }: {
  notes: Note[];
  audit: { entries: AuditEntry[]; total: number };
  onAdd: (text: string) => Promise<Note>;
  onKeep: (id: string) => Promise<void>;
  suggestedNote: string;
  lastQuestion: string;
  onAsk: (question: string) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ message: string; askAgain: boolean } | null>(null);

  async function keep(id: string) {
    try {
      await onKeep(id);
      setStatus({ message: `Kept ${id}: answers use it again.`, askAgain: Boolean(lastQuestion) });
    } catch (err) {
      setStatus({ message: `Couldn't keep ${id}: ${(err as Error).message}`, askAgain: false });
    }
  }

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
    <section aria-labelledby="notes-title" className="grid min-w-0 gap-3 border-t border-line pt-8">
      <div className="grid gap-1">
        <h2 id="notes-title" className={HEADING}>Household notes</h2>
        <p className="text-sm text-ink-2">
          Things your bills can&apos;t show, like a new appliance or someone working from home. Answers use them to explain changes in use.
        </p>
      </div>
      <ul className="grid">
        {notes.length ? (
          notes.map((n) => (
            <li key={n.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 border-t border-rule py-2.5">
              <span className="rounded-[3px] bg-hl-wash px-1 text-[0.78rem] font-bold text-ink">{n.id}</span>
              <span className={n.flagged ? "text-ink-2" : undefined}>{n.text}</span>
              <span className="col-start-2 text-sm text-muted">Added {fmtDate(n.created)}</span>
              {n.flagged && (
                <span className="col-start-2 mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-[4px] bg-rise-wash px-1.5 py-px font-semibold text-rise">Flagged for review</span>
                  <span className="text-ink-2">Answers don&apos;t use it until you keep it.</span>
                  <button type="button" className={BUTTON_QUIET_SMALL} onClick={() => keep(n.id)}>Keep {n.id}</button>
                </span>
              )}
            </li>
          ))
        ) : (
          <li className="rounded-md border border-dashed border-control px-3 py-2.5 text-sm text-ink-2">No notes yet. Add one below and ask again to see the answer use it.</li>
        )}
      </ul>

      <form onSubmit={save} className="grid gap-2">
        <label htmlFor="note-text" className="font-semibold">Add a note</label>
        <textarea
          id="note-text"
          name="note"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="We installed a heat pump on 15 March 2026"
          className={`${FIELD} min-h-16 resize-y py-2.5`}
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

      {audit.total > 0 && (
        <details className="group border-t border-rule pt-3">
          <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" strokeWidth={2.5} />
              Memory audit
            </span>
            <span className="text-sm text-muted">{audit.total} entr{audit.total === 1 ? "y" : "ies"} in H-MEM&apos;s ledger</span>
          </summary>
          <ol className="mt-2 grid">
            {audit.entries.map((e, i) => (
              <li key={`${e.at}|${i}`} className="grid gap-0.5 border-t border-rule py-2 text-sm">
                <span className="text-ink">{e.text}</span>
                <span className="text-muted">{fmtDateTime(e.at)}</span>
              </li>
            ))}
          </ol>
          {audit.total > audit.entries.length && <p className="pt-2 text-sm text-muted">Showing the latest {audit.entries.length}.</p>}
        </details>
      )}
    </section>
  );
}
