// Collects what happened while answering one question: model calls, Scout
// events and step timings. The page shows it under "How this answer was made".

import type { TraceStep } from "../lib/types.ts";

export class Trace {
  readonly steps: TraceStep[];
  private onStep?: (step: TraceStep) => void;

  // Pass a list to keep adding to an earlier trace's steps, and a listener
  // to hear each step as it lands (the page's live progress).
  constructor(steps: TraceStep[] = [], onStep?: (step: TraceStep) => void) {
    this.steps = steps;
    this.onStep = onStep;
  }

  add(step: TraceStep): TraceStep {
    step.at ??= Date.now();
    this.steps.push(step);
    this.onStep?.(step);
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
