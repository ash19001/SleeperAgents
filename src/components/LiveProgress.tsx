"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { MODEL_NAMES } from "@/lib/labels";
import type { TraceStep } from "@/lib/types";

// While a live answer is being worked out: one row per agent, with what it
// last finished, as the steps stream in from /api/ask.

const UTIL: Record<string, string> = { electricity: "Electricity", gas: "Gas", water: "Water" };

function agentName(agent: string): string {
  const [kind, which] = agent.split(":");
  if (kind === "orchestrator") return `${UTIL[which] ?? which} orchestrator`;
  if (kind === "specialist") return `${which[0].toUpperCase()}${which.slice(1)} specialist`;
  return { intake: "Intake", scout: "Scout", writer: "Writer", combiner: "Combiner", checker: "Checker" }[kind] ?? agent;
}

// Mounted fresh for each question, so its clock starts at zero.
export function LiveProgress({ steps }: { steps: TraceStep[] }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const agents = new Map<string, { last: TraceStep; at: number; count: number; model: string | null }>();
  steps.forEach((s, i) => {
    const key = s.agent ?? s.step;
    const prev = agents.get(key);
    agents.set(key, { last: s, at: i, count: (prev?.count ?? 0) + 1, model: s.model ?? prev?.model ?? null });
  });
  // An agent is done once the next stage has picked up its work.
  const after = (i: number, test: (s: TraceStep) => boolean) => steps.slice(i + 1).some(test);
  const isOrch = (s: TraceStep) => s.agent?.startsWith("orchestrator:") ?? false;
  const done = (agent: string, last: TraceStep, at: number) => {
    const label = last.label ?? "";
    if (agent === "intake" || agent === "scout") return after(at, isOrch);
    if (agent.startsWith("specialist:")) return after(at, (s) => isOrch(s) && /^(Review|Final|Closed|Markovian|Investigation)/.test(s.label ?? ""));
    if (agent.startsWith("orchestrator:")) return /^(Investigation done|Closed the case|Markovian ran)/.test(label);
    if (agent === "writer" || agent === "combiner") return after(at, (s) => s.agent === "checker");
    return /^(Checked the|Used the template)/.test(label);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <p className="eyebrow">Live investigation · {seconds} s</p>
        <h2 id="answer-title" className="headline text-[1.35rem] font-bold">The agents are working on it</h2>
        <p className="text-muted">Each row is an agent. Specialists test their causes in parallel; the orchestrator reviews them; the writer and checker finish the answer. This usually takes under a minute.</p>
      </div>
      {agents.size > 0 && (
        <ul className="grid gap-2" aria-live="polite">
          {[...agents].map(([agent, { last, at, count, model }]) => (
            <li key={agent} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-lg border border-line px-3 py-2">
              {done(agent, last, at) ? <Check aria-hidden className="mt-0.5 size-4 text-accent" /> : <LoaderCircle aria-hidden className="mt-0.5 size-4 animate-spin text-ink-2 motion-reduce:animate-none" />}
              <div className="min-w-0">
                <p className="font-semibold">{agentName(agent)}</p>
                <p className="truncate text-[0.9rem] text-ink-2">{last.label ?? last.step}</p>
              </div>
              <span className="text-right text-[0.8rem] whitespace-nowrap text-muted">
                {count} step{count === 1 ? "" : "s"}
                {model ? <><br />{(MODEL_NAMES[model] ?? model).replace(/^Nemotron /, "")}</> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
