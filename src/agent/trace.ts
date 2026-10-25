// Collects what happened while answering one question: model calls, Scout
// events and step timings. The page shows it under "How this answer was made".

import type { TraceStep } from "../lib/types.ts";

export class Trace {
  readonly steps: TraceStep[];

  // Pass a list to keep adding to an earlier trace's steps.
  constructor(steps: TraceStep[] = []) {
    this.steps = steps;
  }

  add(step: TraceStep): TraceStep {
    this.steps.push(step);
    return step;
  }

  // Runs `fn` and records how long it took, whether it succeeded or threw.
  async time<T>(step: Omit<TraceStep, "ms">, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      this.add({ ...step, ms: Date.now() - started });
    }
  }
}
