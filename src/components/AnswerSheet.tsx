"use client";

import { ArrowDown, ArrowRight, ArrowUp, Check, CircleQuestionMark, Database, FileText, Info, NotebookPen, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react";
import { Chips } from "./Chip";
import { LiveProgress } from "./LiveProgress";
import { Sheet } from "./Sheet";
import { TraceList } from "./TraceList";
import { TriageCard } from "./TriageCard";
import { BUTTON, BUTTON_QUIET_SMALL, HEADING, MARKER } from "./ui";
import { postJson } from "@/lib/client";
import { money } from "@/lib/format";
import { CAUSE_NAMES, PART_NAMES, UTILITIES, VERDICTS } from "@/lib/labels";
import type { Answer, AskResult, Assessment, Bill, Cause, Mode, TraceStep, Utility } from "@/lib/types";

export type Result = AskResult | { kind: "error"; message: string } | null;

type Open = (ref: string) => void;

export function AnswerContent({ result, busy, progress, mode, bills, lastQuestion, utility, onUtility, onAsk, onOpen, onAddBill }: {
  result: Result;
  busy: boolean;
  onAddBill?: (missing: { utility: Utility; period: string | null }) => void;
  progress?: TraceStep[];
  mode: Mode;
  bills: Bill[];
  lastQuestion: string;
  utility: Utility;
  onUtility: (utility: Utility) => void;
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
  if (!result) {
    return (
      <Message title="Ask about a bill" text="Tap a bar or type a question to see why that bill changed. Each answer gives you:">
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "The change split into exact £ parts that add up to the penny",
            "Each likely cause tested: supported, ruled out or not enough data",
            "The query behind every number, one tap away",
            "How sure the answer is, and what to do next",
          ].map((t) => (
            <li key={t} className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 text-ink-2">
              <Check aria-hidden className="mt-1 size-4 rounded-full bg-hl p-0.5 text-hl-ink" strokeWidth={3} />
              {t}
            </li>
          ))}
        </ul>
      </Message>
    );
  }
  switch (result.kind) {
    case "answer": {
      const a = result.answer;
      // A new key per answer resets the tabs and the feedback buttons.
      return <AnswerView key={`${a.bill_b}|${a.question}|${a.memory.length}`} answer={a} mode={mode} bills={bills} onOpen={(ref) => onOpen(ref, a)} />;
    }
    case "answers":
      return <AnswersView key={`${result.question}|${result.answers.map((a) => a.bill_b).join()}`} result={result} mode={mode} bills={bills} utility={utility} onUtility={onUtility} onOpen={onOpen} />;
    case "clarify": {
      const opts = result.options ?? [];
      const missing = result.missing;
      if (missing) {
        const month = new Date(`${missing.period}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
        return (
          <Message title="That bill isn't here yet" text={result.message} trace={result.trace}>
            {onAddBill && (
              <div>
                <button type="button" className={BUTTON} onClick={() => onAddBill(missing)}>
                  Add the {month} {UTILITIES[missing.utility].name.toLowerCase()} bill
                </button>
              </div>
            )}
          </Message>
        );
      }
      return (
        <Message
          title={opts.some((o) => o.question) ? "There's no bill for that date" : "Which bill do you mean?"}
          text={result.message}
          trace={result.trace}
        >
          {opts.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Choose a bill">
              {opts.map((o) => (
                <button key={o.label} type="button" className={BUTTON_QUIET_SMALL} onClick={() => onAsk(o.question ?? `${lastQuestion} (I mean my ${o.utility ?? o.label.toLowerCase()} bill)`)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </Message>
      );
    }
    case "blocked":
      return <Message title="I can't help with that question" text={`${result.reason} Ask why one of your bills changed instead.`} trace={result.trace} />;
    case "general":
      return <Message title="Ask about a bill" text={result.message} trace={result.trace} />;
    case "triage":
      return <TriageCard result={result} bills={bills} />;
    case "no_preview":
      return (
        <Message
          title="No preview answer for this bill yet"
          text="In preview mode, answers exist only for the bills marked with a dot. Once the agents are connected, every bill gets one."
        />
      );
    case "error":
      return <Message title="Couldn't get an answer" text={`${result.message}. Check that the server is running, then try again.`} />;
  }
}

function Message({ title, text, trace, children }: { title: string; text: string; trace?: TraceStep[]; children?: ReactNode }) {
  return (
    <Sheet title={title} heading>
      <p className="max-w-[62ch] text-[1.05rem] text-ink-2">{text}</p>
      {children}
      {trace && <TraceList steps={trace} />}
    </Sheet>
  );
}

type AnswersResult = Extract<AskResult, { kind: "answers" }>;

// Two or more utilities: the combiner's summary, then one utility at a time,
// chosen here or with the bills tabs. The trace covers the whole question.
function AnswersView({ result, mode, bills, utility, onUtility, onOpen }: {
  result: AnswersResult;
  mode: Mode;
  bills: Bill[];
  utility: Utility;
  onUtility: (u: Utility) => void;
  onOpen: (ref: string, answer: Answer) => void;
}) {
  // The summary's {F#} come from its own facts; it has no citations.
  const summary = { ...result.answers[0], facts: result.summary_facts, evidence: [], memory: [] };
  const current = result.answers.find((a) => a.utility === utility) ?? result.answers[0];
  const names = result.answers.map((a) => UTILITIES[a.utility].name.toLowerCase());
  return (
    <Sheet title={`Your ${names.join(" and ")} bills, explained`} meta={checkedShort(current)}>
      <h2 id="answer-title" className="text-[clamp(1.35rem,1.1rem+0.8vw,1.65rem)] leading-tight font-extrabold tracking-[-0.015em]">{result.question}</h2>
      {result.summary_markdown && (
        <p className="max-w-[70ch] text-[1.08rem] leading-[1.65]">
          <RichText text={result.summary_markdown} answer={summary} marked={new Set()} onOpen={() => {}} />
        </p>
      )}
      {result.notes.length > 0 && <p className="text-sm text-muted">{result.notes.join(" ")}</p>}
      <div role="group" aria-label="Bill to show" className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {result.answers.map((a) => {
          const on = a === current;
          return (
            <button
              key={a.utility}
              type="button"
              aria-pressed={on}
              onClick={() => onUtility(a.utility)}
              className={`grid rounded-md border px-4 py-2.5 text-left transition-colors ${on ? "border-primary bg-select" : "border-line hover:border-control"}`}
            >
              <span className="text-sm text-ink-2">{UTILITIES[a.utility].name}</span>
              <span className="text-xl font-bold">{money(a.change_gbp, true)}</span>
            </button>
          );
        })}
      </div>
      <AnswerBody key={current.utility} answer={current} mode={mode} bills={bills} trace={result.trace} onOpen={(ref) => onOpen(ref, current)} />
    </Sheet>
  );
}

function AnswerView({ answer: a, mode, bills, onOpen }: { answer: Answer; mode: Mode; bills: Bill[]; onOpen: Open }) {
  const A = bills.find((b) => b.bill_id === a.bill_a);
  const B = bills.find((b) => b.bill_id === a.bill_b);
  return (
    <Sheet title={`Your ${UTILITIES[a.utility].name.toLowerCase()} bill, explained`} meta={[`${A?.label ?? a.bill_a} → ${B?.label ?? a.bill_b}`, checkedShort(a)].filter(Boolean).join(" · ")}>
      <h2 id="answer-title" className="text-[clamp(1.35rem,1.1rem+0.8vw,1.65rem)] leading-tight font-extrabold tracking-[-0.015em]">{a.question}</h2>
      <AnswerBody answer={a} mode={mode} bills={bills} trace={a.trace} onOpen={onOpen} />
    </Sheet>
  );
}

const TABS = [
  ["answer", "Answer", "Answer"],
  ["agents", "How the agents worked it out", "Agents' work"],
  ["evidence", "Evidence", "Evidence"],
] as const;
type Tab = (typeof TABS)[number][0];

// One utility's answer: the bill pair, the short answer, then the detail in tabs.
function AnswerBody({ answer: a, mode, bills, trace, onOpen }: { answer: Answer; mode: Mode; bills: Bill[]; trace: TraceStep[]; onOpen: Open }) {
  const [tab, setTab] = useState<Tab>("answer");
  const marked = markedFacts(a);
  const id = (t: Tab) => `${a.utility}-${t}`;

  // Arrow keys move between the tabs.
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = TABS.findIndex(([t]) => t === tab);
    const next = TABS[(i + dir + TABS.length) % TABS.length][0];
    setTab(next);
    document.getElementById(`tab-${id(next)}`)?.focus();
  }

  return (
    <>
      <BillPair answer={a} bills={bills} />
      <p className="max-w-[68ch] text-[1.08rem] leading-[1.7]">
        <RichText text={a.answer_markdown} answer={a} marked={marked} onOpen={onOpen} />
      </p>
      <div className="grid gap-6">
        <div role="tablist" aria-label="Answer detail" className="-mx-5 flex overflow-x-auto border-b border-line px-5 sm:-mx-7 sm:px-7">
          {TABS.map(([t, label, short]) => (
            <button
              key={t}
              id={`tab-${id(t)}`}
              role="tab"
              type="button"
              aria-selected={t === tab}
              aria-controls={`panel-${id(t)}`}
              tabIndex={t === tab ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={onTabKey}
              className={`-mb-px flex-none border-b-[3px] px-3 pt-1 pb-2.5 font-semibold whitespace-nowrap transition-colors first:pl-0 ${
                t === tab ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
              {t === "evidence" && <span className="ml-1.5 text-sm font-normal text-muted">{a.evidence.length + a.memory.length}</span>}
            </button>
          ))}
        </div>
        <div id={`panel-${id(tab)}`} role="tabpanel" aria-labelledby={`tab-${id(tab)}`} className="grid gap-8">
          {tab === "answer" && (
            <>
              <div className="grid items-start gap-8 xl:grid-cols-2 xl:grid-rows-[auto_auto_1fr] xl:gap-x-10">
                <div className="xl:col-start-1 xl:row-start-1"><SplitBlock answer={a} /></div>
                <div className="xl:col-start-2 xl:row-span-3 xl:row-start-1"><CausesBlock answer={a} onOpen={onOpen} /></div>
                <div className="xl:col-start-1 xl:row-start-2"><StepsBlock answer={a} onOpen={onOpen} /></div>
                <div className="xl:col-start-1 xl:row-start-3"><SureBlock answer={a} /></div>
              </div>
              <Checked answer={a} />
              <Feedback answer={a} />
            </>
          )}
          {tab === "agents" && (
            <>
              <TimelineBlock answer={a} />
              <TraceList steps={trace} note={mode === "preview" ? "Preview: these times are typical figures from test calls, not from this answer." : undefined} />
            </>
          )}
          {tab === "evidence" && <EvidenceList answer={a} mode={mode} onOpen={onOpen} />}
        </div>
      </div>
    </>
  );
}

// The two bills side by side as labelled fields, with the change highlighted.
function BillPair({ answer: a, bills }: { answer: Answer; bills: Bill[] }) {
  const A = bills.find((b) => b.bill_id === a.bill_a);
  const B = bills.find((b) => b.bill_id === a.bill_b);
  const from = a.total_a ?? A?.total_gbp;
  const to = a.total_b ?? B?.total_gbp;
  const pennies = Math.round(a.change_gbp * 100);
  const cells: [string, ReactNode][] = [
    [`${A?.label ?? "Earlier"} bill`, from != null ? money(from) : "—"],
    [`${B?.label ?? "Later"} bill`, to != null ? money(to) : "—"],
    ["Days on the bill", A && B ? `${A.days} → ${B.days}` : "—"],
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-line sm:grid-cols-4">
      {cells.map(([label, value]) => (
        <div key={label} className="grid content-start gap-0.5 border-line px-4 py-3 odd:border-r nth-[-n+2]:border-b sm:border-r sm:nth-[-n+2]:border-b-0">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="text-xl font-semibold">{value}</dd>
        </div>
      ))}
      <div className="grid content-start gap-0.5 px-4 py-3">
        <dt className="text-sm text-muted">Change</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2">
          <span className={`${MARKER} text-[1.6rem] leading-tight font-extrabold tracking-[-0.01em]`}>{money(a.change_gbp, true)}</span>
          <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${pennies > 0 ? "text-rise" : pennies < 0 ? "text-fall" : "text-muted"}`}>
            {pennies > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : pennies < 0 ? <ArrowDown aria-hidden className="size-3.5" /> : null}
            {pennies > 0 ? "Up" : pennies < 0 ? "Down" : "No change"}
          </span>
        </dd>
      </div>
    </dl>
  );
}

// The highlighter goes on the few figures that answer the question: the
// change itself and the two biggest causes the tests supported.
function markedFacts(a: Answer): Set<string> {
  const targets = new Set([money(Math.abs(a.change_gbp))]);
  a.causes
    .filter((c) => c.verdict === "supported" && Math.round(c.effect_gbp * 100) !== 0)
    .sort((x, y) => Math.abs(y.effect_gbp) - Math.abs(x.effect_gbp))
    .slice(0, 2)
    .forEach((c) => targets.add(money(Math.abs(c.effect_gbp))));
  return new Set(a.facts.filter((f) => targets.has(f.value)).map((f) => f.id));
}

// Fills {F#} placeholders from the facts table and turns [E#] / [M#] into
// citations. A marked figure carries the highlighter and opens its sources.
function RichText({ text, answer, marked, onOpen }: { text: string; answer: Answer; marked: Set<string>; onOpen: Open }) {
  const seen = new Set<string>();
  let order = 0;
  const nodes: ReactNode[] = [];
  let refs: string[] = [];
  const flush = () => {
    if (refs.length) nodes.push(<Chips key={`r${nodes.length}`} refs={refs} answer={answer} onOpen={onOpen} />);
    refs = [];
  };
  text.split(/(\{F\d+\}|\[[EM]\d+\])/).filter(Boolean).forEach((part, i) => {
    const ref = part.match(/^\[([EM]\d+)\]$/);
    if (ref) {
      refs.push(ref[1]);
      return;
    }
    flush();
    const fact = part.match(/^\{(F\d+)\}$/);
    if (!fact) {
      nodes.push(<span key={i}>{part}</span>);
      return;
    }
    const f = answer.facts.find((x) => x.id === fact[1]);
    if (!f) nodes.push(<strong key={i}>{part}</strong>);
    else if (marked.has(f.id) && !seen.has(f.id)) {
      seen.add(f.id);
      nodes.push(
        <button key={i} type="button" onClick={() => onOpen(f.id)} title={`Where ${f.value} comes from`} style={{ "--i": order++ } as CSSProperties} className={MARKER}>
          {f.value}
        </button>,
      );
    } else nodes.push(<strong key={i} className="font-bold">{f.value}</strong>);
  });
  flush();
  return nodes;
}

function Block({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={id} className={HEADING}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const SPLIT_ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-rule py-2 [grid-template-areas:'label_value'_'track_track'] sm:grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)_5rem] sm:[grid-template-areas:'label_track_value']";

// One £ scale for both directions: the zero line sits where the biggest rise
// and the biggest fall leave it, so the bars use the whole track.
function SplitBlock({ answer: a }: { answer: Answer }) {
  const rise = Math.max(0, ...a.components.map((c) => c.gbp));
  const fall = Math.max(0, ...a.components.map((c) => -c.gbp));
  const span = rise + fall || 1;
  const axis = (fall / span) * 100;
  const off = a.components.reduce((t, c) => t + Math.round(c.gbp * 100), 0) - Math.round(a.change_gbp * 100);
  const legend = (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.82rem] text-ink-2">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-3 bg-rise" />Adds to the bill</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-3 bg-fall" />Takes off</span>
    </div>
  );
  return (
    <Block id={`h-split-${a.utility}`} title={`Where the ${money(Math.abs(a.change_gbp))} went`} aside={legend}>
      <div className="grid border-t border-ink">
        {a.components.map((c) => {
          const zero = Math.round(c.gbp * 100) === 0;
          const width = `max(2px, ${(Math.abs(c.gbp) / span) * 100}%)`;
          return (
            <div key={c.id} className={`${SPLIT_ROW} ${zero ? "text-muted" : ""}`}>
              <span className="min-w-0 [grid-area:label]">{PART_NAMES[c.id] ?? c.id}</span>
              <span aria-hidden className="relative h-3 [grid-area:track]">
                <span style={{ left: `${axis}%` }} className="absolute -inset-y-1.5 border-l border-axis" />
                {!zero && (
                  <span
                    style={c.gbp > 0 ? { left: `${axis}%`, width } : { right: `${100 - axis}%`, width }}
                    className={`absolute top-0 h-3 ${c.gbp > 0 ? "bg-rise" : "bg-fall"}`}
                  />
                )}
              </span>
              <span className={`text-right whitespace-nowrap [grid-area:value] ${zero ? "" : "font-semibold"}`}>{money(c.gbp, true)}</span>
            </div>
          );
        })}
        <div className={`${SPLIT_ROW} border-b-0 font-bold`}>
          <span className="[grid-area:label]">Total change</span>
          <span className="[grid-area:track]" />
          <span className="text-right whitespace-nowrap [grid-area:value]">{money(a.change_gbp, true)}</span>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-ink-2">
        {off === 0 ? <Check aria-hidden className="size-3.5 flex-none" strokeWidth={2.5} /> : <X aria-hidden className="size-3.5 flex-none text-rise" />}
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

// The checker's verdict in a few words, for the sheet's strip.
const checkedShort = (a: Answer) => (!a.checked ? "" : a.checked.by === "template" ? "Plain version" : "Checked in code");

// The checker's verdict in full, under the answer.
function Checked({ answer }: { answer: Answer }) {
  if (!answer.checked) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-ink-2">
      <ShieldCheck aria-hidden className="size-4 flex-none" />
      {CHECKED[answer.checked.by]}
    </p>
  );
}

const PILL: Record<Cause["verdict"], string> = {
  supported: "bg-select text-ink",
  ruled_out: "border border-line text-muted",
  inconclusive: "border border-dashed border-control text-ink-2",
};

function CauseItem({ cause, answer, onOpen, quiet }: { cause: Cause; answer: Answer; onOpen: Open; quiet?: boolean }) {
  const Icon = cause.verdict === "supported" ? Check : cause.verdict === "ruled_out" ? X : CircleQuestionMark;
  const cents = Math.round(cause.effect_gbp * 100);
  const showEffect = cause.verdict === "supported" && cents !== 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-rule py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex flex-none items-center gap-1 rounded-[4px] py-px pr-1.5 pl-1 text-[0.78rem] font-semibold whitespace-nowrap ${PILL[cause.verdict]}`}>
          <Icon aria-hidden className="size-3" strokeWidth={3} />
          {VERDICTS[cause.verdict]}
        </span>
        <span className={quiet ? "font-semibold text-ink-2" : "font-semibold"}>{CAUSE_NAMES[cause.id] ?? cause.id}</span>
      </div>
      {showEffect ? (
        <span className={`font-semibold whitespace-nowrap ${cents > 0 ? "text-rise" : "text-fall"}`}>{money(cause.effect_gbp, true)}</span>
      ) : (
        <span />
      )}
      <p className={`col-span-full max-w-[66ch] text-[0.94rem] ${quiet ? "text-muted" : "text-ink-2"}`}>
        {cause.detail} <Chips refs={[...cause.evidence, ...cause.memory]} answer={answer} onOpen={onOpen} />
      </p>
    </li>
  );
}

function CausesBlock({ answer: a, onOpen }: { answer: Answer; onOpen: Open }) {
  const biggest = (x: Cause, y: Cause) => Math.abs(y.effect_gbp) - Math.abs(x.effect_gbp);
  const shown = [...a.causes.filter((c) => c.verdict === "supported").sort(biggest), ...a.causes.filter((c) => c.verdict === "inconclusive")];
  const ruled = a.causes.filter((c) => c.verdict === "ruled_out");
  return (
    <div className="grid content-start gap-6">
      <Block id={`h-why-${a.utility}`} title="Why it changed">
        {shown.length ? (
          <ul className="grid border-t border-ink">{shown.map((c) => <CauseItem key={c.id} cause={c} answer={a} onOpen={onOpen} />)}</ul>
        ) : (
          <p className="text-muted">None of the causes tested explains this change.</p>
        )}
      </Block>
      {ruled.length > 0 && (
        <Block id={`h-ruled-${a.utility}`} title={`Ruled out (${ruled.length})`}>
          <ul className="grid border-t border-line">{ruled.map((c) => <CauseItem key={c.id} cause={c} answer={a} onOpen={onOpen} quiet />)}</ul>
        </Block>
      )}
    </div>
  );
}

const LEVEL: Record<Assessment["level"], [string, string]> = {
  high: ["High confidence", "bg-select text-ink"],
  medium: ["Medium confidence", "border border-line text-ink-2"],
  low: ["Low confidence", "bg-rise-wash text-rise"],
};

// Worked out in code from the investigation: how much is explained, and what isn't known.
function SureBlock({ answer: a }: { answer: Answer }) {
  const s = a.assessment;
  if (!s) return null;
  const [label, cls] = LEVEL[s.level];
  return (
    <Block id={`h-sure-${a.utility}`} title="How sure we are" aside={<span className={`rounded-[4px] px-2 py-px text-[0.82rem] font-semibold ${cls}`}>{label}</span>}>
      <ul className="grid gap-1.5">
        {s.reasons.map((r) => (
          <li key={r} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-[0.95rem] text-ink-2">
            <Check aria-hidden className="mt-1 size-3.5" strokeWidth={2.5} />
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
    <Block id={`h-how-${a.utility}`} title="The investigation, round by round">
      <ol className="grid gap-4 border-l-2 border-line pl-5">
        {a.timeline.map((t, i) => (
          <li key={i} className="relative grid max-w-[72ch] gap-0.5">
            <span aria-hidden className="absolute top-[7px] -left-[27px] size-3 rounded-full border-2 border-surface bg-primary" />
            <p className="text-sm font-bold text-ink-2">{t.actor}</p>
            <p>{t.text}</p>
            {t.detail && t.detail.length > 0 && (
              <ul className="grid gap-0.5 text-[0.92rem] text-muted">
                {t.detail.map((d, j) => (
                  <li key={j} className="grid grid-cols-[10px_minmax(0,1fr)] gap-1"><span aria-hidden>·</span>{d}</li>
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
    <Block id={`h-next-${a.utility}`} title="What to do next">
      <ul className="grid gap-2.5">
        {a.next_steps.map((s) => (
          <li key={s.action} className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5">
            <ArrowRight aria-hidden className="mt-1 size-4" strokeWidth={2.5} />
            <p>
              {s.action} <Chips refs={s.evidence} answer={a} onOpen={onOpen} />
            </p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

// Every query and note the answer rests on, each opening in the drawer.
function EvidenceList({ answer: a, mode, onOpen }: { answer: Answer; mode: Mode; onOpen: Open }) {
  const usedFor = (id: string) => {
    const causes = a.causes.filter((c) => c.evidence.includes(id) || c.memory.includes(id)).map((c) => (CAUSE_NAMES[c.id] ?? c.id).toLowerCase());
    if (!causes.length) return "";
    return ` · tests ${causes.length > 3 ? `${causes.slice(0, 3).join(", ")} and ${causes.length - 3} more` : causes.join(", ")}`;
  };
  const source = (s?: string) => (mode === "preview" ? "Preview query" : s === "local-sample" ? "Read from a SAMPLE file" : "Zetaris, read-only SQL");
  const rows = [
    ...a.evidence.map((e) => ({ id: e.id, title: e.title, meta: `${source(e.source)} · ${e.rows} row${e.rows === 1 ? "" : "s"}`, Icon: Database })),
    ...a.memory.map((m) => ({ id: m.id, title: m.text, meta: "Household note, from Meterless H-MEM", Icon: NotebookPen })),
  ];
  return (
    <Block id={`h-evidence-${a.utility}`} title="What this answer rests on" aside={<span className="text-sm text-muted">Open any line to see the query or note</span>}>
      <ul className="grid border-t border-ink">
        {rows.map(({ id, title, meta, Icon }) => {
          return (
            <li key={id} className="border-b border-rule">
              <button type="button" onClick={() => onOpen(id)} className="group grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 text-left hover:bg-surface-2">
                <span className="font-bold text-link group-hover:text-ink">{id}</span>
                <span className="grid gap-0.5">
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-muted">
                    {meta}
                    {usedFor(id)}
                  </span>
                </span>
                <Icon aria-hidden className="size-4 self-center text-muted group-hover:text-ink" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <FileText aria-hidden className="size-4 flex-none" />
        Each query&apos;s rows are fingerprinted with SHA-256, so anyone can check the data hasn&apos;t changed.
      </p>
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-line pt-5">
      <span className="font-semibold">Was this answer useful?</span>
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
