// Shared class lists for buttons. Each is complete on its own, so no two
// padding or size classes ever compete on one element.
export const BUTTON =
  "rounded-lg border border-transparent bg-accent px-4 py-2 font-bold whitespace-nowrap text-accent-ink hover:bg-accent-hover disabled:opacity-60";

const QUIET =
  "rounded-lg border border-line bg-transparent font-semibold text-ink hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-wash";
export const BUTTON_QUIET = `${QUIET} px-4 py-2`;
export const BUTTON_QUIET_SMALL = `${QUIET} inline-flex items-center gap-1.5 px-2.5 py-1 text-sm`;
