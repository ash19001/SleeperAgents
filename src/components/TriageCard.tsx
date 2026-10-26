import { Check, ShieldCheck, X } from "lucide-react";
import { Sheet } from "./Sheet";
import { TraceList } from "./TraceList";
import { fmtDateTime } from "@/lib/format";
import { MODEL_NAMES, UTILITIES } from "@/lib/labels";
import type { AskResult, Bill, TriageRequest } from "@/lib/types";

type Triage = Extract<AskResult, { kind: "triage" }>;

// Shown when no utility could be investigated: what triage decided, the
// signed contract per utility, and why each orchestrator stopped.
export function TriageCard({ result, bills }: { result: Triage; bills: Bill[] }) {
  const label = (id: string) => bills.find((b) => b.bill_id === id)?.label ?? id;
  return (
    <Sheet title={result.question} meta="What triage decided · Live">
      <header className="grid gap-1.5">
        <p className="text-ink-2">
          {result.source === "intake"
            ? `Read by the intake agent (Nemotron 3.5 Lightning) and checked by Scout. ${result.requests.length === 1 ? "One utility" : `${result.requests.length} utilities`} to investigate.`
            : "The intake agent was unavailable, so Scout's keyword rules read the question."}
        </p>
        {result.redactions.length > 0 && <p className="text-sm text-muted">Hidden before any model saw it: {result.redactions.join(", ")}.</p>}
      </header>

      <ul className="grid gap-4">
        {result.requests.map((r) => (
          <RequestRow key={r.contract.contractId} request={r} label={label} />
        ))}
      </ul>

      {result.notes.length > 0 && <p className="text-sm text-ink-2">{result.notes.join(" ")}</p>}
      <p className="rounded-md bg-hl-wash px-3 py-2 text-[0.92rem] text-ink">
        {result.requests.every((r) => r.orchestrator.status === "placeholder")
          ? "The orchestrators checked their contracts but weren't given the data to investigate."
          : "No bill could be investigated, so there's no answer. The reasons are below."}
      </p>
      <TraceList steps={result.trace} open />
    </Sheet>
  );
}

function RequestRow({ request: r, label }: { request: TriageRequest; label: (id: string) => string }) {
  const ok = r.orchestrator.status === "placeholder" || r.orchestrator.status === "done";
  return (
    <li className="grid gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-bold">{UTILITIES[r.utility].name}</h3>
        <span className="text-sm text-ink-2">
          {label(r.bill_a)} → {label(r.bill_b)} · {r.direction === "change" ? "any change" : r.direction}
        </span>
      </div>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[0.92rem]">
        <dt className="text-muted">Contract</dt>
        <dd className="font-mono text-[0.8rem] break-all">{r.contract.contractId}</dd>
        <dt className="text-muted">Intent</dt>
        <dd>
          {r.contract.intent}, confidence {r.contract.confidence.toFixed(2)} ({r.contract.band}), risk {r.contract.risk}
        </dd>
        <dt className="text-muted">Model</dt>
        <dd>{MODEL_NAMES[r.contract.model] ?? r.contract.model}</dd>
        <dt className="text-muted">Allowed</dt>
        <dd className="flex flex-wrap gap-1">
          {r.contract.capabilities.map((c) => (
            <span key={c} className="rounded-[3px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.76rem]">{c}</span>
          ))}
        </dd>
        <dt className="text-muted">Expires</dt>
        <dd>{fmtDateTime(r.contract.expiresAt)}</dd>
        <dt className="text-muted">Signature</dt>
        <dd className="font-mono text-[0.76rem] break-all text-muted">{r.contract.signature.slice(0, 32)}…</dd>
      </dl>
      <p className="flex items-center gap-2 text-[0.95rem]">
        {ok ? <ShieldCheck aria-hidden className="size-4" /> : <X aria-hidden className="size-4 text-rise" />}
        {ok ? (
          <span>
            <Check aria-hidden className="mr-1 inline size-3.5" />
            The {r.utility} orchestrator verified the contract
          </span>
        ) : (
          <span>
            The {r.utility} orchestrator {r.orchestrator.status === "error" ? "couldn't finish the investigation" : "refused the contract"}: {r.orchestrator.reason}
          </span>
        )}
      </p>
    </li>
  );
}
