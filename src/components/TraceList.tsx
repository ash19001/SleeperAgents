import { fmtMs } from "@/lib/format";
import { MODEL_NAMES, ROUTES } from "@/lib/labels";
import type { TraceStep } from "@/lib/types";

// "How this answer was made": every agent step, with its model, route,
// Nightshift receipt and time.
export function TraceList({ steps, open = false, note }: { steps: TraceStep[]; open?: boolean; note?: string }) {
  if (!steps.length) return null;
  const total = steps.reduce((t, s) => t + s.ms, 0);
  return (
    <details open={open} className="group border-t border-line pt-4">
      <summary className="flex cursor-pointer list-none flex-wrap justify-between gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow before:content-['+_'] group-open:before:content-['−_']">How this answer was made</span>
        <span className="text-sm text-muted">
          {steps.length} steps{steps.some((s) => s.agent?.startsWith("specialist:")) ? `, ${fmtMs(Math.round(total))} of work, much of it in parallel` : `, ${fmtMs(Math.round(total))}`}
        </span>
      </summary>
      <ol className="mt-3.5 grid list-decimal gap-2.5 pl-6">
        {steps.map((s, i) => (
          <li key={i} className="pl-1">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
              <span className="font-semibold">{s.label ?? s.step}</span>
              <span className="text-ink-2 tabular-nums">{fmtMs(Math.round(s.ms))}</span>
            </div>
            <div className="text-[0.92rem] text-ink-2">
              {s.agent ? `${s.agent} · ` : ""}
              {s.model ? `${MODEL_NAMES[s.model] ?? s.model} ${ROUTES[s.route] ?? s.route}` : (ROUTES[s.route] ?? s.route)}
              {s.detail?.cached ? " · from Nightshift's cache" : ""}
            </div>
            {(s.model || s.receipt) && (
              <div className="font-mono text-[0.74rem] break-all text-muted">
                {s.model}
                {s.receipt ? ` · receipt ${s.receipt}` : ""}
              </div>
            )}
          </li>
        ))}
      </ol>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
    </details>
  );
}
