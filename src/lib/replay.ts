// Replay mode: answers recorded from live runs, kept in eval/answers/ so the
// page works with the agents and Zetaris off (for the demo and for judges).
// Each file is one question asked with one set of household notes, so the
// "before and after the heat pump note" flow replays too. Server-side only.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AskResult, Note } from "./types";

const DIR = join(process.cwd(), "eval", "answers");

export interface Recording {
  question: string;
  notes: string[];
  recorded_at: string;
  result: AskResult;
}

const normalise = (q: string) => q.toLowerCase().replace(/[“”"?!.]/g, "").replace(/\s+/g, " ").trim();
const slug = (q: string) => normalise(q).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const notesKey = (notes: Note[]) =>
  notes.length ? `notes-${createHash("sha256").update(notes.map((n) => n.text.trim().toLowerCase()).sort().join("|")).digest("hex").slice(0, 8)}` : "no-notes";

const fileFor = (question: string, notes: Note[]) => join(DIR, `${slug(question)}--${notesKey(notes)}.json`);

// Live mode records every answer it gives.
export function saveReplay(question: string, notes: Note[], result: AskResult): void {
  if (result.kind !== "answer" && result.kind !== "answers") return;
  mkdirSync(DIR, { recursive: true });
  const recording: Recording = { question, notes: notes.map((n) => n.text), recorded_at: new Date().toISOString(), result };
  writeFileSync(fileFor(question, notes), JSON.stringify(recording, null, 2) + "\n");
}

export function loadReplay(question: string, notes: Note[]): Recording | null {
  const file = fileFor(question, notes);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Recording) : null;
}

// The questions there are recordings for, without notes, for the examples.
export function recordedQuestions(): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith("--no-notes.json"))
    .map((f) => (JSON.parse(readFileSync(join(DIR, f), "utf8")) as Recording).question)
    .sort();
}
