// Where the page's data comes from, by mode. Only preview exists so far; the
// agent (live) and recorded answers (replay) plug in here.

import { getMode } from "./mode";
import * as preview from "./preview";
import type { AskResult, Bill, Household, Note } from "./types";

function notBuilt(): never {
  throw new Error(`${getMode()} mode isn't built yet. Set WHYBILL_MODE=preview in .env.local`);
}

const isPreview = () => getMode() === "preview";

export const examples = preview.previewExamples;
export const suggestedNote = preview.previewSuggestedNote;
export const previewAnswerIds = () => (isPreview() ? preview.previewAnswerIds : []);

export async function getHousehold(): Promise<Household> {
  return isPreview() ? preview.previewHousehold() : notBuilt();
}

export async function getBills(): Promise<Bill[]> {
  return isPreview() ? preview.previewBills() : notBuilt();
}

export async function getNotes(): Promise<Note[]> {
  return isPreview() ? preview.previewNotes() : notBuilt();
}

export async function addNote(text: string): Promise<Note> {
  return isPreview() ? preview.previewAddNote(text) : notBuilt();
}

export async function ask(question: string): Promise<AskResult> {
  return isPreview() ? preview.previewAsk(question) : notBuilt();
}

export async function saveFeedback(_input: { question: string; bill_b: string; rating: string }): Promise<{ stored: boolean }> {
  return isPreview() ? { stored: false } : notBuilt();
}
