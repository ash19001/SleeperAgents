// One orchestrator per utility. Each checks its contract at the boundary
// (signature, expiry, intent and the capabilities it needs) and refuses
// anything else. Placeholders for now: they verify and report back; the real
// investigation (specialists, review rounds) replaces run() in Phase 7.

import type { ExecutionContract } from "../../scout/types.ts";
import type { Scout } from "../../scout/index.ts";
import type { Utility } from "../../lib/types.ts";
import type { Trace } from "../trace.ts";

export interface OrchestratorResult {
  utility: Utility;
  status: "placeholder" | "refused";
  contractId: string;
  bill_a?: string;
  bill_b?: string;
  model?: string;
  reason?: string;
  ms: number;
}

interface Orchestrator {
  utility: Utility;
  intent: string;
  needs: string[]; // capabilities it can't work without
}

const ORCHESTRATORS: Record<string, Orchestrator> = {
  "bill.explain.electricity": { utility: "electricity", intent: "bill.explain.electricity", needs: ["bills.read", "reads.read", "tariffs.read", "weather.read"] },
  "bill.explain.gas": { utility: "gas", intent: "bill.explain.gas", needs: ["bills.read", "reads.read", "tariffs.read", "weather.read"] },
  "bill.explain.water": { utility: "water", intent: "bill.explain.water", needs: ["bills.read", "reads.read", "water_charges.read", "weather.read"] },
};

export async function runOrchestrator(contract: ExecutionContract, ctx: { scout: Scout; trace: Trace }): Promise<OrchestratorResult> {
  const started = Date.now();
  const orchestrator = ORCHESTRATORS[contract?.intent?.primary?.id];
  const utility = orchestrator?.utility ?? ("unknown" as Utility);
  const engine = `orchestrator:${utility}`;
  const finish = (r: Omit<OrchestratorResult, "ms">): OrchestratorResult => {
    const result = { ...r, ms: Date.now() - started };
    ctx.trace.add({
      step: "orchestrator",
      agent: engine,
      label: result.status === "refused" ? `Refused the contract (${result.reason})` : "Checked the contract (placeholder orchestrator)",
      route: "code",
      model: null,
      ms: result.ms,
      detail: { contractId: result.contractId, status: result.status },
    });
    return result;
  };

  if (!orchestrator) return finish({ utility, status: "refused", contractId: contract?.contractId ?? "none", reason: "no-orchestrator" });
  const check = ctx.scout.verify(contract, { engine, require: { intent: orchestrator.intent, capabilities: orchestrator.needs } });
  if (!check.ok) return finish({ utility, status: "refused", contractId: contract.contractId, reason: check.reason });

  const refs = contract.intent.references as { bill_a?: string; bill_b?: string };
  return finish({ utility, status: "placeholder", contractId: contract.contractId, bill_a: refs.bill_a, bill_b: refs.bill_b, model: contract.modelProfile.model });
}
