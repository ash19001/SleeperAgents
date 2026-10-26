// Shared class lists for buttons. The main action is yellow with navy text;
// quiet buttons are outlined. Each is complete on its own, so no two
// padding or size classes ever compete on one element.
export const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold whitespace-nowrap text-primary-ink transition-colors hover:bg-primary-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

export const BUTTON_LARGE =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[1.05rem] font-bold whitespace-nowrap text-primary-ink transition-colors hover:bg-primary-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const QUIET =
  "inline-flex items-center gap-1.5 rounded-md border border-control bg-surface font-semibold text-ink transition-colors hover:border-ink-2 hover:bg-surface-2 active:translate-y-px aria-pressed:border-selected aria-pressed:bg-select";
export const BUTTON_QUIET = `${QUIET} h-10 px-4`;
export const BUTTON_QUIET_SMALL = `${QUIET} h-8 px-2.5 text-sm`;

// Fields share one look: white, a control border, a yellow focus ring.
export const FIELD =
  "w-full rounded-md border border-control bg-surface px-3 text-ink placeholder:text-muted focus:border-selected focus:outline-3 focus:outline-offset-0 focus:outline-hl";

// Section headings inside the panels and the answer sheet.
export const HEADING = "text-[1.02rem] leading-snug font-bold text-ink";

// The yellow highlighter swipe for a figure that answers the question.
export const MARKER = "marker font-bold";
