import { ChevronRight } from "lucide-react";
import { fmtMs } from "@/lib/format";
import { MODEL_NAMES, ROUTES } from "@/lib/labels";
import type { TraceStep } from "@/lib/types";

// "How this answer was made": every agent step, with its model, route,
// Nightshift receipt and time.
export function TraceList({ steps, open = false, note }: { steps: TraceStep[]; open?: boolean; note?: string }) {
  if (!steps.length) return null;
  const total = steps.reduce((t, s) => t + s.ms, 0);
  // Steps run in parallel, so the elapsed time comes from when they started and ended.
  const timed = steps.filter((s) => s.at);
  const elapsed = timed.length ? Math.max(...timed.map((s) => s.at!)) - Math.min(...timed.map((s) => s.at! - s.ms)) : null;
  const models = steps.filter((s) => s.model).length;
  const receipts = steps.filter((s) => s.receipt).length;
  return (
    <details open={open} className="group border-t border-line pt-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 font-bold">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" strokeWidth={2.5} />
          How this answer was made
        </span>
        <span className="text-sm text-muted">
          {steps.length} step{steps.length === 1 ? "" : "s"} · {models} model call{models === 1 ? "" : "s"}{receipts ? `, ${receipts} with Nightshift receipts` : ""} · {elapsed !== null ? `answered in ${fmtMs(Math.round(elapsed))}` : fmtMs(Math.round(total))}
        </span>
      </summary>
      <ol className="mt-3 grid border-t border-rule">
        {steps.map((s, i) => (
          <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-2 border-b border-rule py-2.5">
            <span className="text-sm text-muted">{i + 1}</span>
            <div className="min-w-0">
              <p className="font-semibold">{s.label ?? s.step}</p>
              <p className="text-[0.92rem] text-ink-2">
                {s.agent ? `${s.agent} · ` : ""}
                {s.model ? `${MODEL_NAMES[s.model] ?? s.model} ${ROUTES[s.route] ?? s.route}` : (ROUTES[s.route] ?? s.route)}
                {s.detail?.cached ? " · from Nightshift's cache" : ""}
              </p>
              {(s.model || s.receipt) && (
                <p className="font-mono text-[0.76rem] break-all text-muted">
                  {s.model}
                  {s.receipt ? ` · receipt ${s.receipt}` : ""}
                </p>
              )}
            </div>
            <span className="text-right text-sm text-ink-2">{fmtMs(Math.round(s.ms))}</span>
          </li>
        ))}
      </ol>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
    </details>
  );
}
