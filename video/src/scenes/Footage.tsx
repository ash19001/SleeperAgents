import React from "react";
import { FootageScene, Hi, segmentsSeconds, type Line, type Segment, type Shot } from "../ui";

// Each recorded clip, cut to the moments that matter. Segment times are in the
// clip's seconds; shots and lines are in the scene's seconds.
type Cut = { clip: string; segments: Segment[]; shots?: Shot[]; lines: Line[]; badge?: { from: number; to: number; text: string } };

const FULL = { x: 960, y: 540, z: 1 };

// A real live run (Zetaris, Nightshift, NVIDIA Nemotron), sped up.
export const LIVE: Cut = {
  clip: "live-gas",
  segments: [
    { from: 0.6, to: 4.6, speed: 1 },
    { from: 4.6, to: 83, speed: 7 },
    { from: 83, to: 94, speed: 2 },
  ],
  shots: [
    { t: 0, ...FULL },
    { t: 4.2, ...FULL },
    { t: 5.4, x: 1250, y: 560, z: 1.22 },
    { t: 19.2, x: 1250, y: 560, z: 1.22 },
    { t: 20.2, ...FULL },
  ],
  badge: { from: 4.2, to: 19.6, text: "Live run, sped up" },
  lines: [
    { from: 0.3, to: 4.0, text: "Tap a bill to ask why it changed." },
    { from: 4.0, to: 8.6, text: <>Scout signs a contract for this bill. <Hi>Nemotron Ultra</Hi> plans the work.</> },
    { from: 8.6, to: 15.4, text: <>Specialists on <Hi>Nemotron Lightning</Hi> test each cause against Zetaris.</> },
    { from: 15.4, to: 20.7, text: <>The checker found a problem in the first draft. <Hi>The writer fixed it.</Hi></> },
  ],
};

export const ANSWER: Cut = {
  clip: "answer-gas",
  segments: [
    { from: 2.3, to: 8.95, speed: 1 },
    { from: 8.95, to: 17.1, speed: 1 },
    { from: 18.2, to: 23.5, speed: 1.25 },
  ],
  shots: [
    { t: 0, ...FULL },
    { t: 2.0, ...FULL },
    { t: 3.0, x: 1190, y: 420, z: 1.3 },
    { t: 6.2, x: 1190, y: 420, z: 1.3 },
    { t: 7.0, ...FULL },
    { t: 10.2, ...FULL },
    { t: 11.0, x: 1500, y: 420, z: 1.35 },
    { t: 14.6, x: 1500, y: 420, z: 1.35 },
    { t: 15.4, ...FULL },
  ],
  lines: [
    { from: 0.2, to: 6.6, text: <>Every pound accounted for, to the penny. <Hi>Code measured each figure.</Hi></> },
    { from: 6.6, to: 10.4, text: "Tap a figure to see where it came from." },
    { from: 10.4, to: 14.8, text: <>The exact read-only query <Hi>Zetaris</Hi> ran, with a SHA-256 of its rows.</> },
    { from: 14.8, to: 19.0, text: "Each cause is tested: supported, ruled out, or not enough data." },
  ],
};

// Transparency: the round-by-round view, every step with its receipt, and
// the Evidence tab with one query opened.
export const TRANSPARENCY: Cut = {
  clip: "transparency",
  segments: [
    { from: 6.1, to: 12.0, speed: 1 },
    { from: 21.2, to: 30.4, speed: 1.25 },
    { from: 30.5, to: 40.5, speed: 1 },
  ],
  shots: [
    { t: 0, ...FULL },
    { t: 1.0, ...FULL },
    { t: 2.0, x: 1240, y: 480, z: 1.18 },
    { t: 5.6, x: 1240, y: 480, z: 1.18 },
    { t: 6.4, ...FULL },
    { t: 17.6, ...FULL },
    { t: 18.6, x: 1500, y: 430, z: 1.3 },
    { t: 23.3, x: 1500, y: 430, z: 1.3 },
  ],
  badge: { from: 0.3, to: 4.8, text: "Transparency" },
  lines: [
    { from: 0.2, to: 5.9, text: "How the agents worked it out: the plan, a task per specialist, each round." },
    { from: 5.9, to: 13.3, text: <>Every step of the answer, with its model and its <Hi>Nightshift receipt</Hi>.</> },
    { from: 13.3, to: 17.9, text: "The Evidence tab: every read-only Zetaris query the answer rests on." },
    { from: 17.9, to: 23.3, text: <>Each opens to its SQL, the rows returned, and a <Hi>SHA-256</Hi> of those rows.</> },
  ],
};

export const HEATPUMP: Cut = {
  clip: "heatpump",
  segments: [
    { from: 1.0, to: 8.0, speed: 1.15 },
    { from: 8.0, to: 15.6, speed: 1.3 },
    { from: 15.6, to: 23.9, speed: 1 },
  ],
  shots: [
    { t: 0, ...FULL },
    { t: 1.6, ...FULL },
    { t: 2.6, x: 1190, y: 520, z: 1.25 },
    { t: 5.4, x: 1190, y: 520, z: 1.25 },
    { t: 6.2, ...FULL },
  ],
  lines: [
    { from: 0.2, to: 6.1, text: "April went down overall, but electricity use rose 13% and gas use fell 91%." },
    { from: 6.1, to: 12.0, text: <>Add what the bills can&apos;t show. The note is kept in <Hi>Meterless H-MEM</Hi>.</> },
    { from: 12.0, to: 20.2, text: "Asked again, the answer cites the note for the switch to electric heating." },
  ],
};

export const WATER: Cut = {
  clip: "water",
  segments: [{ from: 1.4, to: 13.5, speed: 1.1 }],
  shots: [
    { t: 0, ...FULL },
    { t: 2.4, ...FULL },
    { t: 3.4, x: 1190, y: 470, z: 1.25 },
    { t: 6.6, x: 1190, y: 470, z: 1.25 },
    { t: 7.4, ...FULL },
  ],
  lines: [
    { from: 0.2, to: 5.2, text: "Water went up £61.28. Warmer weather explains £12.63 of it." },
    { from: 5.2, to: 11.0, text: <>The rest is use beyond the weather, up and staying up: <Hi>a possible leak</Hi>.</> },
  ],
};

// Live: ask about a bill that isn't there yet, add it, and the agents explain it.
export const ADDBILL: Cut = {
  clip: "addbill",
  segments: [
    { from: 0.8, to: 10.0, speed: 1.4 },
    { from: 10.0, to: 19.6, speed: 1.3 },
    { from: 19.6, to: 177.0, speed: 16 },
    { from: 177.0, to: 184.3, speed: 1.1 },
  ],
  shots: [
    { t: 0, ...FULL },
    { t: 14.2, ...FULL },
    { t: 15.2, x: 1250, y: 560, z: 1.22 },
    { t: 23.4, x: 1250, y: 560, z: 1.22 },
    { t: 24.4, ...FULL },
  ],
  badge: { from: 14.2, to: 23.6, text: "Live run, sped up" },
  lines: [
    { from: 0.2, to: 6.6, text: "Ask about a bill that isn't there yet, and it asks you for it." },
    { from: 6.6, to: 14.0, text: <>Code checks the figures add up, then the bill goes into <Hi>Zetaris</Hi>.</> },
    { from: 14.0, to: 23.8, text: "Then the agents explain it, live." },
    { from: 23.8, to: 30.4, text: "October is on the chart, explained, with its evidence." },
  ],
};

export const seconds = (cut: Cut) => segmentsSeconds(cut.segments);

export const Cutaway: React.FC<{ cut: Cut }> = ({ cut }) => <FootageScene clip={cut.clip} segments={cut.segments} shots={cut.shots} lines={cut.lines} badge={cut.badge} />;
