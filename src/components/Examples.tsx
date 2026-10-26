import { CornerDownRight } from "lucide-react";

export function Examples({ examples, onAsk }: { examples: string[]; onAsk: (question: string) => void }) {
  return (
    <ul className="grid gap-0.5 pt-1" aria-label="Example questions">
      {examples.map((q) => (
        <li key={q}>
          <button
            type="button"
            onClick={() => onAsk(q)}
            className="group inline-flex items-start gap-2 py-1 text-left text-[0.92rem] text-link hover:text-ink"
          >
            <CornerDownRight aria-hidden className="mt-[3px] size-3.5 flex-none text-axis group-hover:text-ink" />
            <span className="underline decoration-transparent underline-offset-[0.2em] group-hover:decoration-current">{q}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
