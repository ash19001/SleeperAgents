import type { ReactNode } from "react";

// The answer sheet's frame: a navy strip like a statement's letterhead, then
// the body. When `heading` is set the strip's title is the sheet's heading.
export function Sheet({ title, meta, heading, children }: { title: string; meta?: ReactNode; heading?: boolean; children: ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 bg-letterhead px-5 py-3 text-letterhead-ink sm:px-7">
        {heading ? (
          <h2 id="answer-title" className="text-[1.05rem] font-bold">{title}</h2>
        ) : (
          <p className="font-bold">{title}</p>
        )}
        {meta && <p className="text-sm text-letterhead-2">{meta}</p>}
      </div>
      <div className="grid gap-6 px-5 pt-6 pb-7 sm:px-7">{children}</div>
    </>
  );
}
