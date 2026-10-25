"use client";

import { MapPin } from "lucide-react";
import type { KeyboardEvent } from "react";
import { BillsChart } from "./BillsChart";
import { Examples } from "./Examples";
import { BUTTON } from "./ui";
import { fmtDate } from "@/lib/format";
import { UTILITIES } from "@/lib/labels";
import type { Bill, Household, Utility } from "@/lib/types";

const ORDER: Utility[] = ["electricity", "gas", "water"];

export function BillsCard({ household, bills, utility, onUtility, selected, previewIds, question, onQuestion, onAsk, examples, busy }: {
  household: Household;
  bills: Bill[];
  utility: Utility;
  onUtility: (utility: Utility) => void;
  selected: string | null;
  previewIds: string[];
  question: string;
  onQuestion: (question: string) => void;
  onAsk: (question: string) => void;
  examples: string[];
  busy: boolean;
}) {
  const shown = bills.filter((b) => b.utility === utility);

  // Arrow keys move between the utility tabs.
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = ORDER[(ORDER.indexOf(utility) + dir + ORDER.length) % ORDER.length];
    onUtility(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <section aria-labelledby="bills-title" className="grid min-w-0 gap-3.5 rounded-xl border border-line bg-surface p-4 pb-[18px]">
      <div className="grid gap-0.5">
        <h2 id="bills-title" className="headline text-xl leading-tight font-bold">Your bills</h2>
        <p className="flex items-start gap-1.5 text-sm text-ink-2">
          <MapPin aria-hidden className="mt-0.5 size-3.5 flex-none text-accent" />
          <span>
            {household.postcode_district} {household.town} · {household.price_region.name} price region ({household.price_region.code})
            {household.water_company ? ` · Water: ${household.water_company}` : ""}
          </span>
        </p>
        {shown.length > 0 && (
          <p className="text-sm text-muted">
            {shown.length} bills, {UTILITIES[utility].cadence}, {fmtDate(shown[0].period_start)} to {fmtDate(shown[shown.length - 1].period_end)}
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Utility" className="flex gap-0.5 border-b border-line">
        {ORDER.map((u) => (
          <button
            key={u}
            id={`tab-${u}`}
            role="tab"
            type="button"
            aria-selected={u === utility}
            aria-controls="bills-panel"
            tabIndex={u === utility ? 0 : -1}
            onClick={() => onUtility(u)}
            onKeyDown={onTabKey}
            className={`-mb-px border-b-2 px-3 pt-2 pb-2.5 font-semibold ${
              u === utility ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {UTILITIES[u].name}
          </button>
        ))}
      </div>

      <div id="bills-panel" role="tabpanel" aria-labelledby={`tab-${utility}`}>
        <BillsChart
          bills={shown}
          selected={selected}
          previewIds={previewIds}
          onPick={(bill) => onAsk(`Why did my ${UTILITIES[bill.utility].name.toLowerCase()} bill change in ${bill.label}?`)}
        />
      </div>
      <p className="text-sm text-muted">Tap a bar to ask why that bill changed.</p>

      <form
        autoComplete="off"
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(question);
        }}
      >
        <label htmlFor="question" className="text-[0.95rem] font-semibold">Or ask in your own words</label>
        <div className="flex gap-2">
          <input
            id="question"
            name="question"
            type="text"
            value={question}
            onChange={(e) => onQuestion(e.target.value)}
            placeholder="Why did my gas bill go up in January?"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 focus:border-accent focus:ring-3 focus:ring-accent-wash focus:outline-none"
          />
          <button type="submit" disabled={busy} className={BUTTON}>Ask</button>
        </div>
        <Examples examples={examples} onAsk={onAsk} />
      </form>
    </section>
  );
}
