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
  label?: string;
  route: string;
  model: string | null;
  ms: number;
}

export interface Note {
  id: string;
  text: string;
  created: string;
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
}

export type AskResult =
  | { kind: "answer"; answer: Answer }
  | { kind: "clarify"; message: string }
  | { kind: "no_preview"; bill_id: string; utility: Utility };
