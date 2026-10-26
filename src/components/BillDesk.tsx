"use client";

import { useRef, useState } from "react";
import { AddBillForm } from "./AddBillForm";
import { AnswerContent, type Result } from "./AnswerSheet";
import { AskBar } from "./AskBar";
import { BillsCard } from "./BillsCard";
import { EvidenceDrawer, type DrawerTarget } from "./EvidenceDrawer";
import { NotesCard } from "./NotesCard";
import { TopBar } from "./TopBar";
import { postJson, postStream } from "@/lib/client";
import type { AskResult, AuditEntry, Bill, Household, Mode, Note, TraceStep, Utility } from "@/lib/types";

// The one line that says the household is made up (PLAN.md rule 8), and what the answers are in this mode.
const FOOTNOTE: Record<Mode, string> = {
  preview: "Made-up household for the demo; the answers are hand-written previews. Prices from Octopus Energy and weather from Open-Meteo are real.",
  replay: "Made-up household for the demo; answers recorded from earlier runs of the agents. Prices from Octopus Energy and weather from Open-Meteo are real.",
  live: "Made-up household for the demo. Prices from Octopus Energy and weather from Open-Meteo are real.",
};

// The whole page: the ask box and the answer sheet in the main column, bills and notes beside them.
export function BillDesk({ mode, household, bills, initialNotes, initialAudit, initialResult, examples, suggestedNote, previewIds }: {
  mode: Mode;
  household: Household;
  bills: Bill[];
  initialNotes: Note[];
  initialAudit: { entries: AuditEntry[]; total: number };
  initialResult: AskResult | null;
  examples: string[];
  suggestedNote: string;
  previewIds: string[];
}) {
  const first = initialResult?.kind === "answer" ? initialResult.answer : null;
  const [utility, setUtility] = useState<Utility>(first?.utility ?? "gas");
  const [result, setResult] = useState<Result>(initialResult);
  const [busy, setBusy] = useState(false);
  const [billList, setBillList] = useState(bills);
  const [adding, setAdding] = useState<{ utility: Utility; period: string | null } | null>(null);
  const [progress, setProgress] = useState<TraceStep[]>([]);
  const [question, setQuestion] = useState(first?.question ?? "");
  const [lastQuestion, setLastQuestion] = useState(first?.question ?? "");
  const [notes, setNotes] = useState(initialNotes);
  const [audit, setAudit] = useState(initialAudit);
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [announcement, setAnnouncement] = useState("");
  const answerRef = useRef<HTMLElement>(null);

  const selected =
    result?.kind === "answer" ? result.answer.bill_b
    : result?.kind === "answers" ? (result.answers.find((a) => a.utility === utility) ?? result.answers[0]).bill_b
    : result?.kind === "no_preview" ? result.bill_id
    : result?.kind === "triage" ? (result.requests.find((r) => r.utility === utility) ?? result.requests[0])?.bill_b ?? null
    : null;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion(q);
    setLastQuestion(q);
    setBusy(true);
    setProgress([]);
    // Live answers take a while: show the agents at work straight away.
    if (mode === "live") requestAnimationFrame(showAnswer);
    try {
      const res = mode === "live" ? await askLive(q) : await postJson<AskResult>("/api/ask", { question: q });
      setResult(res);
      if (mode === "live") void refreshMemory(); // the answer recalled notes and saved findings
      if (res.kind === "answer") setUtility(res.answer.utility);
      if (res.kind === "answers") setUtility(res.answers[0].utility);
      if (res.kind === "no_preview") setUtility(res.utility);
      if (res.kind === "triage" && res.requests.length) setUtility(res.requests[0].utility);
      setAnnouncement(
        res.kind === "answer" || res.kind === "answers" ? "Answer ready."
        : res.kind === "triage" ? "Triage ready."
        : res.kind === "clarify" || res.kind === "general" ? res.message
        : res.kind === "blocked" ? res.reason
        : "No preview answer for this bill.",
      );
    } catch (err) {
      setResult({ kind: "error", message: (err as Error).message });
      setAnnouncement("Couldn't get an answer.");
    } finally {
      setBusy(false);
    }
    showAnswer();
  }

  // On one-column layouts a long answer can push the sheet's top out of view, so bring it back.
  function showAnswer() {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    answerRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // Live answers stream each agent step, then the result.
  async function askLive(q: string): Promise<AskResult> {
    let result: AskResult | null = null;
    await postStream("/api/ask", { question: q }, (event) => {
      if (event.type === "step") setProgress((steps) => [...steps, event.step as TraceStep]);
      if (event.type === "result") result = event.result as AskResult;
      if (event.type === "error") throw new Error(String(event.message));
    });
    if (!result) throw new Error("The answer stream ended without a result");
    return result;
  }

  // After the household adds a missing bill: show it, then ask again (the
  // question that found it missing, or why the new bill changed).
  async function billSaved(billId: string, period: string | null) {
    const res = await fetch("/api/bills");
    const fresh = ((await res.json()) as { bills: Bill[] }).bills ?? billList;
    setBillList(fresh);
    setAdding(null);
    const bill = fresh.find((b) => b.bill_id === billId);
    if (bill) setUtility(bill.utility);
    await ask(period && lastQuestion ? lastQuestion : bill ? `Why did my ${bill.utility} bill change in ${bill.label}?` : lastQuestion);
  }

  // Notes and the memory audit, after anything that changes them.
  async function refreshMemory() {
    const res = await fetch("/api/notes").catch(() => null);
    if (!res?.ok) return;
    const fresh = (await res.json()) as { notes: Note[]; audit: { entries: AuditEntry[]; total: number } };
    setNotes(fresh.notes);
    setAudit(fresh.audit);
  }

  async function addNote(text: string) {
    const { note } = await postJson<{ note: Note }>("/api/note", { text });
    setNotes((all) => [...all, note]);
    if (mode === "live") void refreshMemory();
    return note;
  }

  async function keepNote(id: string) {
    await postJson<{ note: Note }>("/api/note/keep", { id });
    await refreshMemory();
  }

  return (
    <>
      <TopBar mode={mode} household={household} />
      {/* Two planes, no cards: the ask box and the answer on white lead the reading order (first on phones);
          the bills and notes sit on the tinted rail, on the left on wide screens. */}
      <main className="grid lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <div className="min-w-0 bg-surface lg:col-start-2 lg:row-start-1">
          <div className="gutter mx-auto grid max-w-[1080px] gap-10 pt-8 pb-14 lg:pt-10">
            <AskBar question={question} onQuestion={setQuestion} onAsk={ask} examples={examples} busy={busy} />
            <section
              ref={answerRef}
              aria-labelledby="answer-title"
              aria-busy={busy}
              className={`min-w-0 scroll-mt-4 border-t border-line pt-10 transition-opacity ${mode === "live" ? "" : "aria-busy:opacity-50"}`}
            >
              {adding ? (
                <AddBillForm key={`${adding.utility}|${adding.period}`} utility={adding.utility} period={adding.period} onSaved={(id) => billSaved(id, adding.period)} onCancel={() => setAdding(null)} />
              ) : (
              <AnswerContent
                result={result}
                busy={busy}
                progress={progress}
                mode={mode}
                bills={billList}
                onAddBill={mode === "live" ? setAdding : undefined}
                onAsk={ask}
                lastQuestion={lastQuestion}
                utility={utility}
                onUtility={setUtility}
                onOpen={(ref, answer) => setDrawer({ ref, answer })}
                onMemoryChanged={mode === "live" ? refreshMemory : undefined}
              />
              )}
            </section>
          </div>
        </div>
        <aside aria-label="Your bills and household notes" className="min-w-0 border-t border-line bg-ground lg:col-start-1 lg:row-start-1 lg:border-t-0 lg:border-r">
          <div className="gutter grid gap-8 pt-8 pb-14 lg:pt-10">
            <BillsCard
              household={household}
              bills={billList}
              utility={utility}
              onUtility={setUtility}
              selected={selected}
              previewIds={previewIds}
              onAsk={ask}
              onAddBill={mode === "live" ? () => setAdding({ utility, period: null }) : undefined}
            />
            <NotesCard notes={notes} audit={audit} onAdd={addNote} onKeep={keepNote} suggestedNote={suggestedNote} lastQuestion={lastQuestion} onAsk={ask} />
          </div>
        </aside>
      </main>
      <footer className="bg-letterhead text-letterhead-2">
        <div className="gutter flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6 text-sm">
          <p className="max-w-[72ch]">
            <span className="font-semibold text-letterhead-ink">Why My Bill</span> reads the household&apos;s data through Zetaris, reasons with NVIDIA Nemotron via Meterless Nightshift, and keeps household notes in Meterless H-MEM.
          </p>
          <p>{FOOTNOTE[mode]}</p>
        </div>
      </footer>
      <p role="status" className="sr-only">{announcement}</p>
      <EvidenceDrawer
        target={drawer}
        mode={mode}
        notes={notes}
        onOpen={(ref, from) => setDrawer((d) => d && { ref, answer: d.answer, from })}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}
