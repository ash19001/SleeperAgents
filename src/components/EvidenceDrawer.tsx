"use client";

import { useEffect, useRef, useState } from "react";
import { BUTTON_QUIET_SMALL } from "./ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CAUSE_NAMES, PART_NAMES } from "@/lib/labels";
import type { Answer, Mode, Note } from "@/lib/types";

export type DrawerTarget = { ref: string; answer: Answer } | null;

// Shows the exact query behind an E# citation, or the household note behind an M# citation.
export function EvidenceDrawer({ target, mode, notes, onClose }: {
  target: DrawerTarget;
  mode: Mode;
  notes: Note[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gutter grid h-full max-h-[88vh] content-start gap-4 overflow-y-auto pt-4 pb-[max(24px,env(safe-area-inset-bottom,0px))] md:max-h-none md:pt-[max(18px,env(safe-area-inset-top,0px))] md:pr-[max(22px,env(safe-area-inset-right,0px))] md:pl-[22px]">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON_QUIET_SMALL}>Close</button>
        </div>
        {target &&
          (target.ref.startsWith("E")
            ? <EvidenceBody key={target.ref} refId={target.ref} answer={target.answer} mode={mode} />
            : <NoteBody refId={target.ref} answer={target.answer} notes={notes} />)}
      </div>
    </dialog>
  );
}

function EvidenceBody({ refId, answer, mode }: { refId: string; answer: Answer; mode: Mode }) {
  const code = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState("");
  const ev = answer.evidence.find((e) => e.id === refId);
  if (!ev) return <p>That evidence isn&apos;t part of this answer.</p>;

  const usedFor = [
    ...answer.components.filter((c) => c.evidence.includes(refId) && Math.round(c.gbp * 100) !== 0).map((c) => PART_NAMES[c.id] ?? c.id),
    ...answer.causes.filter((c) => c.evidence.includes(refId)).map((c) => CAUSE_NAMES[c.id] ?? c.id),
  ];

  function copy() {
    navigator.clipboard.writeText(ev!.sql).then(
      () => setCopied("Copied"),
      () => {
        if (code.current) window.getSelection()?.selectAllChildren(code.current);
        setCopied("Selected. Press Ctrl+C or ⌘C to copy.");
      },
    );
  }

  return (
    <div className="grid min-w-0 gap-3.5">
      <p className="eyebrow">Evidence {ev.id}</p>
      <h2 id="drawer-title" className="headline text-[1.4rem] leading-tight font-bold">{ev.title}</h2>
      {mode === "preview" && (
        <p className="rounded-lg bg-sample px-3 py-2 text-[0.9rem] text-sample-ink">
          Preview: this query hasn&apos;t run yet. It shows what the agent will send to Zetaris.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <h3 className="eyebrow">Query sent to Zetaris</h3>
        <span className="flex items-center gap-2">
          <span role="status" className="text-sm text-muted">{copied}</span>
          <button type="button" onClick={copy} className={BUTTON_QUIET_SMALL}>Copy SQL</button>
        </span>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line bg-code px-3.5 py-3 font-mono text-[0.8rem] leading-relaxed whitespace-pre">
        <code ref={code}>{ev.sql}</code>
      </pre>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.92rem]">
        <dt className="text-muted">Rows returned</dt>
        <dd>{ev.rows}</dd>
        <dt className="text-muted">Run at</dt>
        <dd>{fmtDateTime(ev.at)}</dd>
        <dt className="text-muted">Fingerprint</dt>
        <dd className="min-w-0">
          <span className="font-mono text-[0.76rem] break-all">{ev.sha256}</span>
          <br />
          <span className="text-sm text-muted">
            {mode === "preview"
              ? "SHA-256 of the query text, for this preview."
              : "SHA-256 of the rows returned, so anyone can check the data hasn't changed."}
          </span>
        </dd>
        {usedFor.length > 0 && (
          <>
            <dt className="text-muted">Used for</dt>
            <dd>{usedFor.join(", ")}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function NoteBody({ refId, answer, notes }: { refId: string; answer: Answer; notes: Note[] }) {
  const note = answer.memory.find((m) => m.id === refId) ?? notes.find((n) => n.id === refId);
  if (!note) return <p>That note isn&apos;t part of this answer.</p>;
  const usedFor = answer.causes.filter((c) => c.memory.includes(refId)).map((c) => CAUSE_NAMES[c.id] ?? c.id);
  return (
    <div className="grid min-w-0 gap-3.5">
      <p className="eyebrow">Household note {note.id}</p>
      <h2 id="drawer-title" className="headline text-[1.4rem] leading-tight font-bold">What you told us</h2>
      <blockquote className="rounded-r-lg border-l-[3px] border-accent bg-surface-2 px-3.5 py-3 text-[1.05rem]">{note.text}</blockquote>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.92rem]">
        <dt className="text-muted">Added</dt>
        <dd>{fmtDate(note.created)}</dd>
        <dt className="text-muted">Stored in</dt>
        <dd>Meterless H-MEM, the household memory</dd>
        {usedFor.length > 0 && (
          <>
            <dt className="text-muted">Used for</dt>
            <dd>{usedFor.join(", ")}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
