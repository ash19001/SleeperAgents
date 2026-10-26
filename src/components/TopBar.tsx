import type { Household, Mode } from "@/lib/types";

const MODE_LABEL: Record<Mode, string> = { preview: "Preview", replay: "Replay", live: "Live" };
const SAMPLE_TEXT: Record<Mode, string> = {
  preview: "A made-up household. The answers on this page are hand-written previews of what the agents will produce, not answers from them.",
  replay: "A made-up household. Answers were recorded from earlier runs of the agents, so the page works with the agents switched off.",
  live: "A made-up household. Each answer comes from the agents when you ask.",
};

// The product's mark: a bill with one line highlighted.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="8" y="5" width="16" height="22" rx="2" fill="#fff" />
      <rect x="11" y="9" width="10" height="2" rx="1" fill="#13224a" />
      <rect x="9.5" y="14" width="13" height="5" rx="1" fill="#ffde3b" />
      <rect x="11" y="15.5" width="8" height="2" rx="1" fill="#13224a" />
      <rect x="11" y="22" width="6" height="2" rx="1" fill="#13224a" />
    </svg>
  );
}

// The letterhead: the product, whose bills these are, and which mode the page runs in.
export function TopBar({ mode, household }: { mode: Mode; household: Household }) {
  return (
    <>
      <header className="bg-letterhead text-letterhead-ink">
        <div className="gutter mx-auto flex h-16 max-w-[1400px] items-center gap-3">
          <Mark className="-ml-1.5 size-10 flex-none" />
          <h1 className="text-[1.3rem] leading-none font-extrabold tracking-[-0.015em] whitespace-nowrap">Why My Bill</h1>
          <p className="ml-3 hidden min-w-0 truncate border-l border-white/20 pl-4 text-sm text-letterhead-2 md:block">
            {household.postcode_district} {household.town} · {household.price_region.name} price region ({household.price_region.code})
            {household.water_company ? ` · Water: ${household.water_company}` : ""}
          </p>
          <span className="ml-auto flex flex-none items-center gap-2.5">
            <span className="text-sm text-letterhead-2">
              <span className="sr-only">Mode: </span>
              {MODE_LABEL[mode]}
            </span>
            <span className="rounded-[4px] bg-hl px-2 py-0.5 text-[0.78rem] font-bold text-hl-ink">SAMPLE</span>
          </span>
        </div>
      </header>
      <div role="note" className="gutter mx-auto max-w-[1400px] pt-4 text-sm text-ink-2">
        <strong className="font-semibold text-ink">Sample data. </strong>
        {SAMPLE_TEXT[mode]}
      </div>
    </>
  );
}
