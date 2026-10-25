"use client";

import { type CSSProperties, useState } from "react";
import { fmtUnits, money, shortLabel } from "@/lib/format";
import { UTILITIES } from "@/lib/labels";
import type { Bill } from "@/lib/types";

function niceStep(max: number) {
  for (const step of [10, 20, 25, 50, 100, 200, 250, 500]) if (max / step <= 4) return step;
  return 1000;
}

// One bar per bill, drawn to a single £ scale. Tapping a bar asks about that bill.
export function BillsChart({ bills, selected, previewIds, onPick }: {
  bills: Bill[];
  selected: string | null;
  previewIds: string[];
  onPick: (bill: Bill) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!bills.length) return null;

  const max = Math.max(...bills.map((b) => b.total_gbp));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const pct = (v: number) => `${(v / top) * 100}%`;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const name = UTILITIES[bills[0].utility].name;
  const anyEstimated = bills.some((b) => b.read_type === "estimated");
  const anyPreview = bills.some((b) => previewIds.includes(b.bill_id));

  return (
    <div>
      <div className="relative mt-5 grid grid-cols-[2.75rem_minmax(0,1fr)] grid-rows-[176px_auto]">
        <div aria-hidden className="relative col-start-1 row-start-1">
          {ticks.map((v) => (
            <span key={v} style={{ bottom: pct(v) }} className="absolute right-2 translate-y-1/2 text-[0.72rem] text-muted tabular-nums">
              £{v}
            </span>
          ))}
        </div>

        <div className="relative col-start-2 row-start-1 border-b border-axis">
          {ticks.slice(1).map((v) => (
            <div key={v} style={{ bottom: pct(v) }} className="absolute inset-x-0 border-t border-grid" />
          ))}
          <div className="absolute inset-0 flex">
            {bills.map((bill, i) => {
              const on = bill.bill_id === selected;
              const estimated = bill.read_type === "estimated";
              // Keep the tooltip inside the chart at either end.
              const align = i < 2 ? "left-0" : i > bills.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={bill.bill_id} className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${name} bill, ${bill.label}, ${money(bill.total_gbp)}${estimated ? ", estimated reading" : ""}. Ask why it changed.`}
                    onClick={() => onPick(bill)}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="group absolute inset-0 flex items-end justify-center"
                  >
                    <span
                      style={{ height: pct(bill.total_gbp) }}
                      className={`w-[min(24px,70%)] rounded-t-[4px] transition-colors ${
                        on ? "bg-bar-sel" : "bg-bar group-hover:bg-bar-hover group-focus-visible:bg-bar-hover"
                      }`}
                    />
                  </button>
                  {on && (
                    <span
                      style={{ bottom: `calc(${pct(bill.total_gbp)} + 4px)` }}
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap tabular-nums"
                    >
                      {money(bill.total_gbp)}
                    </span>
                  )}
                  {hover === i && (
                    <Tooltip bill={bill} className={align} style={{ bottom: `calc(${pct(bill.total_gbp)} + 24px)` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div aria-hidden className="col-start-2 row-start-2 flex pt-1.5">
          {bills.map((bill) => {
            const on = bill.bill_id === selected;
            return (
              <span
                key={bill.bill_id}
                className={`grid min-w-0 flex-1 justify-items-center gap-px text-center text-[0.72rem] leading-tight ${on ? "font-bold text-ink" : "text-muted"}`}
              >
                {shortLabel(bill)}
                {bill.read_type === "estimated" && <span className="text-[0.66rem]">Est.</span>}
                {previewIds.includes(bill.bill_id) && <span className="size-1.5 rounded-full bg-accent" />}
              </span>
            );
          })}
        </div>
      </div>

      {(anyEstimated || anyPreview) && (
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-muted">
          {anyEstimated && <span>Est. = estimated meter reading</span>}
          {anyPreview && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              Has a preview answer
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Tooltip({ bill, className, style }: { bill: Bill; className: string; style: CSSProperties }) {
  return (
    <div
      role="tooltip"
      style={style}
      className={`pointer-events-none absolute z-10 grid min-w-36 gap-px rounded-lg bg-tip px-2.5 py-2 text-[0.8rem] leading-snug text-tip-ink shadow-sheet ${className}`}
    >
      <span className="opacity-80">{bill.label}</span>
      <strong className="text-base tabular-nums">{money(bill.total_gbp)}</strong>
      <span>
        {bill.days} days, {fmtUnits(bill.units_billed, bill.unit)}
      </span>
      {bill.read_type === "estimated" && <span>Estimated reading</span>}
      {bill.adjustments_gbp !== 0 && (
        <span>
          Includes a {money(Math.abs(bill.adjustments_gbp))} {bill.adjustments_gbp < 0 ? "credit" : "charge"}
        </span>
      )}
    </div>
  );
}
