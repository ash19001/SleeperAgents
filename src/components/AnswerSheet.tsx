"use client";

import { ArrowRight, Check, CircleQuestionMark, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Chip, Chips } from "./Chip";
import { Examples } from "./Examples";
import { BUTTON_QUIET_SMALL } from "./ui";
import { postJson } from "@/lib/client";
import { fmtMs, money } from "@/lib/format";
import { CAUSE_NAMES, MODEL_NAMES, PART_NAMES, ROUTES, UTILITIES, VERDICTS } from "@/lib/labels";
import type { Answer, AskResult, Bill, Cause, Mode } from "@/lib/types";

export type Result = AskResult | { kind: "error"; message: string } | null;

type Open = (ref: string) => void;

export function AnswerContent({ result, busy, mode, bills, examples, onAsk, onOpen }: {
  result: Result;
  busy: boolean;
  mode: Mode;
  bills: Bill[];
  examples: string[];
  onAsk: (question: string) => void;
  onOpen: (ref: string, answer: Answer) => void;
}) {
  if (!result) {
    return busy
      ? <Message title="Working on it" text="Reading the question, testing the causes and checking the numbers." />
      : <Message title="Ask about a bill" text="Tap a bar or type a question to see why that bill changed." examples={examples} onAsk={onAsk} />;
  }
  switch (result.kind) {
    case "answer": {
      const a = result.answer;
      // A new key per answer resets the feedback buttons.
      return <AnswerView key={`${a.bill_b}|${a.question}|${a.memory.length}`} answer={a} mode={mode} bills={bills} onOpen={(ref) => onOpen(ref, a)} />;
    }
    case "clarify":
      return <Message title="Which bill do you mean?" text={result.message} examples={examples} onAsk={onAsk} />;
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

function AnswerView({ answer: a, mode, bills, onOpen }: { answer: Answer; mode: Mode; bills: Bill[]; onOpen: Open }) {
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
        <h2 id="answer-title" className="headline text-[clamp(1.3rem,1.05rem+1vw,1.7rem)] leading-tight font-bold">“{a.question}”</h2>
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
      <StepsBlock answer={a} onOpen={onOpen} />
      <Feedback answer={a} />
      <TraceBlock answer={a} mode={mode} />
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
      const res = await postJson<{ stored: boolean }>("/api/feedback", { question: answer.question, bill_b: answer.bill_b, rating: value });
      setStatus(res.stored ? "Thanks. Your feedback is saved with this answer." : "Thanks. Feedback isn't saved in preview mode.");
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

function TraceBlock({ answer: a, mode }: { answer: Answer; mode: Mode }) {
  if (!a.trace.length) return null;
  const total = a.trace.reduce((t, s) => t + s.ms, 0);
  return (
    <details className="group border-t border-line pt-4">
      <summary className="flex cursor-pointer list-none flex-wrap justify-between gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow before:content-['+_'] group-open:before:content-['−_']">How this answer was made</span>
        <span className="text-sm text-muted">{a.trace.length} steps, {fmtMs(total)}</span>
      </summary>
      <ol className="mt-3.5 grid list-decimal gap-2.5 pl-6">
        {a.trace.map((s) => (
          <li key={s.step} className="pl-1">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
              <span className="font-semibold">{s.label ?? s.step}</span>
              <span className="text-ink-2 tabular-nums">{fmtMs(s.ms)}</span>
            </div>
            <div className="text-[0.92rem] text-ink-2">
              {s.model ? `${MODEL_NAMES[s.model] ?? s.model} ${ROUTES[s.route] ?? s.route}` : (ROUTES[s.route] ?? s.route)}
            </div>
            {s.model && <div className="font-mono text-[0.74rem] break-all text-muted">{s.model}</div>}
          </li>
        ))}
      </ol>
      {mode === "preview" && (
        <p className="mt-3 text-sm text-muted">Preview: these times are typical figures from test calls, not from this answer.</p>
      )}
    </details>
  );
}
