import type { Mode } from "./types";

// preview: hand-written SAMPLE answers (until the agent exists)
// replay:  answers recorded from earlier agent runs (eval/answers/)
// live:    the agent answers each question
// SAMPLE_MODE=true is the hackathon guide's name for the mode that runs with
// no Zetaris, Nightshift or keys: replay.
export function getMode(): Mode {
  if (process.env.SAMPLE_MODE === "true") return "replay";
  const mode = process.env.WHYBILL_MODE;
  return mode === "live" || mode === "replay" ? mode : "preview";
}
