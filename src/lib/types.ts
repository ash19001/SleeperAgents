// Shapes shared by the server routes and the page. `Answer` is the answer
// contract from PLAN.md, plus the fields the page needs to show it.

export type Utility = "electricity" | "gas" | "water";
export type Mode = "preview" | "replay" | "live";
export type Verdict = "supported" | "ruled_out" | "inconclusive";

export interface Household {
  postcode_district: string;
  town: string;
  latitude: number;
  longitude: number;
  price_region: { code: string; name: string };
  water_company: string | null;
}

export interface Bill {
  utility: Utility;
  bill_id: string;
  label: string;
  months: number[];
  period_start: string;
  period_end: string;
  days: number;
  units_billed: number;
  unit: string;
  read_type: "actual" | "estimated";
  adjustments_gbp: number;
  total_gbp: number;
}

export interface Evidence {
  id: string;
  title: string;
  source?: "zetaris" | "local-sample"; // local-sample: read from a SAMPLE file until the data is in Zetaris
  sql: string;
  rows: number;
  sha256: string;
  at: string;
}

export interface Fact {
  id: string;
  value: string;
  evidence: string[];
}

export interface Part {
  id: string;
  gbp: number;
  evidence: string[];
}

export interface Cause {
  id: string;
  verdict: Verdict;
  effect_gbp: number;
  evidence: string[];
  memory: string[];
  detail: string;
}

export interface NextStep {
  cause?: string;
  action: string;
  evidence: string[];
}

export interface TraceStep {
  step: string;
  agent?: string;
  label?: string;
  route: string;
  model: string | null;
  receipt?: string | null;
  ms: number;
  detail?: Record<string, unknown>;
}

export interface Note {
  id: string;
  text: string;
  created: string;
}

// One step in how the agents worked a case out, for the page.
export interface TimelineEntry {
  actor: string; // "Orchestrator (Nemotron Ultra)", "Specialists (Nemotron Lightning)", "Code check", …
  text: string;
  detail?: string[];
}

// How sure an answer is and what it can't tell you, worked out in code.
export interface Assessment {
  level: "high" | "medium" | "low";
  explained_pct: number; // share of the bill's movement that supported causes explain
  reasons: string[];
  limitations: string[];
}

export interface Answer {
  question: string;
  utility: Utility;
  bill_a: string;
  bill_b: string;
  total_a?: number;
  total_b?: number;
  change_gbp: number;
  components: Part[];
  causes: Cause[];
  facts: Fact[];
  answer_markdown: string;
  next_steps: NextStep[];
  evidence: Evidence[];
  memory: Note[];
  trace: TraceStep[];
  // Live answers: who wrote the text that passed the checker, how sure the
  // answer is, and how the agents worked it out.
  checked?: { by: "writer" | "rewrite" | "template"; problems: string[][] };
  assessment?: Assessment;
  timeline?: TimelineEntry[];
}

// One utility's part of a triaged question: its bills, its signed Scout
// contract, and what its orchestrator did with it.
export interface TriageRequest {
  utility: Utility;
  period: string | null;
  direction: "up" | "down" | "change";
  bill_a: string;
  bill_b: string;
  contract: {
    contractId: string;
    intent: string;
    confidence: number;
    band: string;
    risk: string;
    capabilities: string[];
    model: string;
    expiresAt: string;
    signature: string;
  };
  orchestrator: { status: "placeholder" | "refused" | "done" | "error"; reason?: string; model?: string; ms: number };
}

export interface ClarifyOption {
  label: string;
  utility?: Utility;
}

export type AskResult =
  | { kind: "answer"; answer: Answer }
  | {
      kind: "answers"; // two or more utilities: the summary, then one answer each
      question: string;
      answers: Answer[];
      summary_markdown: string;
      summary_facts: Fact[];
      notes: string[]; // utilities that couldn't be answered, and why
      trace: TraceStep[];
    }
  | { kind: "clarify"; message: string; options?: ClarifyOption[]; trace?: TraceStep[] }
  | { kind: "no_preview"; bill_id: string; utility: Utility }
  | { kind: "blocked"; reason: string; trace?: TraceStep[] }
  | { kind: "general"; message: string; trace?: TraceStep[] }
  | {
      kind: "triage";
      question: string;
      source: "intake" | "keywords"; // who read the question: the intake agent, or Scout's keywords as fallback
      requests: TriageRequest[];
      redactions: string[];
      notes: string[];
      trace: TraceStep[];
    };
