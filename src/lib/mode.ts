import type { Mode } from "./types";

// preview: hand-written SAMPLE answers (until the agent exists)
// replay:  answers recorded from earlier agent runs (eval/answers/)
// live:    the agent answers each question
export function getMode(): Mode {
  const mode = process.env.WHYBILL_MODE;
  return mode === "live" || mode === "replay" ? mode : "preview";
}
