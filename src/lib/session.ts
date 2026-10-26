// What went wrong while answering one question, so the answer can say so:
// the models unavailable or out of time, or the local SAMPLE copy read in
// place of Zetaris. Kept per question with AsyncLocalStorage, so model calls
// and data reads deep inside the agents record it without passing it around.

import { AsyncLocalStorage } from "node:async_hooks";

export interface QuestionState {
  started: number;
  limitMs: number; // the time limit for one bill; Infinity for none
  deadline: number; // after this no model call is sent, and code finishes the answer
  models: { reason: "unavailable" | "time"; why: string } | null; // once set, no more model calls this question
  zetaris: string | null; // why the local SAMPLE copy was read instead
}

const store = new AsyncLocalStorage<QuestionState>();

// The page's limit on a question about one bill, from QUESTION_TIME_LIMIT_S
// (default 4 minutes). Each further bill adds half of it (extraBill).
export const questionTimeLimitMs = () => (Number(process.env.QUESTION_TIME_LIMIT_S) || 240) * 1000;

// Runs fn as one question with its own state, or joins the question already
// running. Without a time limit (scripts, evaluations) there's no deadline.
export function withQuestion<T>(fn: () => Promise<T>, timeLimitMs?: number): Promise<T> {
  if (store.getStore()) return fn();
  const started = Date.now();
  const limitMs = timeLimitMs || Infinity;
  return store.run({ started, limitMs, deadline: started + limitMs, models: null, zetaris: null }, fn);
}

// The question covers one more bill than first counted: the agents' calls
// are paced, so more bills take longer. Adds half the one-bill limit.
export function extraBill() {
  const q = store.getStore();
  if (q && Number.isFinite(q.limitMs)) q.deadline += q.limitMs / 2;
}

export const currentQuestion = (): QuestionState | undefined => store.getStore();

// Why an agent's model call failed, for the timeline: "ran out of time" or "couldn't be reached".
export const modelTrouble = () => (store.getStore()?.models?.reason === "time" ? "ran out of time" : "couldn't be reached");

// What the household should know about how this answer was made. `answered`:
// whether the agents got as far as an answer (otherwise the notice is about
// reading the question).
export function questionNotices(answered: boolean): string[] {
  const q = store.getStore();
  if (!q) return [];
  const notices: string[] = [];
  if (q.models) {
    const limit = q.deadline - q.started;
    const span = limit % 60_000 ? `${Math.round(limit / 1000)}-second` : `${limit / 60_000}-minute`;
    const why = q.models.reason === "time" ? `they took longer than the ${span} limit` : q.models.why;
    notices.push(
      answered
        ? `The AI models couldn't finish this answer (${why}), so code completed it from the measurements. Every figure and verdict is still checked; the wording is plainer, and household notes may not be linked.`
        : `The AI models couldn't be used (${why}), so the question was read by keyword rules alone.`,
    );
  }
  if (q.zetaris && answered) notices.push(`Zetaris couldn't be used (${q.zetaris}), so this answer read the local SAMPLE copy of the same data.`);
  return notices;
}
