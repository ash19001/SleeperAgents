// The case file for one investigation, kept in Meterless World Model. The
// case, its two bills and the causes are entities with stable ids (each
// cause links to the case with tested_in: World Model closes an older edge
// when the same source gets a new edge of the same type); the £
// split, every specialist finding and every orchestrator review are facts
// with provenance (which agent, which round). A later finding on a cause
// supersedes the earlier one (most-recent-wins) and World Model keeps both
// in its facts and audit. Orchestrators read promptContext(), our version of
// the guide's buildPromptContext (the reference implementation has none).

import { WorldModel, type AuditEntry, type Entity, type Fact } from "#meterless/world-model";
import type { CauseId } from "../billmodel/causes.ts";
import type { PartId, Split } from "../billmodel/decompose.ts";
import type { UBill } from "../data/types.ts";
import { CAUSE_NAMES, PART_NAMES } from "../lib/labels.ts";
import type { Utility } from "../lib/types.ts";
import type { Finding } from "../agent/specialists.ts";

// Which causes can explain each £ part of the split.
export const PART_CAUSES: Record<PartId, CauseId[]> = {
  period: ["C3"],
  weather: ["C6"],
  usage_other: ["C7", "C8", "C9"],
  unit_price: ["C1"],
  standing: ["C2"],
  estimate: ["C4"],
  oneoff: ["C5"],
};

export interface CaseFinding extends Finding {
  round: number;
}

export interface Review {
  round: number;
  done: boolean;
  requests: { specialist: string; task: string; by?: "agent" | "code" }[]; // code: sent back by the issue check
  note: string;
  by: "agent" | "code"; // code: Ultra's reply was unusable, so code decided
  issues?: Issue[]; // issues code had found when this review was made
  reasoning?: string; // what Ultra thought first, when its reasoning is on
}

// A problem code found in a specialist's work, for the orchestrator to send back.
export interface Issue {
  specialist: string;
  cause: CauseId;
  kind: "overruled" | "untested";
  text: string;
}

const VERDICT_WORDS: Record<string, string> = { supported: "supported", ruled_out: "ruled out", inconclusive: "inconclusive" };

// Parts under £1 don't need explaining.
const MATERIAL_GBP = 1;
const now = () => new Date().toISOString();
const gbp = (x: number) => `${x < 0 ? "−" : "+"}£${Math.abs(x).toFixed(2)}`;

export class CaseFile {
  readonly id: string;
  readonly wm: WorldModel;
  readonly runId: string;
  readonly utility: Utility;
  private linked = new Set<string>();

  private constructor(caseId: string, utility: Utility) {
    this.runId = caseId;
    this.utility = utility;
    this.id = `case:whybill:${caseId}`;
    this.wm = new WorldModel({ storage: "memory", namespace: `case-${caseId}` });
  }

  // causes: the ones this utility's team checks.
  static async open(opts: { caseId: string; utility: Utility; causes: CauseId[]; a: UBill; b: UBill; split: Split; evidence: string[] }): Promise<CaseFile> {
    const file = new CaseFile(opts.caseId, opts.utility);
    const source = file.source("pipeline", "orchestrator");
    await file.wm.upsertEntity({ type: "case", externalKey: { system: "whybill", id: opts.caseId }, attrs: { utility: opts.utility, causes: opts.causes }, source });
    for (const [role, bill] of [["compares_from", opts.a], ["compares_to", opts.b]] as const) {
      const entity = await file.wm.upsertEntity({
        type: "bill",
        externalKey: { system: bill.supplier, id: bill.bill_id },
        attrs: { label: bill.label, period_start: bill.period_start, period_end: bill.period_end, days: bill.days, total_gbp: bill.total_gbp, read_type: bill.read_type },
        source: file.source("file", bill.supplier),
      });
      await file.wm.relate({ from: file.id, type: role, to: entity.id, source });
    }
    const { change, parts, fit } = opts.split;
    await file.wm.assertFact({ about: file.id, predicate: "split", value: { change, parts, fit_trusted: fit?.reliable ?? false, evidence: opts.evidence }, confidence: 1, source: file.source("pipeline", "billmodel") });
    return file;
  }

  private source(kind: string, by: string) {
    return { kind, by, at: now(), runId: this.runId };
  }

  private entity(id: string): Entity | undefined {
    return this.wm.view("graph").entity(id);
  }

  async recordFinding(finding: Finding, round: number): Promise<void> {
    const cause = await this.wm.upsertEntity({ type: "cause", externalKey: { system: "whybill", id: finding.cause }, name: CAUSE_NAMES[finding.cause], source: this.source("agent", `specialist:${finding.specialist}`) });
    if (!this.linked.has(cause.id)) {
      await this.wm.relate({ from: cause.id, type: "tested_in", to: this.id, source: this.source("pipeline", "orchestrator") });
      this.linked.add(cause.id);
    }
    const value: CaseFinding = { ...finding, round };
    await this.wm.assertFact({ about: cause.id, predicate: "finding", value, confidence: 1, source: this.source("agent", `specialist:${finding.specialist}`) });
  }

  // A specialist's question for another specialist or the orchestrator.
  async recordFollowUp(specialist: string, text: string | null, round: number): Promise<void> {
    await this.wm.assertFact({ about: this.id, predicate: `follow_up.${specialist}`, value: { text, round }, source: this.source("agent", `specialist:${specialist}`) });
  }

  async recordReview(review: Review, model: string): Promise<void> {
    await this.wm.assertFact({ about: this.id, predicate: "review", value: review, source: this.source(review.by === "agent" ? "agent" : "pipeline", review.by === "agent" ? `orchestrator:${this.utility} (${model})` : "orchestrator") });
  }

  split(): { change: number; parts: Record<PartId, number>; fit_trusted: boolean; evidence: string[] } {
    return this.entity(this.id)!.attrs.split as ReturnType<CaseFile["split"]>;
  }

  // The latest finding for each cause tested so far.
  findings(): CaseFinding[] {
    return this.wm
      .view("graph")
      .incoming(this.id, { via: "tested_in" })
      .map((e) => e.attrs.finding as CaseFinding)
      .filter(Boolean)
      .sort((x, y) => x.cause.localeCompare(y.cause));
  }

  // Every finding ever written for a cause, oldest first.
  history(cause: CauseId): Fact[] {
    return this.wm.view("facts").about(`cause:whybill:${cause}`).filter((f) => f.predicate === "finding");
  }

  reviews(): Review[] {
    return this.wm.view("facts").about(this.id).filter((f) => f.predicate === "review").map((f) => f.value as Review);
  }

  // Findings where the agent's own verdict disagreed with its measurement, or
  // where it never tested a cause and code had to.
  issues(): Issue[] {
    return this.findings().flatMap((f): Issue[] => {
      const name = `${f.cause} (${CAUSE_NAMES[f.cause]})`;
      if (f.overridden && f.claimed) {
        return [{ specialist: f.specialist, cause: f.cause, kind: "overruled", text: `${f.specialist} said ${name} was ${VERDICT_WORDS[f.claimed]}, but its measurement says ${VERDICT_WORDS[f.verdict]} (${f.value ?? "no value"} against ${f.threshold})` }];
      }
      if (f.measured_by === "code") return [{ specialist: f.specialist, cause: f.cause, kind: "untested", text: `${f.specialist} didn't test ${name} itself; code measured it as ${VERDICT_WORDS[f.verdict]}` }];
      return [];
    });
  }

  openFollowUps(): { specialist: string; text: string; round: number }[] {
    const attrs = this.entity(this.id)!.attrs;
    return Object.entries(attrs)
      .filter(([k]) => k.startsWith("follow_up."))
      .map(([k, v]) => ({ specialist: k.slice("follow_up.".length), ...(v as { text: string | null; round: number }) }))
      .filter((f): f is { specialist: string; text: string; round: number } => Boolean(f.text));
  }

  // Material £ parts with no supported cause, split into those still open
  // (a cause untested or inconclusive) and those whose causes were all
  // checked and ruled out (the change is under every threshold).
  private gaps(): { open: PartId[]; belowThreshold: PartId[] } {
    const byCause = new Map(this.findings().map((f) => [f.cause, f]));
    const ours = this.entity(this.id)!.attrs.causes as CauseId[];
    const { parts } = this.split();
    const unsupported = (Object.keys(parts) as PartId[]).filter((p) => Math.abs(parts[p]) >= MATERIAL_GBP && !PART_CAUSES[p].some((c) => byCause.get(c)?.verdict === "supported"));
    const isOpen = (p: PartId) => PART_CAUSES[p].some((c) => ours.includes(c) && byCause.get(c)?.verdict !== "ruled_out");
    return { open: unsupported.filter(isOpen), belowThreshold: unsupported.filter((p) => !isOpen(p)) };
  }

  unexplained(): PartId[] {
    return this.gaps().open;
  }

  audit(): readonly AuditEntry[] {
    return this.wm.audit();
  }

  // The case as text for the orchestrator's prompt.
  promptContext(): string {
    const graph = this.wm.view("graph");
    const [from] = graph.neighborsOf(this.id, { via: "compares_from" });
    const [to] = graph.neighborsOf(this.id, { via: "compares_to" });
    const bill = (e: Entity) => `${e.attrs.label} (${e.attrs.period_start} to ${e.attrs.period_end}, ${e.attrs.days} days, £${Number(e.attrs.total_gbp).toFixed(2)}, ${e.attrs.read_type} reading)`;
    const { change, parts, fit_trusted, evidence } = this.split();
    const findings = this.findings();
    const lines = [
      `CASE FILE: ${this.utility} bill`,
      `Earlier bill: ${from ? bill(from) : "?"}`,
      `Later bill: ${to ? bill(to) : "?"}`,
      `Change: ${gbp(change)} [${evidence.join(",")}]`,
      `Split of the change (exact, adds up to the change):`,
      ...(Object.keys(parts) as PartId[]).map((p) => `- ${PART_NAMES[p]}: ${gbp(parts[p])} (causes ${PART_CAUSES[p].join(", ")})`),
      fit_trusted ? "Weather fit: trusted." : "Weather fit: not trusted (too few bills, or the household's pattern changed), so the weather part is 0 and any weather effect sits in use beyond the weather.",
      "",
      findings.length ? "Findings (latest per cause; verdicts and £ are measured in code):" : "Findings: none yet.",
      ...findings.map(
        (f) =>
          `- ${f.cause} ${CAUSE_NAMES[f.cause]}: ${f.verdict}, effect ${gbp(f.effect_gbp)}, measured ${f.value ?? "n/a"} against ${f.threshold} [${[...f.evidence, ...f.memory].join(",")}] (${f.specialist}, round ${f.round}${f.overridden ? ", agent disagreed and was overruled" : ""})${f.reasoning ? ` "${f.reasoning}"` : ""}`,
      ),
    ];
    const open = this.openFollowUps();
    if (open.length) lines.push("", "Open questions from specialists:", ...open.map((f) => `- ${f.specialist} (round ${f.round}): ${f.text}`));
    const issues = this.issues();
    if (issues.length) lines.push("", "Issues found in code (send each back to its specialist, unless it has had its follow-up):", ...issues.map((i) => `- ${i.text}.`));
    const asked = this.reviews().filter((v) => v.round > 1 && v.requests.length);
    if (asked.length) lines.push("", "Follow-ups already asked:", ...asked.flatMap((v) => v.requests.map((q) => `- ${q.specialist} (review ${v.round}): ${q.task}`)));
    if (findings.length) {
      const { open: gaps, belowThreshold } = this.gaps();
      const names = (ps: PartId[]) => ps.map((p) => PART_NAMES[p]).join(", ");
      lines.push("", gaps.length ? `Parts over £1 still open (a cause untested or inconclusive): ${names(gaps)}.` : "No part over £1 is still open.");
      if (belowThreshold.length) lines.push(`Parts over £1 whose causes were all checked and ruled out (accounted for: too small a change to count as a cause): ${names(belowThreshold)}.`);
    }
    return lines.join("\n");
  }
}
