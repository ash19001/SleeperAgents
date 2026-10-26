"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { BUTTON, BUTTON_QUIET, BUTTON_QUIET_SMALL, FIELD } from "./ui";
import { postJson } from "@/lib/client";
import { money } from "@/lib/format";
import { UTILITIES } from "@/lib/labels";
import type { Utility } from "@/lib/types";

// The household adds a missing bill: figures copied from the paper or PDF
// bill. The server checks it adds up, saves it into the supplier feed and
// refreshes Zetaris; then the question is asked again.

interface Draft {
  period_from: string;
  period_to: string;
  opening_read: number;
  unit: string;
  latest_period_to: string;
  example: Record<string, number>;
}

type Field = { name: string; label: string; hint?: string; type: "date" | "number"; optional?: boolean };

const ENERGY: Field[] = [
  { name: "period_from", label: "Bill starts", type: "date" },
  { name: "period_to", label: "Bill ends", type: "date" },
  { name: "opening_read", label: "Opening meter reading (kWh)", type: "number" },
  { name: "closing_read", label: "Closing meter reading (kWh)", type: "number" },
  { name: "energy_gbp", label: "Energy charge (£)", hint: "Units used × unit rate", type: "number" },
  { name: "standing_gbp", label: "Standing charge (£)", hint: "For the whole bill", type: "number" },
  { name: "adjustment_gbp", label: "Credit or one-off charge (£)", hint: "Negative for a credit; leave blank if none", type: "number", optional: true },
  { name: "total_gbp", label: "Total (£)", type: "number" },
];

const WATER: Field[] = [
  { name: "period_from", label: "Bill starts", type: "date" },
  { name: "period_to", label: "Bill ends", type: "date" },
  { name: "opening_read", label: "Opening meter reading (m³)", type: "number" },
  { name: "closing_read", label: "Closing meter reading (m³)", type: "number" },
  { name: "water_gbp", label: "Water charge (£)", type: "number" },
  { name: "sewerage_gbp", label: "Sewerage charge (£)", type: "number" },
  { name: "water_standing_gbp", label: "Water standing charge (£)", type: "number" },
  { name: "sewerage_standing_gbp", label: "Sewerage standing charge (£)", type: "number" },
  { name: "total_gbp", label: "Total (£)", type: "number" },
];

const CHARGES = ["energy_gbp", "standing_gbp", "adjustment_gbp", "water_gbp", "sewerage_gbp", "water_standing_gbp", "sewerage_standing_gbp"];
const INPUT = `${FIELD} h-10`;
const monthName = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function AddBillForm({ utility, period, onSaved, onCancel }: {
  utility: Utility;
  period: string | null;
  onSaved: (billId: string) => void;
  onCancel: () => void;
}) {
  const fields = utility === "water" ? WATER : ENERGY;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [readType, setReadType] = useState<"actual" | "estimated">("actual");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/bill?utility=${utility}`)
      .then((r) => r.json())
      .then(({ draft, error }: { draft?: Draft; error?: string }) => {
        if (!live) return;
        if (!draft) return setError(error ?? "Couldn't start the form.");
        setDraft(draft);
        setValues({ period_from: draft.period_from, period_to: draft.period_to, opening_read: String(draft.opening_read) });
      })
      .catch(() => live && setError("Couldn't start the form."));
    return () => {
      live = false;
    };
  }, [utility]);

  const num = (name: string) => Number(values[name] || 0);
  const units = num("closing_read") - num("opening_read");
  const sum = CHARGES.reduce((t, c) => t + num(c), 0);
  const adds = values.total_gbp ? Math.round(sum * 100) === Math.round(num("total_gbp") * 100) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body: Record<string, unknown> = { utility, read_type: readType };
    for (const f of fields) body[f.name] = f.type === "date" ? values[f.name] : num(f.name);
    if (utility !== "water") body.adjustment_note = note;
    try {
      const { bill_id } = await postJson<{ bill_id: string }>("/api/bill", body);
      onSaved(bill_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const name = UTILITIES[utility].name.toLowerCase();
  return (
    <Sheet title={period ? `Add your ${monthName(period)} ${name} bill` : `Add your next ${name} bill`} meta="Add a missing bill">
    <form onSubmit={save} className="grid gap-5" autoComplete="off">
      <div className="grid gap-1.5">
        <p className="max-w-[66ch] text-ink-2">
          Copy the figures from the bill. Code checks they add up, the bill goes into your supplier data in Zetaris, and the agents explain it.
          {draft && ` It starts after your latest ${name} bill, which ended on ${draft.latest_period_to}.`}
        </p>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1.5 font-semibold">Meter reading on the bill</legend>
        {(["actual", "estimated"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={readType === t} className={BUTTON_QUIET_SMALL} onClick={() => setReadType(t)}>
            {t === "actual" ? "Actual" : "Estimated"}
          </button>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className="grid gap-1">
            <span className="text-[0.94rem] font-semibold">{f.label}</span>
            <input
              type={f.type}
              name={f.name}
              step={f.type === "number" ? "any" : undefined}
              inputMode={f.type === "number" ? "decimal" : undefined}
              required={!f.optional}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className={INPUT}
            />
            {f.hint && <span className="text-[0.82rem] text-muted">{f.hint}</span>}
          </label>
        ))}
        {utility !== "water" && (
          <label className="grid gap-1">
            <span className="text-[0.94rem] font-semibold">What the credit or charge is for</span>
            <input type="text" name="adjustment_note" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} placeholder="Goodwill credit" />
          </label>
        )}
      </div>

      <div className="grid gap-1 rounded-md border border-line bg-surface-2 px-4 py-3 text-[0.95rem]">
        <span>
          Units used: <strong>{Number.isFinite(units) ? `${Math.round(units * 100) / 100} ${draft?.unit ?? ""}` : "–"}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          {adds === true ? <Check aria-hidden className="size-4" strokeWidth={2.5} /> : adds === false ? <X aria-hidden className="size-4 text-rise" /> : null}
          Charges add up to <strong>{money(sum)}</strong>
          {adds === true ? ", the same as the total." : adds === false ? `, not the total of ${money(num("total_gbp"))}.` : "."}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BUTTON} disabled={saving || !draft}>
          {saving ? "Saving…" : "Save bill and explain it"}
        </button>
        {draft && (
          <button
            type="button"
            className={BUTTON_QUIET}
            onClick={() => setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(draft.example).map(([k, x]) => [k, String(x)])) }))}
          >
            Fill in example figures
          </button>
        )}
        <button type="button" className={BUTTON_QUIET} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p role="status" className="text-sm text-rise">{error}</p>
    </form>
    </Sheet>
  );
}
