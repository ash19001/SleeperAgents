"use client";

import { ArrowLeft, Database, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BUTTON_QUIET_SMALL } from "./ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CAUSE_NAMES, PART_NAMES } from "@/lib/labels";
import type { Answer, Mode, Note } from "@/lib/types";

export type DrawerTarget = { ref: string; answer: Answer; from?: string } | null;

// Shows the exact query behind an E# citation, the household note behind an
// M# citation, or every query behind a highlighted figure (F#).
export function EvidenceDrawer({ target, mode, notes, onOpen, onClose }: {
  target: DrawerTarget;
  mode: Mode;
  notes: Note[];
  onOpen: (ref: string, from?: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  const kind = target?.ref[0];
  const label = kind === "E" ? `Evidence ${target!.ref}` : kind === "M" ? `Household note ${target!.ref}` : "Where this figure comes from";

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
      <div className="grid h-full max-h-[88vh] grid-rows-[auto_minmax(0,1fr)] md:max-h-none">
        <div className="flex items-center justify-between gap-3 bg-letterhead py-3 pr-[max(16px,env(safe-area-inset-right,0px))] pl-5 text-letterhead-ink md:pt-[max(12px,env(safe-area-inset-top,0px))] md:pl-6">
          <p className="flex items-center gap-2 font-bold">
            {target?.from && (
              <button type="button" onClick={() => onOpen(target.from!)} className="-ml-1.5 grid size-8 place-items-center rounded-md hover:bg-white/10" aria-label="Back to the figure">
                <ArrowLeft aria-hidden className="size-4" />
              </button>
            )}
            {label}
          </p>
          <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-letterhead-ink hover:bg-white/10">
            <X aria-hidden className="size-4" />Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom,0px))] md:px-6">
          {target &&
            (kind === "E" ? <EvidenceBody key={target.ref} refId={target.ref} answer={target.answer} mode={mode} />
            : kind === "M" ? <NoteBody refId={target.ref} answer={target.answer} notes={notes} />
            : <FactBody refId={target.ref} answer={target.answer} onOpen={(ref) => onOpen(ref, target.ref)} />)}
        </div>
      </div>
    </dialog>
  );
}

const DL = "grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-line pt-4 text-[0.94rem]";

function FactBody({ refId, answer, onOpen }: { refId: string; answer: Answer; onOpen: (ref: string) => void }) {
  const fact = answer.facts.find((f) => f.id === refId);
  if (!fact) return <p>That figure isn&apos;t part of this answer.</p>;
  return (
    <div className="grid min-w-0 gap-4">
      <h2 id="drawer-title" className="text-[2rem] leading-tight font-extrabold tracking-[-0.015em]">
        <span className="marker text-hl-ink">{fact.value}</span>
      </h2>
      <p className="text-ink-2">
        Measured in code from {fact.evidence.length === 1 ? "this query" : `these ${fact.evidence.length} queries`}. No model typed this number: the writer used a placeholder, and code filled it in.
      </p>
      <ul className="grid border-t border-ink">
        {fact.evidence.map((id) => {
          const ev = answer.evidence.find((e) => e.id === id);
          return (
            <li key={id} className="border-b border-rule">
              <button type="button" onClick={() => onOpen(id)} className="group grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 text-left hover:bg-surface-2">
                <span className="font-bold text-link group-hover:text-ink">{id}</span>
                <span className="font-semibold">{ev?.title ?? id}</span>
                <Database aria-hidden className="size-4 self-center text-muted group-hover:text-ink" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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
    <div className="grid min-w-0 gap-4">
      <h2 id="drawer-title" className="text-[1.45rem] leading-tight font-extrabold tracking-[-0.01em]">{ev.title}</h2>
      {mode === "preview" && (
        <p className="rounded-md bg-hl-wash px-3 py-2 text-[0.92rem] text-ink">
          Preview: this query hasn&apos;t run yet. It shows what the agents will send to Zetaris.
        </p>
      )}
      {ev.source === "local-sample" && (
        <p className="rounded-md bg-hl-wash px-3 py-2 text-[0.92rem] text-ink">
          Read from the SAMPLE supplier file on this machine. The same read becomes a Zetaris query once the data is registered there.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">{ev.source === "local-sample" ? "How it was read" : "Query sent to Zetaris"}</h3>
        <span className="flex items-center gap-2">
          <span role="status" className="text-sm text-muted">{copied}</span>
          <button type="button" onClick={copy} className={BUTTON_QUIET_SMALL}>{ev.source === "local-sample" ? "Copy" : "Copy SQL"}</button>
        </span>
      </div>
      <pre className="overflow-x-auto rounded-md border border-line bg-code px-4 py-3 font-mono text-[0.8rem] leading-relaxed whitespace-pre">
        <code ref={code}>{ev.sql}</code>
      </pre>
      <dl className={DL}>
        <dt className="text-muted">Rows returned</dt>
        <dd>{ev.rows}</dd>
        <dt className="text-muted">Run at</dt>
        <dd>{fmtDateTime(ev.at)}</dd>
        <dt className="text-muted">Fingerprint</dt>
        <dd className="min-w-0">
          <span className="font-mono text-[0.78rem] break-all">{ev.sha256}</span>
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
    <div className="grid min-w-0 gap-4">
      <h2 id="drawer-title" className="text-[1.45rem] leading-tight font-extrabold tracking-[-0.01em]">What you told us</h2>
      <blockquote className="rounded-md bg-hl-wash px-4 py-3 text-[1.08rem] text-ink">{note.text}</blockquote>
      <dl className={DL}>
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
