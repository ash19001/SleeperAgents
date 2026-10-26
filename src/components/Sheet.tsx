"use client";

import { MessageCircleQuestion } from "lucide-react";
import type { ReactNode } from "react";

// On phones the question field sits below the answer: this brings it back.
function askAnother() {
  const field = document.getElementById("question");
  if (!field) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  field.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  field.focus({ preventScroll: true });
}

// The answer sheet's frame: a navy strip like a statement's letterhead, then
// the body. When `heading` is set the strip's title is the sheet's heading.
// On phones the strip also offers a way back to the question field.
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
        <button type="button" onClick={askAnother} className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-letterhead-ink hover:bg-white/10 lg:hidden">
          <MessageCircleQuestion aria-hidden className="size-4" />Ask another question
        </button>
      </div>
      <div className="grid gap-6 px-5 pt-6 pb-7 sm:px-7">{children}</div>
    </>
  );
}
