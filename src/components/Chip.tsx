import type { Answer } from "@/lib/types";

// A citation: E# opens the query behind a number, M# opens a household note.
export function Chip({ refId, answer, onOpen }: { refId: string; answer: Answer; onOpen: (ref: string) => void }) {
  const isNote = refId.startsWith("M");
  const evidence = isNote ? undefined : answer.evidence.find((e) => e.id === refId);
  const label = isNote ? `Household note ${refId}` : `Evidence ${refId}${evidence ? `: ${evidence.title}` : ""}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(refId)}
      aria-label={label}
      title={label}
      className={`mx-px inline-block rounded-[5px] border px-[5px] py-[3px] align-[0.15em] font-mono text-[0.7rem] leading-none ${
        isNote
          ? "border-transparent bg-accent-wash text-ink"
          : "border-line bg-surface-2 text-ink-2 hover:border-accent hover:text-ink"
      }`}
    >
      {refId}
    </button>
  );
}

export function Chips({ refs, answer, onOpen }: { refs: string[]; answer: Answer; onOpen: (ref: string) => void }) {
  return refs.map((ref) => <Chip key={ref} refId={ref} answer={answer} onOpen={onOpen} />);
}
