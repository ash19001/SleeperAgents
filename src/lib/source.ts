// Where the page's data comes from, by mode.
// - preview: the hand-written SAMPLE answers.
// - live: the agents answer every question from the SAMPLE household's data
//   through Zetaris (or the local files when its views aren't registered),
//   with notes in H-MEM. Each answer is recorded for replay.
// - replay: the recorded answers, with the agents off.

import { answerQuestion } from "@/agent/pipeline";
import { dataSource } from "@/data";
import { addBill as storeBill, nextBillDraft, type BillInput } from "@/data/added";
import { feedRecords } from "@/data/feeds";
import { localSource, resetLocalCache } from "@/data/local";
import { refreshFeeds } from "@/data/zetaris";
import { householdMemory } from "@/memory/hmem";
import { getMode } from "./mode";
import { questionTimeLimitMs, withQuestion } from "./session";
import * as preview from "./preview";
import { loadReplay, saveReplay } from "./replay";
import type { AskResult, Bill, Household, Note, TraceStep, Utility } from "./types";

const live = () => getMode() === "live";

export const examples = preview.previewExamples;
export const suggestedNote = preview.previewSuggestedNote;
export const previewAnswerIds = () => (getMode() === "preview" ? preview.previewAnswerIds : []);

export async function getHousehold(): Promise<Household> {
  return preview.previewHousehold();
}

// Live and replay show the bills the agents read; preview has its own set.
// Replay never touches Zetaris: it reads the same SAMPLE files locally
// (npm run zetaris:check shows they match).
export async function getBills(): Promise<Bill[]> {
  const mode = getMode();
  if (mode === "preview") return preview.previewBills();
  const { rows } = await (mode === "live" ? await dataSource() : localSource).bills();
  return rows.map(({ utility, bill_id, label, months, period_start, period_end, days, units_billed, unit, read_type, adjustments_gbp, total_gbp }) => ({
    utility, bill_id, label, months, period_start, period_end, days, units_billed, unit, read_type, adjustments_gbp, total_gbp,
  }));
}

export async function getNotes(): Promise<Note[]> {
  return live() ? householdMemory().notes() : preview.previewNotes();
}

export async function addNote(text: string): Promise<Note> {
  return live() ? householdMemory().addNote(text) : preview.previewAddNote(text);
}

// onStep hears each agent step as it happens (live mode only).
export async function ask(question: string, onStep?: (step: TraceStep) => void): Promise<AskResult> {
  const mode = getMode();
  if (mode === "preview") return preview.previewAsk(question);
  const notes = await getNotes();
  if (mode === "replay") {
    const recording = loadReplay(question, notes);
    if (recording) return recording.result;
    return {
      kind: "general",
      message: `Replay mode only has answers recorded from earlier live runs${notes.length ? " with these household notes" : ""}, and there isn't one for that question. Tap a bar or try one of the example questions.`,
    };
  }
  // Every agent step goes to the server log too: who, what, which model, the Nightshift receipt.
  const log = (s: TraceStep) => {
    console.log(`[why-my-bill] ${s.agent ?? s.step} | ${s.label ?? s.step} | ${s.model ?? s.route}${s.receipt ? ` | receipt ${s.receipt}` : ""} | ${Math.round(s.ms)} ms`);
    onStep?.(s);
  };
  console.log(`[why-my-bill] question: ${question}`);
  // One question, with a time limit: past it, code finishes the answer.
  const result = await withQuestion(
    async () => answerQuestion(question, { bills: await getBills(), data: await dataSource(), memory: householdMemory(), onStep: log }),
    questionTimeLimitMs(),
  );
  // An answer that fell back (no models, no Zetaris) isn't kept for replay.
  if (!result.notices?.length) saveReplay(question, notes, result);
  return result;
}

// Thumbs on an answer: in live mode, H-MEM feedback on the notes it cited
// and the findings saved from it.
export async function saveFeedback(input: { question: string; bill_a?: string; bill_b: string; rating: string; memory?: string[] }): Promise<{ stored: boolean; updated?: number }> {
  if (!live() || !input.bill_a) return { stored: false };
  const memory = householdMemory();
  const cited = memory.notes().filter((n) => input.memory?.includes(n.id));
  const updated = memory.feedback({ bill_a: input.bill_a, bill_b: input.bill_b, memory: cited }, input.rating === "helpful");
  return { stored: true, updated };
}

// A missing bill the household adds (live mode): what the form starts with,
// and saving it into the supplier feed, then refreshing Zetaris's copy so the
// agents see it straight away.
export function billDraft(utility: Utility) {
  return nextBillDraft(utility, feedRecords);
}

export async function addBill(input: BillInput): Promise<{ bill_id: string; zetaris: "refreshed" | "not used" }> {
  if (!live()) throw new Error("Bills can be added in live mode only.");
  const { bill_id, feeds } = storeBill(input, feedRecords);
  resetLocalCache();
  const source = await dataSource();
  if (source.name === "zetaris") await refreshFeeds(feeds);
  return { bill_id, zetaris: source.name === "zetaris" ? "refreshed" : "not used" };
}
