export function Examples({ examples, onAsk }: { examples: string[]; onAsk: (question: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Example questions">
      {examples.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onAsk(q)}
          className="rounded-full border border-line bg-surface px-[11px] py-1 text-left text-[0.86rem] text-ink-2 hover:border-accent hover:text-ink"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
