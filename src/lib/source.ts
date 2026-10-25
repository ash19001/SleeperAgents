// Where the page's data comes from, by mode. Live mode runs the agents;
// until Phase 5 they read the SAMPLE preview bills. Replay is still to come.

import { triage } from "@/agent/triage";
import { getMode } from "./mode";
import * as preview from "./preview";
import type { AskResult, Bill, Household, Note } from "./types";

function notBuilt(): never {
  throw new Error(`${getMode()} mode isn't built yet. Set WHYBILL_MODE=preview or live in .env.local`);
}

// Preview and live both use the SAMPLE household until the data moves to Zetaris.
const sampleData = () => getMode() !== "replay";

export const examples = preview.previewExamples;
export const suggestedNote = preview.previewSuggestedNote;
export const previewAnswerIds = () => (getMode() === "preview" ? preview.previewAnswerIds : []);

export async function getHousehold(): Promise<Household> {
  return sampleData() ? preview.previewHousehold() : notBuilt();
}

export async function getBills(): Promise<Bill[]> {
  return sampleData() ? preview.previewBills() : notBuilt();
}

export async function getNotes(): Promise<Note[]> {
  return sampleData() ? preview.previewNotes() : notBuilt();
}

export async function addNote(text: string): Promise<Note> {
  return sampleData() ? preview.previewAddNote(text) : notBuilt();
}

export async function ask(question: string): Promise<AskResult> {
  const mode = getMode();
  if (mode === "preview") return preview.previewAsk(question);
  if (mode === "live") return triage(question, { bills: preview.previewBills() });
  return notBuilt();
}

export async function saveFeedback(_input: { question: string; bill_b: string; rating: string }): Promise<{ stored: boolean }> {
  return sampleData() ? { stored: false } : notBuilt();
}
