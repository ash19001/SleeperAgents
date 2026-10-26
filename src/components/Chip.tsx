import type { Answer } from "@/lib/types";

// A citation: E# opens the query behind a number, M# opens a household note.
// Set small and raised like a footnote; the highlighter swipes under it on
// hover or focus.
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
      className={`relative isolate inline-block px-[2px] align-[0.42em] text-[0.68rem] leading-none font-semibold before:absolute before:inset-x-0 before:-inset-y-[2px] before:-z-10 before:origin-left before:rounded-[2px] before:bg-hl before:transition-transform before:duration-300 before:ease-out hover:text-hl-ink focus-visible:text-hl-ink ${
        isNote
          ? "py-[2px] text-ink before:scale-x-100 before:bg-hl-wash hover:before:bg-hl"
          : "text-muted before:scale-x-0 hover:before:scale-x-100 focus-visible:before:scale-x-100"
      }`}
    >
      {refId}
    </button>
  );
}

// A run of citations stays on one line.
export function Chips({ refs, answer, onOpen }: { refs: string[]; answer: Answer; onOpen: (ref: string) => void }) {
  if (!refs.length) return null;
  return <span className="ml-0.5 whitespace-nowrap">{refs.map((ref) => <Chip key={ref} refId={ref} answer={answer} onOpen={onOpen} />)}</span>;
}
