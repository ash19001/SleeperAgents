import type { Utility, Verdict } from "./types";

export const UTILITIES: Record<Utility, { name: string; cadence: string }> = {
  electricity: { name: "Electricity", cadence: "monthly" },
  gas: { name: "Gas", cadence: "monthly" },
  water: { name: "Water", cadence: "every two months" },
};

export const CAUSE_NAMES: Record<string, string> = {
  C1: "Unit price changed",
  C2: "Standing charge changed",
  C3: "Bill covered more or fewer days",
  C4: "Estimated reading corrected",
  C5: "Credit or one-off charge",
  C6: "Weather",
  C7: "Use changed beyond the weather",
  C8: "Possible leak",
  C9: "Switched fuel",
};

export const PART_NAMES: Record<string, string> = {
  period: "Days on the bill",
  weather: "Weather",
  usage_other: "Use beyond the weather",
  unit_price: "Unit price",
  standing: "Standing charge",
  estimate: "Estimated reading",
  oneoff: "Credits and one-off charges",
};

export const VERDICTS: Record<Verdict, string> = {
  supported: "Supported",
  ruled_out: "Ruled out",
  inconclusive: "Not enough data",
};

export const ROUTES: Record<string, string> = {
  nightshift: "via Meterless Nightshift",
  zetaris: "Zetaris, read-only SQL",
  "h-mem": "Meterless H-MEM",
  "local-sample": "local SAMPLE file (Zetaris once registered)",
  cache: "data already read in this investigation",
  "world-model": "Meterless World Model (case file)",
  markovian: "Meterless Markovian (review rounds)",
  code: "Code, no model",
};

export const MODEL_NAMES: Record<string, string> = {
  "nvidia/nemotron-3.5-lightning-30b-a3b": "Nemotron 3.5 Lightning 30B",
  "nvidia/nemotron-3-ultra-550b-a55b": "Nemotron 3 Ultra 550B",
};
