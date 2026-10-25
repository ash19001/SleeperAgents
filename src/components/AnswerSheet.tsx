"use client";

import { ArrowRight, Check, CircleQuestionMark, Info, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Chip, Chips } from "./Chip";
import { Examples } from "./Examples";
import { LiveProgress } from "./LiveProgress";
import { TraceList } from "./TraceList";
import { TriageCard } from "./TriageCard";
import { BUTTON_QUIET_SMALL } from "./ui";
import { postJson } from "@/lib/client";
import { money } from "@/lib/format";
import { CAUSE_NAMES, PART_NAMES, UTILITIES, VERDICTS } from "@/lib/labels";
import type { Answer, AskResult, Assessment, Bill, Cause, Mode, TraceStep } from "@/lib/types";

export type Result = AskResult | { kind: "error"; message: string } | null;

type Open = (ref: string) => void;

export function AnswerContent({ result, busy, progress, mode, bills, examples, lastQuestion, onAsk, onOpen }: {
  result: Result;
  busy: boolean;
  progress?: TraceStep[];
  mode: Mode;
  bills: Bill[];
  examples: string[];
  lastQuestion: string;
  onAsk: (question: string) => void;
  onOpen: (ref: string, answer: Answer) => void;
}) {
  // Live answers take a while, so show the agents at work rather than fade the last answer.
  if (busy && mode === "live" && progress) return <LiveProgress steps={progress} />;
  if (busy && !result) {
    return (
      <Message
        title="Working on it"
        text={mode === "live" ? "The agents are investigating: reading the question, testing each cause and checking the numbers. This takes about a minute." : "Reading the question, testing the causes and checking the numbers."}
      />
    );
  }
  if (!result) return <Message title="Ask about a bill" text="Tap a bar or type a question to see why that bill changed." examples={examples} onAsk={onAsk} />;
  switch (result.kind) {
    case "answer": {
      const a = result.answer;
      // A new key per answer resets the feedback buttons.
      return <AnswerView key={`${a.bill_b}|${a.question}|${a.memory.length}`} answer={a} mode={mode} bills={bills} onOpen={(ref) => onOpen(ref, a)} />;
    }
    case "answers":
      return <AnswersView key={`${result.question}|${result.answers.map((a) => a.bill_b).join()}`} result={result} mode={mode} bills={bills} onOpen={onOpen} />;
    case "clarify": {
      const opts = result.options ?? [];
      return (
        <>
          <Message title="Which bill do you mean?" text={result.message} examples={opts.length ? undefined : examples} onAsk={onAsk} />
          {opts.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Choose a bill">
              {opts.map((o) => (
                <button key={o.label} type="button" className={BUTTON_QUIET_SMALL} onClick={() => onAsk(`${lastQuestion} (I mean my ${o.utility ?? o.label.toLowerCase()} bill)`)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {result.trace && <TraceList steps={result.trace} />}
        </>
      );
    }
    case "blocked":
      return (
        <>
          <Message title="I can't help with that question" text={result.reason} examples={examples} onAsk={onAsk} />
          {result.trace && <TraceList steps={result.trace} />}
        </>
      );
    case "general":
      return (
        <>
          <Message title="Ask about a bill" text={result.message} examples={examples} onAsk={onAsk} />
          {result.trace && <TraceList steps={result.trace} />}
        </>
      );
    case "triage":
      return <TriageCard result={result} bills={bills} />;
    case "no_preview":
      return (
        <Message
          title="No preview answer for this bill yet"
          text="In preview mode, answers exist only for the bills marked with a dot. Once the agent is connected, every bill gets one."
          examples={examples}
          onAsk={onAsk}
        />
      );
    case "error":
      return <Message title="Couldn't get an answer" text={`${result.message}. Check that the server is running, then try again.`} />;
  }
}

function Message({ title, text, examples, onAsk }: { title: string; text: string; examples?: string[]; onAsk?: (q: string) => void }) {
  return (
    <div className="grid gap-3">
      <h2 id="answer-title" className="headline text-[1.35rem] font-bold">{title}</h2>
      <p className="text-muted">{text}</p>
      {examples && onAsk && <Examples examples={examples} onAsk={onAsk} />}
    </div>
  );
}

type AnswersResult = Extract<AskResult, { kind: "answers" }>;

// Two or more utilities: the combiner's summary, then one answer each, then
// the trace once for the whole question.
function AnswersView({ result, mode, bills, onOpen }: { result: AnswersResult; mode: Mode; bills: Bill[]; onOpen: (ref: string, answer: Answer) => void }) {
  // The summary's {F#} come from its own facts; it has no citations.
  const summary = { ...result.answers[0], facts: result.summary_facts, evidence: [], memory: [] };
  return (
    <>
      <header className="grid gap-1.5">
        <p className="eyebrow">{result.answers.map((a) => UTILITIES[a.utility].name).join(" and ")}</p>
        <h2 id="answer-title" className="headline text-[clamp(1.3rem,1.05rem+1vw,1.7rem)] leading-tight font-bold">“{result.question}”</h2>
      </header>
      {result.summary_markdown && (
        <p className="max-w-[66ch] text-[1.08rem] leading-[1.65]">
          <RichText text={result.summary_markdown} answer={summary} onOpen={() => {}} />
        </p>
      )}
      {result.notes.length > 0 && <p className="text-sm text-muted">{result.notes.join(" ")}</p>}
      {result.answers.map((a) => (
        <article key={a.utility} aria-label={`${UTILITIES[a.utility].name} bill`} className="grid gap-6 border-t-2 border-line pt-6">
          <AnswerView answer={a} mode={mode} bills={bills} onOpen={(ref) => onOpen(ref, a)} nested />
        </article>
      ))}
      <TraceList steps={result.trace} />
    </>
  );
}

function AnswerView({ answer: a, mode, bills, onOpen, nested }: { answer: Answer; mode: Mode; bills: Bill[]; onOpen: Open; nested?: boolean }) {
  const A = bills.find((b) => b.bill_id === a.bill_a);
  const B = bills.find((b) => b.bill_id === a.bill_b);
  const from = a.total_a ?? A?.total_gbp;
  const to = a.total_b ?? B?.total_gbp;
  return (
    <>
      <header className="grid gap-1.5">
        <p className="eyebrow">
          {UTILITIES[a.utility].name} · {A?.label ?? a.bill_a} → {B?.label ?? a.bill_b}
        </p>
        {!nested && <h2 id="answer-title" className="headline text-[clamp(1.3rem,1.05rem+1vw,1.7rem)] leading-tight font-bold">“{a.question}”</h2>}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <span className="headline text-[clamp(2.6rem,2rem+3vw,3.6rem)] leading-none font-extrabold tracking-[-0.02em]">
            {money(a.change_gbp, true)}
          </span>
          <Direction change={a.change_gbp} />
          {from != null && to != null && <span className="text-ink-2">from {money(from)} to {money(to)}</span>}
        </div>
      </header>
      <p className="max-w-[66ch] text-[1.08rem] leading-[1.65]">
        <RichText text={a.answer_markdown} answer={a} onOpen={onOpen} />
      </p>
      <SplitBlock answer={a} onOpen={onOpen} />
      <CausesBlock answer={a} onOpen={onOpen} />
      <RuledOutBlock answer={a} onOpen={onOpen} />
      <SureBlock answer={a} />
      <StepsBlock answer={a} onOpen={onOpen} />
      <TimelineBlock answer={a} />
      {a.checked && <p className="flex items-center gap-1.5 text-sm text-ink-2"><Check aria-hidden className="size-3.5 flex-none text-accent" strokeWidth={2.5} />{CHECKED[a.checked.by]}</p>}
      <Feedback answer={a} />
      {!nested && <TraceList steps={a.trace} note={mode === "preview" ? "Preview: these times are typical figures from test calls, not from this answer." : undefined} />}
    </>
  );
}

function Direction({ change }: { change: number }) {
  const pennies = Math.round(change * 100);
  const [cls, text] =
    pennies > 0 ? ["bg-up-wash text-up-ink", "▲ Up"] : pennies < 0 ? ["bg-down-wash text-down-ink", "▼ Down"] : ["bg-surface-2 text-ink-2", "No change"];
  return <span className={`inline-flex items-center rounded-full px-[9px] py-0.5 text-[0.85rem] font-bold ${cls}`}>{text}</span>;
}

// Fills {F#} placeholders from the facts table and turns [E#] / [M#] into citation chips.
function RichText({ text, answer, onOpen }: { text: string; answer: Answer; onOpen: Open }) {
  return text.split(/(\{F\d+\}|\[[EM]\d+\])/).filter(Boolean).map((part, i) => {
    const fact = part.match(/^\{(F\d+)\}$/);
    if (fact) {
      const f = answer.facts.find((x) => x.id === fact[1]);
      return (
        <strong key={i} className="font-bold" title={f ? `${f.id}, from ${f.evidence.join(", ")}` : undefined}>
          {f ? f.value : part}
        </strong>
      );
    }
    const ref = part.match(/^\[([EM]\d+)\]$/);
    if (ref) return <Chip key={i} refId={ref[1]} answer={answer} onOpen={onOpen} />;
    return <span key={i}>{part}</span>;
  });
}

function Block({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <h3 id={id} className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const SPLIT_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-[7px] [grid-template-areas:'label_value'_'track_track'] sm:grid-cols-[15rem_minmax(0,1fr)_6.5rem] sm:[grid-template-areas:'label_track_value']";

function SplitBlock({ answer: a, onOpen }: { answer: Answer; onOpen: Open }) {
  const max = Math.max(...a.components.map((c) => Math.abs(c.gbp)), 0.01);
  const off = a.components.reduce((t, c) => t + Math.round(c.gbp * 100), 0) - Math.round(a.change_gbp * 100);
  const legend = (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.82rem] text-ink-2">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-3.5 rounded-xs bg-up" />Adds to the bill</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-3.5 rounded-xs bg-down" />Takes off the bill</span>
    </div>
  );
  return (
    <Block id="h-split" title="Where the £ went" aside={legend}>
      <div className="grid">
        {a.components.map((c) => {
          const zero = Math.round(c.gbp * 100) === 0;
          return (
            <div key={c.id} className={`${SPLIT_ROW} ${zero ? "text-muted" : ""}`}>
              <span className="min-w-0 [grid-area:label]">
                {PART_NAMES[c.id] ?? c.id} {!zero && <Chips refs={c.evidence} answer={a} onOpen={onOpen} />}
              </span>
              <span aria-hidden className="relative h-3.5 [grid-area:track] before:absolute before:-inset-y-1 before:left-1/2 before:border-l before:border-axis">
                {!zero && (
                  <span
                    style={{ width: `calc(${(Math.abs(c.gbp) / max) * 50}% - 1px)` }}
                    className={`absolute top-px h-3 ${c.gbp > 0 ? "left-[calc(50%+1px)] rounded-r-[4px] bg-up" : "right-1/2 rounded-l-[4px] bg-down"}`}
                  />
                )}
              </span>
              <span className={`text-right whitespace-nowrap tabular-nums [grid-area:value] ${zero ? "" : "font-bold"}`}>{money(c.gbp, true)}</span>
            </div>
          );
        })}
        <div className={`${SPLIT_ROW} mt-1 border-t border-line pt-2.5 font-bold`}>
          <span className="[grid-area:label]">Total change</span>
          <span className="[grid-area:track]" />
          <span className="text-right whitespace-nowrap tabular-nums [grid-area:value]">{money(a.change_gbp, true)}</span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-ink-2">
        {off === 0 ? <Check aria-hidden className="size-3.5 flex-none text-accent" strokeWidth={2.5} /> : <X aria-hidden className="size-3.5 flex-none text-up-ink" />}
        {off === 0 ? "The parts add up to the change, to the penny." : `The parts are ${money(Math.abs(off) / 100)} away from the change.`}
      </p>
    </Block>
  );
}

const CHECKED: Record<NonNullable<Answer["checked"]>["by"], string> = {
  writer: "Checked in code: every number matches a measurement and every reason cites its evidence.",
  rewrite: "Checked in code after one rewrite: every number matches a measurement and every reason cites its evidence.",
  template: "The written answer didn't pass the checks, so this is the plain version built from the measurements.",
};

const PILL: Record<Cause["verdict"], string> = {
  supported: "bg-accent-wash text-ink",
  ruled_out: "border border-line text-muted",
  inconclusive: "border border-dashed border-axis bg-surface-2 text-ink-2",
};

function CauseItem({ cause, answer, onOpen, quiet }: { cause: Cause; answer: Answer; onOpen: Open; quiet?: boolean }) {
  const Icon = cause.verdict === "supported" ? Check : cause.verdict === "ruled_out" ? X : CircleQuestionMark;
  const showEffect = cause.verdict === "supported" && Math.round(cause.effect_gbp * 100) !== 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-[0.7rem] font-bold tracking-[0.05em] uppercase ${PILL[cause.verdict]}`}>
          <Icon aria-hidden className="size-3" strokeWidth={3} />
          {VERDICTS[cause.verdict]}
        </span>
        <span className={quiet ? "font-semibold text-ink-2" : "font-bold"}>{CAUSE_NAMES[cause.id] ?? cause.id}</span>
      </div>
      {showEffect ? (
        <span className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap tabular-nums">
          <span aria-hidden className={`size-2 rounded-full ${cause.effect_gbp > 0 ? "bg-up" : "bg-down"}`} />
          {money(cause.effect_gbp, true)}
        </span>
      ) : (
        <span />
      )}
      <p className={`col-span-full max-w-[66ch] ${quiet ? "text-[0.95rem] text-muted" : "text-ink-2"}`}>
        {cause.detail} <Chips refs={[...cause.evidence, ...cause.memory]} answer={answer} onOpen={onOpen} />
      </p>
    </li>
  );
}

function CausesBlock({ answer: a, onOpen }: { answer: Answer; onOpen: Open }) {
  const shown = [...a.causes.filter((c) => c.verdict === "supported"), ...a.causes.filter((c) => c.verdict === "inconclusive")];
  return (
    <Block id="h-why" title="Why it changed">
      {shown.length ? (
        <ul className="grid gap-3.5">{shown.map((c) => <CauseItem key={c.id} cause={c} answer={a} onOpen={onOpen} />)}</ul>
      ) : (
        <p className="text-muted">None of the causes tested explains this change.</p>
      )}
    </Block>
  );
}

function RuledOutBlock({ answer: a, onOpen }: { answer: Answer; onOpen: Open }) {
  const ruled = a.causes.filter((c) => c.verdict === "ruled_out");
  if (!ruled.length) return null;
  return (
    <Block id="h-ruled" title={`Ruled out (${ruled.length})`}>
      <ul className="grid gap-3">{ruled.map((c) => <CauseItem key={c.id} cause={c} answer={a} onOpen={onOpen} quiet />)}</ul>
    </Block>
  );
}

const LEVEL: Record<Assessment["level"], [string, string]> = {
  high: ["High confidence", "bg-accent-wash text-ink"],
  medium: ["Medium confidence", "border border-line bg-surface-2 text-ink-2"],
  low: ["Low confidence", "bg-up-wash text-up-ink"],
};

// Worked out in code from the investigation: how much is explained, and what isn't known.
function SureBlock({ answer: a }: { answer: Answer }) {
  const s = a.assessment;
  if (!s) return null;
  const [label, cls] = LEVEL[s.level];
  return (
    <Block id="h-sure" title="How sure we are" aside={<span className={`rounded-full px-[9px] py-0.5 text-[0.82rem] font-bold ${cls}`}>{label}</span>}>
      <ul className="grid gap-1.5">
        {s.reasons.map((r) => (
          <li key={r} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-ink-2">
            <Check aria-hidden className="mt-1 size-3.5 text-accent" strokeWidth={2.5} />
            {r}
          </li>
        ))}
      </ul>
      {s.limitations.length > 0 && (
        <div className="grid gap-1.5">
          <h4 className="text-[0.95rem] font-semibold">What this can&apos;t tell you</h4>
          <ul className="grid gap-1.5">
            {s.limitations.map((l) => (
              <li key={l} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-[0.95rem] text-muted">
                <Info aria-hidden className="mt-1 size-3.5" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Block>
  );
}

// The back-and-forth: the orchestrator's plan and reviews, each round of
// specialists, code sending work back, the writer and the checker.
function TimelineBlock({ answer: a }: { answer: Answer }) {
  if (!a.timeline?.length) return null;
  return (
    <Block id="h-how" title="How the agents worked it out">
      <ol className="grid gap-3.5 border-l border-line pl-4">
        {a.timeline.map((t, i) => (
          <li key={i} className="relative grid gap-0.5">
            <span aria-hidden className="absolute top-[7px] -left-[21px] size-2.5 rounded-full border-2 border-surface bg-accent" />
            <p className="text-[0.8rem] font-semibold tracking-[0.04em] text-ink-2 uppercase">{t.actor}</p>
            <p>{t.text}</p>
            {t.detail && t.detail.length > 0 && (
              <ul className="grid gap-0.5 text-[0.92rem] text-muted">
                {t.detail.map((d, j) => (
                  <li key={j} className="before:mr-1.5 before:content-['·']">{d}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Block>
  );
}

function StepsBlock({ answer: a, onOpen }: { answer: Answer; onOpen: Open }) {
  if (!a.next_steps.length) return null;
  return (
    <Block id="h-next" title="What to do next">
      <ul className="grid gap-2.5">
        {a.next_steps.map((s) => (
          <li key={s.action} className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5">
            <ArrowRight aria-hidden className="mt-1 size-4 text-accent" />
            <p>
              {s.action} <Chips refs={s.evidence} answer={a} onOpen={onOpen} />
            </p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Feedback({ answer }: { answer: Answer }) {
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [status, setStatus] = useState("");

  async function send(value: "helpful" | "not_helpful") {
    setRating(value);
    try {
      const res = await postJson<{ stored: boolean }>("/api/feedback", { question: answer.question, bill_a: answer.bill_a, bill_b: answer.bill_b, rating: value, memory: answer.memory.map((n) => n.id) });
      setStatus(res.stored ? "Thanks. Your feedback is saved in the household memory." : "Thanks. Feedback is only saved in live mode.");
    } catch (err) {
      setStatus(`Couldn't save feedback: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-line pt-[18px]">
      <span>Was this answer useful?</span>
      <button type="button" aria-pressed={rating === "helpful"} onClick={() => send("helpful")} className={BUTTON_QUIET_SMALL}>
        <ThumbsUp aria-hidden className="size-4" />Yes
      </button>
      <button type="button" aria-pressed={rating === "not_helpful"} onClick={() => send("not_helpful")} className={BUTTON_QUIET_SMALL}>
        <ThumbsDown aria-hidden className="size-4" />No
      </button>
      <span role="status" className="text-sm text-muted">{status}</span>
    </div>
  );
}
