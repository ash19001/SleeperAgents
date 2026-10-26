// The orchestrator's judgement, with its reasoning off and on, on identical
// inputs. For each answer-key scenario, code builds the case file Nemotron
// Ultra sees at its first review, in three versions:
// - clean: every specialist tested its causes and agrees with the measurement;
// - contradicted: one specialist's verdict contradicts its own measurement;
// - skipped: one specialist reported without testing its causes.
// The case files come from the real investigation code with fake specialists
// (no model calls), so the review prompt is exactly what Ultra sees in the
// app. Then the real Ultra reviews each one, reasoning off and on, and code
// scores the decision:
// - problems it sends back to the right specialist;
// - clean cases it closes without needless follow-ups;
// - £ figures in its note that match the split;
// - closing notes that cover every part over £1 a supported cause explains.
// Writes eval/orchestrator_benchmark.md and eval/benchmark/*.json.
//
// Run: npm run eval:orchestrator [-- --repeat=2]
//      npm run eval:orchestrator -- --rep=2     (one more repetition; the report covers every one saved)
//      npm run eval:orchestrator -- --rescore   (rebuild the report from eval/benchmark/, no model calls)

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { PartId } from "../src/billmodel/decompose.ts";
import { diligentSpecialist, fakeReply } from "../src/agent/fakes.ts";
import { chat, deepModel, type ChatOptions, type Message } from "../src/agent/llm.ts";
import { parseReport } from "../src/agent/loop.ts";
import { Decision, investigate, type InvestigationResult } from "../src/agent/orchestrators/investigate.ts";
import { Trace } from "../src/agent/trace.ts";
import { localSource } from "../src/data/local.ts";
import type { Utility } from "../src/lib/types.ts";
import { PART_CAUSES } from "../src/memory/casefile.ts";
import { issueContract } from "../src/scout/contract.ts";

process.loadEnvFile(".env.local");

type Scenario = { id: string; utility: Utility; bill_a: string; bill_b: string };
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as { scenarios: Scenario[] };
const repeat = Number(process.argv.find((a) => a.startsWith("--repeat="))?.slice(9) ?? 1);
mkdirSync("eval/benchmark", { recursive: true });

type Specialist = (opts: ChatOptions) => { text: string; calls: [string, object][] };
type Variant = "clean" | "contradicted" | "skipped";

// One specialist gets a cause wrong: it claims the opposite of what test_cause measured.
function contradicting(name: string, cause: string): Specialist {
  return (opts) => {
    const r = diligentSpecialist(opts);
    if (opts.agent !== `specialist:${name}` || !r.text) return r;
    const report = JSON.parse(r.text);
    for (const f of report.findings) if (f.cause === cause) f.verdict = f.verdict === "supported" ? "ruled_out" : "supported";
    return { text: JSON.stringify(report), calls: [] };
  };
}
// One specialist reports without testing anything.
const skipping = (name: string): Specialist => (opts) => (opts.agent === `specialist:${name}` ? { text: '{"findings": [], "follow_up": null}', calls: [] } : diligentSpecialist(opts));

// Runs the real investigation with fake specialists and captures the prompt of Ultra's first review.
async function caseAtFirstReview(sc: Scenario, specialist: Specialist): Promise<{ messages: Message[]; inv: InvestigationResult }> {
  const contract = issueContract(
    {
      traceId: "bench",
      intent: { primary: { id: `bill.explain.${sc.utility}`, version: 1 }, parameters: {}, references: { bill_a: sc.bill_a, bill_b: sc.bill_b }, confidence: 1, alternates: [] },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [],
      modelProfile: { id: "nemotron-ultra", model: deepModel() },
      scope: { user: {}, surface: "bench", capabilities: ["bills.read", "reads.read", "tariffs.read", "water_charges.read", "weather.read", "memory.recall"] },
      registryVersion: 1,
      policyPackVersion: "whybill@1",
    },
    "bench-secret",
  );
  let messages: Message[] = [];
  let snapshot: InvestigationResult | null = null;
  let orch = 0;
  const chatFn = async (opts: ChatOptions) => {
    if (opts.agent.startsWith("orchestrator:")) {
      orch++;
      if (orch === 2) messages = structuredClone(opts.messages);
      return fakeReply(JSON.stringify(orch === 1 ? { done: false, requests: [], note: "" } : { done: true, requests: [], note: "Done." }));
    }
    const r = specialist(opts);
    return fakeReply(r.text, r.calls, orch);
  };
  const inv = await investigate(contract, sc.utility, { trace: new Trace(), data: localSource, chatFn, thinking: false });
  snapshot = inv;
  return { messages, inv: snapshot };
}

// The case file's state at the first review, read back from its history.
function stateAtReview(inv: InvestigationResult) {
  const first = inv.reviews[1];
  return { issues: first?.issues ?? [], unexplained: inv.unexplained };
}

const near = (x: number, known: number[]) => known.some((k) => Math.abs(Math.abs(x) - Math.abs(k)) <= 0.011);
// £ figures in a text, leaving out thresholds ("parts over £1").
const amounts = (text: string) =>
  [...text.matchAll(/(?<!(?:over|exceeds?|exceeding|under|below|above|than)\s)£\s?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi)].map((m) => Number(m[1].replace(/,/g, "")));
const rescore = process.argv.includes("--rescore");
const onlyRep = Number(process.argv.find((a) => a.startsWith("--rep="))?.slice(6) ?? 0);

// Build the cases.
const cases: { id: string; scenario: Scenario; variant: Variant; messages: Message[]; inv: InvestigationResult; issueSpecialists: string[]; planted: string }[] = [];
for (const sc of rescore ? [] : scenarios) {
  const clean = await caseAtFirstReview(sc, diligentSpecialist);
  cases.push({ id: `${sc.id}/clean`, scenario: sc, variant: "clean", messages: clean.messages, inv: clean.inv, issueSpecialists: [], planted: "none" });
  // Contradict the cause with the largest effect that has a definite verdict.
  const target = [...clean.inv.findings].filter((f) => f.verdict !== "inconclusive").sort((a, b) => Math.abs(b.effect_gbp) - Math.abs(a.effect_gbp))[0];
  const contra = await caseAtFirstReview(sc, contradicting(target.specialist, target.cause));
  cases.push({ id: `${sc.id}/contradicted`, scenario: sc, variant: "contradicted", messages: contra.messages, inv: contra.inv, issueSpecialists: [...new Set(stateAtReview(contra.inv).issues.map((i) => i.specialist))], planted: `${target.specialist} claims ${target.cause} the opposite of its measurement` });
  const skip = await caseAtFirstReview(sc, skipping("billing"));
  cases.push({ id: `${sc.id}/skipped`, scenario: sc, variant: "skipped", messages: skip.messages, inv: skip.inv, issueSpecialists: [...new Set(stateAtReview(skip.inv).issues.map((i) => i.specialist))], planted: "billing reports without testing C3, C4, C5" });
}
if (!rescore) console.log(`Built ${cases.length} case files (${cases.filter((c) => c.issueSpecialists.length).length} with planted problems).`);
const show = process.argv.find((a) => a.startsWith("--show="))?.slice(7);
if (show) {
  console.log(cases.find((c) => c.id === show)?.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n"));
  process.exit(0);
}

interface Outcome {
  id: string;
  variant: Variant;
  thinking: boolean;
  rep: number;
  valid: boolean;
  done: boolean;
  asked: string[];
  issueSpecialists: string[];
  recall: number | null;
  extraAsks: number;
  noteAmounts: number;
  noteRight: number;
  closingParts: number;
  closingCovered: number;
  ms: number;
  tokens: number;
  reasoningChars: number;
  memories: number; // Nightshift memories injected into the prompt (should be 0)
  note: string;
  reasoning: string;
}

const outcomes: Outcome[] = [];
// What the report needs to know about each case.
const caseInfo = new Map<string, { planted: string; issueSpecialists: string[]; unexplained: string[] }>(cases.map((c) => [c.id, { planted: c.planted, issueSpecialists: c.issueSpecialists, unexplained: c.inv.unexplained }]));
// Every decision saved so far, rescored.
function loadSaved() {
  outcomes.length = 0;
  for (const f of readdirSync("eval/benchmark").sort()) {
    const j = JSON.parse(readFileSync(`eval/benchmark/${f}`, "utf8")) as Outcome & { planted: string; unexplained: string[]; prompt: string };
    const found = amounts(j.note);
    outcomes.push({ ...j, noteAmounts: found.length, noteRight: found.filter((x) => near(x, amounts(j.prompt))).length });
    caseInfo.set(j.id, { planted: j.planted, issueSpecialists: j.issueSpecialists, unexplained: j.unexplained });
  }
}
if (rescore) loadSaved();
for (const rep of rescore ? [] : onlyRep ? [onlyRep] : Array.from({ length: repeat }, (_, i) => i + 1)) {
  for (const [i, c] of cases.entries()) {
    for (const thinking of (i + rep) % 2 === 0 ? [false, true] : [true, false]) {
      const trace = new Trace();
      const started = Date.now();
      let text = "";
      let reasoning = "";
      try {
        const res = await chat({ agent: `orchestrator:${c.scenario.utility}`, label: "Benchmark review", model: deepModel(), messages: c.messages, maxTokens: thinking ? 8000 : 1200, thinking, trace });
        text = res.text;
        reasoning = res.reasoning;
      } catch (err) {
        text = "";
        reasoning = `failed: ${(err as Error).message.slice(0, 200)}`;
      }
      const ms = Date.now() - started;
      const step = trace.steps.at(-1);
      const parsed = parseReport(text, Decision);
      const team = new Set(c.inv.findings.map((f) => f.specialist as string));
      const asked = parsed.ok ? [...new Set(parsed.value.requests.map((r) => r.specialist.toLowerCase().trim()).filter((s) => team.has(s)))] : [];
      const note = parsed.ok ? parsed.value.note : "";
      // A figure is right if it's in the case file Ultra was given.
      const known = amounts(String(c.messages[1]?.content ?? ""));
      const found = amounts(note);
      const supported = new Set(c.inv.findings.filter((f) => f.verdict === "supported").map((f) => f.cause));
      const material = (Object.keys(c.inv.parts) as PartId[]).filter((p) => Math.abs(c.inv.parts[p]) >= 1 && PART_CAUSES[p].some((x) => supported.has(x)));
      const done = parsed.ok && parsed.value.done && !asked.length;
      const o: Outcome = {
        id: c.id,
        variant: c.variant,
        thinking,
        rep,
        valid: parsed.ok,
        done,
        asked,
        issueSpecialists: c.issueSpecialists,
        recall: c.issueSpecialists.length ? c.issueSpecialists.filter((s) => asked.includes(s)).length / c.issueSpecialists.length : null,
        extraAsks: asked.filter((s) => !c.issueSpecialists.includes(s)).length,
        noteAmounts: found.length,
        noteRight: found.filter((x) => near(x, known)).length,
        closingParts: done ? material.length : 0,
        closingCovered: done ? material.filter((p) => near(c.inv.parts[p], found)).length : 0,
        ms,
        tokens: Number(step?.detail?.tokens ?? 0),
        reasoningChars: reasoning.startsWith("failed") ? 0 : reasoning.length,
        memories: Number(step?.detail?.memories ?? 0),
        note,
        reasoning: reasoning.slice(0, 3000),
      };
      outcomes.push(o);
      writeFileSync(`eval/benchmark/${c.id.replace("/", "-")}-${thinking ? "on" : "off"}-${rep}.json`, `${JSON.stringify({ ...o, planted: c.planted, unexplained: c.inv.unexplained, prompt: c.messages[1]?.content }, null, 2)}\n`);
      console.log(`${c.id.padEnd(34)} ${thinking ? "on " : "off"} ${o.memories ? `MEMORIES ${o.memories} ` : ""}${o.valid ? "" : "INVALID "}${o.done ? "closed" : `asked ${o.asked.join(",") || "-"}`}  problems ${c.issueSpecialists.join(",") || "-"}  £ ${o.noteRight}/${o.noteAmounts}  ${(ms / 1000).toFixed(1)} s`);
    }
  }
}

if (onlyRep) loadSaved();
const reps = new Set(outcomes.map((o) => o.rep)).size;

// Scores per condition.
const of = (t: boolean) => outcomes.filter((o) => o.thinking === t);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% (${a}/${b})` : "–");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const score = (t: boolean) => {
  const o = of(t);
  const withProblems = o.filter((x) => x.issueSpecialists.length);
  const clean = o.filter((x) => !x.issueSpecialists.length && !caseInfo.get(x.id)!.unexplained.length);
  const problems = withProblems.reduce((n, x) => n + x.issueSpecialists.length, 0);
  const caught = withProblems.reduce((n, x) => n + x.issueSpecialists.filter((s) => x.asked.includes(s)).length, 0);
  return {
    valid: pct(o.filter((x) => x.valid).length, o.length),
    caught: pct(caught, problems),
    allCaught: pct(withProblems.filter((x) => x.recall === 1).length, withProblems.length),
    closedOnProblems: pct(withProblems.filter((x) => x.done).length, withProblems.length),
    cleanClosed: pct(clean.filter((x) => x.done).length, clean.length),
    extra: String(o.reduce((n, x) => n + x.extraAsks, 0)),
    pounds: pct(o.reduce((n, x) => n + x.noteRight, 0), o.reduce((n, x) => n + x.noteAmounts, 0)),
    covered: pct(o.reduce((n, x) => n + x.closingCovered, 0), o.reduce((n, x) => n + x.closingParts, 0)),
    memories: String(o.reduce((n, x) => n + x.memories, 0)),
    time: `${(median(o.map((x) => x.ms)) / 1000).toFixed(1)} s`,
    tokens: String(median(o.map((x) => x.tokens))),
  };
};
const off = score(false);
const on = score(true);

// Paired: the same case and repetition reviewed both ways. Exact McNemar test
// on the cases where only one condition sent every problem back.
const pairs = new Map<string, { off?: boolean; on?: boolean }>();
for (const o of outcomes.filter((x) => x.issueSpecialists.length)) {
  const p = pairs.get(`${o.id}#${o.rep}`) ?? {};
  p[o.thinking ? "on" : "off"] = o.recall === 1;
  pairs.set(`${o.id}#${o.rep}`, p);
}
const onlyOn = [...pairs.values()].filter((p) => p.on && !p.off).length;
const onlyOff = [...pairs.values()].filter((p) => p.off && !p.on).length;
const choose = (n: number, k: number) => Array.from({ length: k }, (_, i) => (n - k + i + 1) / (i + 1)).reduce((a, b) => a * b, 1);
const mcnemarP = Math.min(1, 2 * Array.from({ length: Math.min(onlyOn, onlyOff) + 1 }, (_, i) => choose(onlyOn + onlyOff, i) / 2 ** (onlyOn + onlyOff)).reduce((a, b) => a + b, 0));
const row = (label: string, k: keyof ReturnType<typeof score>) => `| ${label} | ${off[k]} | ${on[k]} |`;
const md = [
  "# The orchestrator's judgement: reasoning off against on",
  "",
  `Run 26 Oct 2026. Nemotron 3 Ultra through Meterless Nightshift, a fresh scope per call so no earlier answers were injected (checked per call below). ${caseInfo.size} case files built in code from the ${scenarios.length} answer-key scenarios, each in three versions (clean; one specialist contradicting its own measurement; one specialist skipping its tests), exactly as the orchestrator sees them at its first review. Each reviewed with reasoning off and on${reps > 1 ? `, ${reps} times` : ""}; the order alternated. Scored in code. Script: \`scripts/benchmark_orchestrator.ts\`; every decision in \`eval/benchmark/\`.`,
  "",
  "| Measure | Reasoning off | Reasoning on |",
  "| --- | --- | --- |",
  row("Problems sent back to the right specialist", "caught"),
  row("Cases with problems where it sent every one back", "allCaught"),
  row("Cases with problems it closed anyway", "closedOnProblems"),
  row("Clean cases closed without follow-ups", "cleanClosed"),
  row("Follow-ups to specialists with no problem", "extra"),
  row("£ figures in its notes that are in the case file", "pounds"),
  row("Closing notes naming each part over £1 by its £ figure", "covered"),
  row("Replies in the required format", "valid"),
  row("Time per review (median)", "time"),
  row("Output per review (median tokens, reasoning included)", "tokens"),
  row("Nightshift memories injected into prompts", "memories"),
  "",
  `Paired comparison of the ${pairs.size} reviews of cases with problems: only reasoning on sent every problem back in ${onlyOn}, only reasoning off in ${onlyOff} (exact McNemar test, p = ${mcnemarP < 0.001 ? mcnemarP.toExponential(1) : mcnemarP.toFixed(3)}).`,
  "",
  "## Every case",
  "",
  "| Case | Planted problem | Reasoning off | Reasoning on |",
  "| --- | --- | --- | --- |",
  ...[...caseInfo].sort(([a], [b]) => scenarios.findIndex((s) => a.startsWith(`${s.id}/`)) - scenarios.findIndex((s) => b.startsWith(`${s.id}/`))).map(([id, c]) => {
    const show = (t: boolean) =>
      of(t)
        .filter((o) => o.id === id)
        .map((o) => (!o.valid ? "invalid reply" : o.done ? "closed" : `asked ${o.asked.join(", ")}`))
        .join("; ");
    return `| ${id} | ${c.issueSpecialists.length ? `${c.planted} (${c.issueSpecialists.join(", ")})` : c.unexplained.length ? "none; a part is open" : "none"} | ${show(false)} | ${show(true)} |`;
  }),
  "",
];
writeFileSync("eval/orchestrator_benchmark.md", md.join("\n"));
console.log(`\n${md.slice(4, 16).join("\n")}`);
