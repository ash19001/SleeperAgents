// Shapes from Meterless's Scout spec: vendor/meterless/scout-intent/AGENTS.md
// and its docs/. Our implementation keeps these names so their eval harness
// can load it.

export type RiskClass = "low" | "medium" | "high";
export type RiskLevel = RiskClass | "block";
export type Band = "high" | "medium" | "low" | "reject";

export interface Intent {
  id: string; // "bill.explain.gas"; category.name
  category: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  capabilities: string[]; // abstract verbs, resolved to tools by the capability graph
  riskClass: RiskClass;
  surfaces: string[];
  roles: string[]; // "*" for anyone
  examples: string[];
  version: number;
}

export interface IntentRegistry {
  version: number;
  note?: string;
  intents: Intent[];
}

export interface UserRef {
  id?: string;
  role?: string;
}

export interface IntentCandidate {
  intent: string;
  score: number;
  span?: [number, number]; // where in the prompt the match came from
}

export interface RiskFlag {
  layer: "injection" | "policy" | "scope" | "sensitivity" | "rate";
  kind: string;
  outcome: "warn" | "block";
  evidence?: string; // metadata only; injection payloads are not logged in full
}

export interface Redaction {
  kind: string;
  span: [number, number];
}

export interface ApprovalRecord {
  kind: "user-confirm" | "operator-review";
  at: string;
  by?: string;
  decision?: string;
  confirmation?: string;
}

export interface GuardResult {
  level: RiskLevel;
  flags: RiskFlag[];
  redactions: Redaction[];
  reason?: string;
}

export interface ToolStep {
  capability: string;
  tool: string;
  readOnly: boolean;
  input: Record<string, unknown>;
}

export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  context: number;
  latencyP95Ms: number;
  capabilities: string[]; // "function_calling", "json", "reasoning"
  dataClasses: string[]; // data classes this profile is cleared for
  tasks: string[]; // jobs this profile is suited to, e.g. "orchestrate"
}

export interface ModelProfileRef {
  id: string;
  model: string;
}

export interface ExecutionContract {
  contractId: string; // ULID, monotonic
  parentId?: string;
  traceId: string;
  intent: {
    primary: { id: string; version: number };
    parameters: Record<string, unknown>;
    references: Record<string, unknown>;
    confidence: number;
    alternates: IntentCandidate[];
  };
  risk: {
    level: RiskClass;
    flags: RiskFlag[];
    redactions: Redaction[];
    approvals: ApprovalRecord[];
  };
  toolPlan: ToolStep[];
  modelProfile: ModelProfileRef;
  scope: {
    user: UserRef;
    surface: string;
    capabilities: string[]; // the exact set downstream engines may use
    deadline?: string;
    budget?: { tokensMax?: number; costMaxUSD?: number };
  };
  issuedAt: string;
  expiresAt: string;
  registryVersion: number;
  policyPackVersion: string;
  signature: string; // HMAC_SHA256(secret, canonical_json(contract without signature))
  signedBy: "scout";
}

export interface Clarification {
  trigger: "low-band" | "tie" | "params" | "high-risk";
  question: string;
  options: { label: string; intent: string }[]; // at most 4
}
