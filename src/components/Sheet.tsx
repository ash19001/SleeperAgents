import type { ReactNode } from "react";

// The answer's frame: its heading with a plain line of context under it, then
// the body. No box around it: space and rules do the grouping.
export function Sheet({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        <h2 id="answer-title" className="text-[clamp(1.4rem,1.1rem+0.9vw,1.8rem)] leading-tight font-extrabold tracking-[-0.015em]">{title}</h2>
        {meta && <p className="text-[0.95rem] text-muted">{meta}</p>}
      </header>
      {children}
    </div>
  );
}
