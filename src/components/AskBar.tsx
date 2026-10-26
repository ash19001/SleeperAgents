"use client";

import { Examples } from "./Examples";
import { BUTTON_LARGE, FIELD } from "./ui";

// The page's main control: ask why a bill changed, above the answer.
export function AskBar({ question, onQuestion, onAsk, examples, busy }: {
  question: string;
  onQuestion: (question: string) => void;
  onAsk: (question: string) => void;
  examples: string[];
  busy: boolean;
}) {
  return (
    <section aria-labelledby="ask-title">
      <form
        autoComplete="off"
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(question);
        }}
      >
        <label id="ask-title" htmlFor="question" className="text-[1.15rem] font-extrabold tracking-[-0.01em]">
          Ask why a bill changed
        </label>
        <div className="flex gap-2">
          <input
            id="question"
            name="question"
            type="text"
            value={question}
            onChange={(e) => onQuestion(e.target.value)}
            placeholder="Why did my gas bill go up in January?"
            className={`${FIELD} h-12 min-w-0 flex-1 text-[1.05rem]`}
          />
          <button type="submit" disabled={busy} className={BUTTON_LARGE}>Ask</button>
        </div>
        <Examples examples={examples} onAsk={onAsk} />
      </form>
    </section>
  );
}
