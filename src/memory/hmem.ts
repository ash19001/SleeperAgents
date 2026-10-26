// Household memory in Meterless H-MEM. Two kinds of record:
// - notes the household adds: things the bills can't show, like a heat
//   pump. They're cited as M1, M2, … in creation order.
// - findings: each supported cause from a checked answer, with its
//   evidence ids, one per bill pair and cause.
// The usage and leak specialists recall notes through H-MEM's hybrid
// scoring (src/agent/tools recall_notes). H-MEM's embedding is lexical, so
// recall returns every note in the window ranked by its relevance score and
// leaves the judgement to the agent.
//
// Thumbs on an answer count: "Yes" raises the confidence of the notes and
// findings behind it; "No" lowers the findings' and flags the notes it cited
// for review (H-MEM's "wrong" feedback), and a flagged note isn't recalled
// until the household keeps it. Every create, read, feedback and update is
// in H-MEM's trust ledger, which the page shows as the memory audit.

import { HMEM, type FeedbackKind, type LedgerEntry, type MemoryRecord } from "#meterless/hmem";
import { CAUSE_NAMES } from "../lib/labels.ts";
import type { Answer, AuditEntry, Note, Utility } from "../lib/types.ts";
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
const REVIEW = "review"; // the tag H-MEM's "wrong" feedback adds
// A bill id ends with the year and month the bill starts: A-G-202601 is "Jan 2026".
const billMonth = (id: string) => {
  const m = id.match(/(\d{4})(\d{2})$/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).replace("Sept", "Sep") : id;
};
const NOTE_CONFIDENCE = 0.9;

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
    return { id: tagValue(r, "id:") ?? r.id, text: r.content, created: new Date(r.timestamp).toISOString(), ...(r.tags.includes(REVIEW) ? { flagged: true } : {}) };
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
      confidence: NOTE_CONFIDENCE,
      source: "household",
      provenance: { origin: "manual", learnedAt: this.hmem.clock(), label: "household note" },
    });
    this.hmem.store.persist();
    return this.toNote(record);
  }

  // Notes that could bear on a bill pair, ranked by H-MEM's relevance to the
  // query. A note about a date after the later bill can't explain it, and a
  // note flagged for review isn't used until the household keeps it. Only
  // notes are scored (H-MEM's own query ranks findings too, which crowded
  // notes out of its top places), and each read goes in the ledger as
  // H-MEM's query would log it.
  async recall(query: string, opts: { utility: Utility; from: string; to: string }): Promise<RecalledNote[]> {
    const scored = this.noteRecords()
      .filter((r) => !r.tags.includes(REVIEW))
      .map((r) => ({ r, relevance: this.hmem.retrieval.scoreOne(r, query) }))
      .sort((a, b) => b.relevance - a.relevance || Number(a.r.id.slice(4)) - Number(b.r.id.slice(4)));
    for (const { r } of scored) {
      this.hmem.store.touch(r.id);
      this.hmem.ledger.log(r.id, "read", "whybill", { details: { query } });
    }
    return scored
      .map(({ r, relevance }) => ({ ...this.toNote(r), relevance: Math.round(relevance * 1000) / 1000, about: tagValue(r, "about:") }))
      .filter((n) => !n.about || n.about <= opts.to);
  }

  // After a checked answer: one finding per supported cause, with its evidence.
  // A cause already saved for this bill pair isn't saved again.
  saveFindings(answer: Answer): MemoryRecord[] {
    const known = new Set(this.findings(answer).map((r) => r.tags.find((t) => /^C\d+$/.test(t))));
    const saved = answer.causes
      .filter((c) => c.verdict === "supported" && !known.has(c.id))
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

  // Thumbs on an answer. "Yes": the notes it cited and its findings are
  // trusted more. "No": its findings less, and the notes it cited are flagged
  // for review. Returns how many records changed and which notes were flagged.
  feedback(answer: Pick<Answer, "bill_a" | "bill_b" | "memory">, helpful: boolean): { updated: number; flagged: string[] } {
    const cited = new Set(answer.memory.map((n) => n.id));
    const notes = this.noteRecords().filter((r) => cited.has(tagValue(r, "id:") ?? ""));
    // One finding per cause (stores from before duplicates were skipped can hold several).
    const findings = [...new Map(this.findings(answer).map((r) => [r.tags.find((t) => /^C\d+$/.test(t)), r])).values()];
    for (const r of notes) this.hmem.feedback(r.id, helpful ? "helpful" : "wrong");
    for (const r of findings) this.hmem.feedback(r.id, helpful ? "helpful" : "not_helpful");
    return { updated: notes.length + findings.length, flagged: helpful ? [] : notes.map((r) => tagValue(r, "id:")!) };
  }

  // The household keeps a note flagged for review: it's used again, at its first confidence.
  keepNote(id: string): Note {
    const r = this.noteRecords().find((x) => tagValue(x, "id:") === id);
    if (!r) throw new Error(`There's no note ${id}.`);
    this.hmem.store.update(r.id, { tags: r.tags.filter((t) => t !== REVIEW), confidence: NOTE_CONFIDENCE });
    return this.toNote(r);
  }

  audit(): readonly LedgerEntry[] {
    return this.hmem.ledger.all();
  }

  // The ledger in plain words, newest first, for the page.
  auditTrail(limit = 30): { entries: AuditEntry[]; total: number } {
    const all = this.hmem.ledger.all();
    const describe = (e: LedgerEntry): string | null => {
      const r = this.hmem.store.get(e.memoryId);
      if (!r) return null;
      const kind = (e.details?.kind as FeedbackKind | undefined) ?? null;
      if (r.tags.includes("note")) {
        const id = tagValue(r, "id:");
        if (e.action === "create") return `${id} added by the household`;
        if (e.action === "read") return `${id} recalled for a question`;
        if (e.action === "feedback") return kind === "wrong" ? `${id} flagged for review: an answer that used it was marked not useful` : `${id} rated ${kind === "helpful" ? "useful" : "not useful"}`;
        if (e.action === "update") return e.previousState?.tags?.includes(REVIEW) && !e.newState?.tags?.includes(REVIEW) ? `${id} kept after review` : `${id} updated`;
        return `${id}: ${e.action}`;
      }
      if (r.tags.includes("finding")) {
        const cause = r.tags.find((t) => /^C\d+$/.test(t)) ?? "";
        const [a, b] = (tagValue(r, "pair:") ?? "").split(">").map(billMonth);
        const what = `${CAUSE_NAMES[cause] ?? cause}, ${r.tags[1]} ${a} → ${b}`;
        if (e.action === "create") return `Finding saved: ${what}`;
        if (e.action === "feedback") return `Finding rated ${kind === "helpful" ? "useful" : "not useful"}: ${what}`;
        return `Finding ${e.action}: ${what}`;
      }
      return null;
    };
    const entries: AuditEntry[] = [];
    for (let i = all.length - 1; i >= 0 && entries.length < limit; i--) {
      const text = describe(all[i]);
      if (text) entries.push({ at: new Date(all[i].timestamp).toISOString(), text });
    }
    return { entries, total: all.length };
  }
}

let shared: HouseholdMemory | null = null;

// The app's memory, persisted under HMEM_PATH (default .memory/).
export function householdMemory(): HouseholdMemory {
  shared ??= new HouseholdMemory({ persistDir: process.env.HMEM_PATH || ".memory" });
  return shared;
}
