// Household memory in Meterless H-MEM. Two kinds of record:
// - notes the household adds: things the bills can't show, like a heat
//   pump. They're cited as M1, M2, … in creation order.
// - findings: each supported cause from a checked answer, with its
//   evidence ids, so later questions can see what was found before.
// The usage and leak specialists recall notes through H-MEM's hybrid
// retrieval (src/agent/tools recall_notes). H-MEM's embedding is lexical, so
// recall returns every note in the window ranked by its relevance score and
// leaves the judgement to the agent. Every create, read and feedback is in
// H-MEM's trust ledger, which the page shows as the memory audit.

import { HMEM, type FeedbackKind, type LedgerEntry, type MemoryRecord } from "#meterless/hmem";
import type { Answer, Note, Utility } from "../lib/types.ts";
import type { NotesMemory } from "../agent/investigation.ts";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// The date a note talks about ("on 15 March 2026", "in June 2026"), if any.
export function noteDate(text: string): string | null {
  const m = text.toLowerCase().match(new RegExp(`(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+)?(${MONTHS.join("|")})\\s+(\\d{4})`));
  if (!m) return null;
  const month = String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0");
  return `${m[3]}-${month}-${(m[1] ?? "1").padStart(2, "0")}`;
}

export interface RecalledNote extends Note {
  relevance: number;
  about: string | null; // the date the note talks about
}

const tagValue = (r: MemoryRecord, prefix: string) => r.tags.find((t) => t.startsWith(prefix))?.slice(prefix.length) ?? null;

export class HouseholdMemory implements NotesMemory {
  readonly hmem: HMEM;

  constructor(opts: { persistDir?: string; clock?: () => number } = {}) {
    this.hmem = new HMEM({ actor: "whybill", persistDir: opts.persistDir, clock: opts.clock });
  }

  private noteRecords(): MemoryRecord[] {
    return this.hmem.store
      .all()
      .filter((r) => r.tags.includes("note"))
      .sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
  }

  private toNote(r: MemoryRecord): Note {
    return { id: tagValue(r, "id:") ?? r.id, text: r.content, created: new Date(r.timestamp).toISOString() };
  }

  notes(): Note[] {
    return this.noteRecords().map((r) => this.toNote(r));
  }

  addNote(text: string): Note {
    const id = `M${this.noteRecords().length + 1}`;
    const about = noteDate(text);
    const record = this.hmem.add({
      content: text.trim(),
      type: "factual",
      layer: "long_term",
      tags: ["note", `id:${id}`, ...(about ? [`about:${about}`] : [])],
      confidence: 0.9,
      source: "household",
      provenance: { origin: "manual", learnedAt: this.hmem.clock(), label: "household note" },
    });
    this.hmem.store.persist();
    return this.toNote(record);
  }

  // Notes that could bear on a bill pair, ranked by H-MEM's relevance to the
  // query. A note about a date after the later bill can't explain it.
  async recall(query: string, opts: { utility: Utility; from: string; to: string }): Promise<RecalledNote[]> {
    const ids = new Set(this.noteRecords().map((r) => r.id));
    const result = this.hmem.query(query, { threshold: 0, topN: Math.max(ids.size, 1) });
    return result.memories
      .filter(({ memory }) => ids.has(memory.id))
      .map(({ memory, relevance }) => ({ ...this.toNote(memory), relevance: Math.round(relevance * 1000) / 1000, about: tagValue(memory, "about:") }))
      .filter((n) => !n.about || n.about <= opts.to);
  }

  // After a checked answer: one finding per supported cause, with its evidence.
  saveFindings(answer: Answer): MemoryRecord[] {
    const saved = answer.causes
      .filter((c) => c.verdict === "supported")
      .map((c) =>
        this.hmem.add({
          content: `${answer.utility} ${answer.bill_a} to ${answer.bill_b}: ${c.id} supported, ${c.effect_gbp >= 0 ? "+" : "−"}£${Math.abs(c.effect_gbp).toFixed(2)}. ${c.detail}`,
          type: "factual",
          tags: ["finding", answer.utility, c.id, `pair:${answer.bill_a}>${answer.bill_b}`, ...c.evidence.map((e) => `evidence:${e}`), ...c.memory.map((m) => `note:${m}`)],
          confidence: 0.8,
          source: "whybill:checker",
          provenance: { origin: "plan_completion", learnedAt: this.hmem.clock(), label: "checked answer", refs: [...c.evidence, ...c.memory] },
        }),
      );
    this.hmem.store.persist();
    return saved;
  }

  findings(pair?: { bill_a: string; bill_b: string }): MemoryRecord[] {
    return this.hmem.store.all().filter((r) => r.tags.includes("finding") && (!pair || r.tags.includes(`pair:${pair.bill_a}>${pair.bill_b}`)));
  }

  // Thumbs on an answer: feedback on the notes it cited and the findings saved from it.
  feedback(answer: Pick<Answer, "bill_a" | "bill_b" | "memory">, helpful: boolean): number {
    const kind: FeedbackKind = helpful ? "helpful" : "not_helpful";
    const cited = new Set(answer.memory.map((n) => n.id));
    const targets = [...this.noteRecords().filter((r) => cited.has(tagValue(r, "id:") ?? "")), ...this.findings(answer)];
    for (const r of targets) this.hmem.feedback(r.id, kind);
    return targets.length;
  }

  audit(): readonly LedgerEntry[] {
    return this.hmem.ledger.all();
  }
}

let shared: HouseholdMemory | null = null;

// The app's memory, persisted under HMEM_PATH (default .memory/).
export function householdMemory(): HouseholdMemory {
  shared ??= new HouseholdMemory({ persistDir: process.env.HMEM_PATH || ".memory" });
  return shared;
}
