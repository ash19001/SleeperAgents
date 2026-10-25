import { Gauge } from "lucide-react";
import type { Mode } from "@/lib/types";

const MODE_LABEL: Record<Mode, string> = { preview: "Preview", replay: "Replay", live: "Live" };
const MODE_DOT: Record<Mode, string> = { preview: "bg-sample-ink", replay: "bg-down", live: "bg-accent" };
const SAMPLE_TEXT: Record<Mode, string> = {
  preview: "A made-up household. The answers on this page are hand-written previews of what the agent will produce. They don't come from the agent yet.",
  replay: "A made-up household. Answers were recorded from earlier runs of the agent, so the page works with the agent switched off.",
  live: "A made-up household. Each answer comes from the agent when you ask.",
};

export function TopBar({ mode }: { mode: Mode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="gutter mx-auto flex max-w-[1240px] items-center justify-between gap-3 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Gauge aria-hidden className="size-9 flex-none text-accent" strokeWidth={2.2} />
            <div>
              <h1 className="headline text-[1.55rem] leading-[1.05] font-extrabold tracking-[-0.01em]">Why My Bill</h1>
              <p className="text-[0.92rem] text-ink-2">Ask why a bill changed. See the £ split, the causes and the evidence.</p>
            </div>
          </div>
          <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[0.72rem] tracking-[0.08em] text-ink-2 uppercase">
            <span aria-hidden className={`size-2 rounded-full ${MODE_DOT[mode]}`} />
            {MODE_LABEL[mode]}
          </span>
        </div>
      </header>
      <div role="note" className="bg-sample text-sample-ink">
        <div className="gutter mx-auto flex max-w-[1240px] items-baseline gap-2.5 py-2 text-[0.92rem]">
          <span className="flex-none rounded border border-current px-1.5 font-mono text-[0.72rem] font-medium tracking-[0.14em]">
            SAMPLE
          </span>
          <span>{SAMPLE_TEXT[mode]}</span>
        </div>
      </div>
    </>
  );
}
