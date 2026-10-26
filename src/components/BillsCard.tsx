"use client";

import { Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { BillsChart } from "./BillsChart";
import { Examples } from "./Examples";
import { BUTTON, BUTTON_QUIET_SMALL, FIELD, HEADING } from "./ui";
import { fmtDate } from "@/lib/format";
import { UTILITIES } from "@/lib/labels";
import type { Bill, Household, Utility } from "@/lib/types";

const ORDER: Utility[] = ["electricity", "gas", "water"];

export function BillsCard({ household, bills, utility, onUtility, selected, previewIds, question, onQuestion, onAsk, examples, busy, onAddBill }: {
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
  onAddBill?: () => void; // live mode: add the next bill for this utility
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
    <section aria-labelledby="bills-title" className="grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="bills-title" className={HEADING}>Your bills</h2>
          {onAddBill && (
            <button type="button" className={BUTTON_QUIET_SMALL} onClick={onAddBill}>
              <Plus aria-hidden className="size-4" />Add a bill
            </button>
          )}
        </div>
        <p className="text-sm text-muted md:hidden">
          {household.postcode_district} {household.town} · {household.price_region.name} ({household.price_region.code})
          {household.water_company ? ` · ${household.water_company}` : ""}
        </p>
      </div>

      <div role="tablist" aria-label="Utility" className="flex border-b border-line">
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
            className={`-mb-px border-b-[3px] px-3 pt-1.5 pb-2 font-semibold transition-colors ${
              u === utility ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {UTILITIES[u].name}
          </button>
        ))}
      </div>

      <div id="bills-panel" role="tabpanel" aria-labelledby={`tab-${utility}`} className="grid gap-1">
        {shown.length > 0 && (
          <p className="text-sm text-muted">
            {shown.length} bills, {UTILITIES[utility].cadence}, {fmtDate(shown[0].period_start)} to {fmtDate(shown[shown.length - 1].period_end)}
          </p>
        )}
        <BillsChart
          bills={shown}
          selected={selected}
          previewIds={previewIds}
          onPick={(bill) => onAsk(`Why did my ${UTILITIES[bill.utility].name.toLowerCase()} bill change in ${bill.label}?`)}
        />
      </div>

      <form
        autoComplete="off"
        className="grid gap-2 border-t border-rule pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(question);
        }}
      >
        <label htmlFor="question" className="font-semibold">Ask why a bill changed</label>
        <div className="flex gap-2">
          <input
            id="question"
            name="question"
            type="text"
            value={question}
            onChange={(e) => onQuestion(e.target.value)}
            placeholder="Why did my gas bill go up in January?"
            className={`${FIELD} h-10 min-w-0 flex-1`}
          />
          <button type="submit" disabled={busy} className={BUTTON}>Ask</button>
        </div>
        <Examples examples={examples} onAsk={onAsk} />
      </form>
    </section>
  );
}
