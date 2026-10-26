// Example questions as a row of plain links under the ask field.
export function Examples({ examples, onAsk }: { examples: string[]; onAsk: (question: string) => void }) {
  return (
    <div className="flex items-baseline gap-x-3">
      <span className="flex-none text-sm text-muted">Try:</span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Example questions">
        {examples.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="py-0.5 text-left text-[0.92rem] text-link underline decoration-transparent underline-offset-[0.2em] hover:text-ink hover:decoration-current"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
