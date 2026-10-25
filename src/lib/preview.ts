// Preview mode: serves the SAMPLE household and the hand-written preview
// answers from data/sample/preview_SAMPLE.json, so the page works before the
// agent exists. Server-side only.

import preview from "../../data/sample/preview_SAMPLE.json";
import type { Answer, AskResult, Bill, Household, Note, Utility } from "./types";

type Entry = Answer | { variants: { no_note: Answer; heat_pump_note: Answer } };

const data = preview as unknown as {
  household: Household;
  bills: Bill[];
  answers: Record<string, Entry>;
  examples: string[];
  suggested_note: string;
};

// Notes live in server memory in preview mode, so they reset when the server
// restarts. Kept on globalThis so a dev-server reload doesn't drop them.
const store = globalThis as typeof globalThis & { __previewNotes?: Note[] };
const notes = (store.__previewNotes ??= []);

const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export const previewExamples = data.examples;
export const previewSuggestedNote = data.suggested_note;
export const previewAnswerIds = Object.keys(data.answers);
export const previewHousehold = () => data.household;
export const previewBills = () => data.bills;
export const previewNotes = () => [...notes];

export function previewAddNote(text: string): Note {
  const note = { id: `M${notes.length + 1}`, text, created: new Date().toISOString().slice(0, 10) };
  notes.push(note);
  return note;
}

// Matches the question to a bill with simple keywords. The agent's triage
// step uses Nemotron for this.
export function previewAsk(question: string): AskResult {
  const q = question.toLowerCase();
  const utility: Utility | null = /electric|power/.test(q) ? "electricity" : /\bgas\b/.test(q) ? "gas" : /water/.test(q) ? "water" : null;
  const match = q.match(MONTH_RE);
  if (!utility || !match) {
    return { kind: "clarify", message: "Which bill do you mean? Name the utility and the month, for example “Why did my gas bill go up in January?”" };
  }
  const month = MONTH_KEYS.indexOf(match[1].slice(0, 3)) + 1;
  const bills = data.bills.filter((b) => b.utility === utility);
  const index = bills.findIndex((b) => b.months.includes(month));
  if (index < 0) {
    return { kind: "clarify", message: `There's no ${utility} bill for that month in this sample. The bills run from October 2025 to September 2026.` };
  }
  if (index === 0) {
    return { kind: "clarify", message: `The ${bills[0].label} ${utility} bill is the first one in this sample, so there's no earlier bill to compare it with.` };
  }
  const entry = data.answers[bills[index].bill_id];
  if (!entry) return { kind: "no_preview", bill_id: bills[index].bill_id, utility };
  let answer: Answer;
  if ("variants" in entry) {
    const note = notes.find((n) => /heat pump/i.test(n.text));
    answer = note ? withNote(entry.variants.heat_pump_note, note) : structuredClone(entry.variants.no_note);
  } else {
    answer = structuredClone(entry);
  }
  answer.question = question;
  return { kind: "answer", answer };
}

// The preview answer cites the heat pump note as M1; point it at the note the viewer saved.
function withNote(answer: Answer, note: Note): Answer {
  const json = JSON.stringify(answer).replaceAll('"M1"', JSON.stringify(note.id)).replaceAll("[M1]", `[${note.id}]`);
  const out = JSON.parse(json) as Answer;
  out.memory = [note];
  return out;
}
