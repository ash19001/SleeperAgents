"use client";

import { useRef, useState } from "react";
import { AddBillForm } from "./AddBillForm";
import { AnswerContent, type Result } from "./AnswerSheet";
import { BillsCard } from "./BillsCard";
import { EvidenceDrawer, type DrawerTarget } from "./EvidenceDrawer";
import { NotesCard } from "./NotesCard";
import { TopBar } from "./TopBar";
import { postJson, postStream } from "@/lib/client";
import type { AskResult, Bill, Household, Mode, Note, TraceStep, Utility } from "@/lib/types";

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
  const [billList, setBillList] = useState(bills);
  const [adding, setAdding] = useState<{ utility: Utility; period: string | null } | null>(null);
  const [progress, setProgress] = useState<TraceStep[]>([]);
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
    setProgress([]);
    // Live answers take a while: show the agents at work straight away.
    if (mode === "live") requestAnimationFrame(showAnswer);
    try {
      const res = mode === "live" ? await askLive(q) : await postJson<AskResult>("/api/ask", { question: q });
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
    showAnswer();
  }

  // On one-column layouts the answer sits below the bills, so bring it into view.
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
            bills={billList}
            utility={utility}
            onUtility={setUtility}
            selected={selected}
            previewIds={previewIds}
            question={question}
            onQuestion={setQuestion}
            onAsk={ask}
            examples={examples}
            busy={busy}
            onAddBill={mode === "live" ? () => setAdding({ utility, period: null }) : undefined}
          />
        </div>
        <section
          ref={answerRef}
          aria-labelledby="answer-title"
          aria-busy={busy}
          className={`grid min-w-0 scroll-mt-4 gap-6 rounded-xl border border-line bg-surface px-[18px] py-[22px] shadow-sheet transition-opacity ${mode === "live" ? "" : "aria-busy:opacity-50"} sm:px-8 sm:pt-7 sm:pb-[30px] lg:col-start-2 lg:row-span-2 lg:row-start-1`}
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
            examples={examples}
            onAsk={ask}
            lastQuestion={lastQuestion}
            onOpen={(ref, answer) => setDrawer({ ref, answer })}
          />
          )}
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
