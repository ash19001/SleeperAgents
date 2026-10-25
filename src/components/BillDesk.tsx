"use client";

import { useRef, useState } from "react";
import { AnswerContent, type Result } from "./AnswerSheet";
import { BillsCard } from "./BillsCard";
import { EvidenceDrawer, type DrawerTarget } from "./EvidenceDrawer";
import { NotesCard } from "./NotesCard";
import { TopBar } from "./TopBar";
import { postJson } from "@/lib/client";
import type { AskResult, Bill, Household, Mode, Note, Utility } from "@/lib/types";

// The whole page: bills and notes on the left, the answer sheet on the right.
export function BillDesk({ mode, household, bills, initialNotes, initialResult, examples, suggestedNote, previewIds }: {
  mode: Mode;
  household: Household;
  bills: Bill[];
  initialNotes: Note[];
  initialResult: AskResult | null;
  examples: string[];
  suggestedNote: string;
  previewIds: string[];
}) {
  const first = initialResult?.kind === "answer" ? initialResult.answer : null;
  const [utility, setUtility] = useState<Utility>(first?.utility ?? "gas");
  const [result, setResult] = useState<Result>(initialResult);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState(first?.question ?? "");
  const [lastQuestion, setLastQuestion] = useState(first?.question ?? "");
  const [notes, setNotes] = useState(initialNotes);
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
    try {
      const res = await postJson<AskResult>("/api/ask", { question: q });
      setResult(res);
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
    // On one-column layouts the answer sits below the bills, so bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      answerRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  async function addNote(text: string) {
    const { note } = await postJson<{ note: Note }>("/api/note", { text });
    setNotes((all) => [...all, note]);
    return note;
  }

  return (
    <>
      <TopBar mode={mode} />
      {/* Phones: bills, answer, notes. Wide screens: bills over notes on the left, the answer on the right. */}
      <main className="gutter mx-auto grid max-w-[1240px] items-start gap-5 pt-5 pb-8 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-6">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <BillsCard
            household={household}
            bills={bills}
            utility={utility}
            onUtility={setUtility}
            selected={selected}
            previewIds={previewIds}
            question={question}
            onQuestion={setQuestion}
            onAsk={ask}
            examples={examples}
            busy={busy}
          />
        </div>
        <section
          ref={answerRef}
          aria-labelledby="answer-title"
          aria-busy={busy}
          className="grid min-w-0 scroll-mt-4 gap-6 rounded-xl border border-line bg-surface px-[18px] py-[22px] shadow-sheet transition-opacity aria-busy:opacity-50 sm:px-8 sm:pt-7 sm:pb-[30px] lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <AnswerContent
            result={result}
            busy={busy}
            mode={mode}
            bills={bills}
            examples={examples}
            onAsk={ask}
            lastQuestion={lastQuestion}
            onOpen={(ref, answer) => setDrawer({ ref, answer })}
          />
        </section>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <NotesCard notes={notes} onAdd={addNote} suggestedNote={suggestedNote} lastQuestion={lastQuestion} onAsk={ask} />
        </div>
      </main>
      <footer className="gutter mx-auto max-w-[1240px] pb-7 text-sm text-muted">
        SAMPLE household data. The agent reads data through Zetaris, reasons with NVIDIA Nemotron via Meterless Nightshift, and keeps household notes in Meterless H-MEM.
      </footer>
      <p role="status" className="sr-only">{announcement}</p>
      <EvidenceDrawer target={drawer} mode={mode} notes={notes} onClose={() => setDrawer(null)} />
    </>
  );
}
