import React from "react";
import { FootageScene, Hi, beatsSeconds, type Beat } from "../ui";

// Each recorded clip as a series of beats: one thing to look at, one caption.
// Beat times are in the clip's seconds; focus rectangles are clip pixels,
// measured from the frames.

type Cut = { clip: string; beats: Beat[] };

const LIVE_BADGE = "Live run, sped up";

// A real live run (Zetaris, Nightshift, NVIDIA Nemotron).
export const LIVE: Cut = {
  clip: "live-gas",
  beats: [
    { from: 0.6, to: 4.4, focus: [20, 150, 560, 700], text: "Tap a bill to ask why it changed." },
    { from: 4.4, to: 14, speed: 4, focus: [590, 410, 1900, 600], badge: LIVE_BADGE, text: "Scout checks the question and signs a contract for this bill." },
    { from: 14, to: 36, speed: 7, focus: [590, 610, 1900, 700], badge: LIVE_BADGE, text: <>The orchestrator, <Hi>Nemotron Ultra</Hi>, plans the investigation.</> },
    { from: 36, to: 46, speed: 5, badge: LIVE_BADGE, text: <>Specialists on <Hi>Nemotron Lightning</Hi> test each cause against Zetaris.</> },
    { from: 46, to: 72, speed: 8, focus: [590, 600, 1900, 990], badge: LIVE_BADGE },
    { from: 72, to: 86.6, speed: 5, focus: [590, 505, 1900, 590], badge: LIVE_BADGE, text: "The orchestrator reviews what they found, and closes the case." },
    { from: 86.6, to: 91.7, speed: 1.4, focus: [590, 810, 1900, 1000], badge: LIVE_BADGE, text: <>The checker found a problem in the first draft. <Hi>The writer fixed it.</Hi></> },
    { from: 91.7, to: 94.2, text: "The answer arrives, every figure checked in code." },
  ],
};

export const ANSWER: Cut = {
  clip: "answer-gas",
  beats: [
    { from: 2.3, to: 4.2, text: null },
    { from: 4.2, to: 6.6, focus: [590, 30, 1890, 290], text: "January's gas bill went up £32.18." },
    { from: 6.6, to: 9.0, speed: 0.8, focus: [590, 330, 1890, 620], text: <>Every pound is accounted for. <Hi>Code measured each figure.</Hi></> },
    { from: 9.0, to: 12.0, focus: [1030, 90, 1910, 430], text: "Tap a figure: it was measured from these two queries." },
    { from: 12.0, to: 14.6, focus: [1030, 180, 1910, 430], text: <>Each is a read-only query that <Hi>Zetaris</Hi> ran.</> },
    { from: 14.6, to: 17.0, focus: [1030, 460, 1910, 700], text: <>A <Hi>SHA-256</Hi> of its rows lets anyone check the data.</> },
    { from: 18.2, to: 19.5, speed: 1.3, text: null },
    { from: 19.5, to: 21.6, speed: 0.8, focus: [590, 40, 1240, 640], text: "Where the £32.18 went: the parts add up to the penny." },
    { from: 21.6, to: 23.5, speed: 0.75, focus: [1260, 40, 1890, 760], text: "Why it changed: each cause tested, supported or ruled out." },
  ],
};

const T = "Transparency";
export const TRANSPARENCY: Cut = {
  clip: "transparency",
  beats: [
    { from: 6.1, to: 9.3, focus: [590, 140, 1800, 530], badge: T, text: "How the agents worked it out: the orchestrator's plan, a task per specialist." },
    { from: 9.3, to: 10.9, speed: 1.6, badge: T },
    { from: 10.9, to: 13.6, focus: [590, 300, 1870, 710], badge: T, text: "Then each round: the specialists, the review, the writer, the checker." },
    { from: 21.2, to: 23.3, speed: 1.4, badge: T, text: null },
    { from: 23.3, to: 26.0, focus: [590, 40, 1890, 520], badge: T, text: "How this answer was made: every step, who ran it, and which model." },
    { from: 26.0, to: 27.6, speed: 1.6, badge: T },
    { from: 27.6, to: 30.4, focus: [590, 370, 1890, 930], badge: T, text: <>Each model call has its <Hi>Nightshift receipt</Hi>; each read was a Zetaris query.</> },
    { from: 30.5, to: 32.4, speed: 1.3, badge: T, text: null },
    { from: 32.4, to: 35.4, focus: [590, 130, 1890, 830], badge: T, text: "The Evidence tab: every query the answer rests on, all read-only." },
    { from: 35.4, to: 38.2, focus: [1030, 110, 1910, 450], badge: T, text: "Open one to see the exact SQL Zetaris ran." },
    { from: 38.2, to: 40.5, speed: 0.85, focus: [1030, 490, 1910, 720], badge: T, text: <>The rows it returned, and a <Hi>SHA-256</Hi> of them.</> },
  ],
};

export const HEATPUMP: Cut = {
  clip: "heatpump",
  beats: [
    { from: 1.0, to: 2.8, text: null },
    { from: 2.8, to: 5.0, speed: 0.85, focus: [590, 40, 1890, 290], text: "April's electricity bill went down £7.06." },
    { from: 5.0, to: 8.0, focus: [590, 480, 1890, 640], text: "But use went up 13% beyond the weather, and gas use fell 91%." },
    { from: 8.0, to: 9.4, text: null },
    { from: 9.4, to: 13.4, focus: [20, 20, 560, 700], text: <>Add what the bills can&apos;t show. It&apos;s kept in <Hi>Meterless H-MEM</Hi>.</> },
    { from: 13.4, to: 16.8, speed: 1.5, text: null },
    { from: 16.8, to: 19.8, focus: [590, 520, 1890, 610], text: "Asked again, the answer cites the note, M1, for the switch to electric heating." },
    { from: 19.8, to: 23.9, speed: 1.2, focus: [1030, 100, 1910, 450], text: "The note is used for two causes: use beyond the weather, and switched fuel." },
  ],
};

export const WATER: Cut = {
  clip: "water",
  beats: [
    { from: 1.4, to: 4.6, speed: 1.4, text: null },
    { from: 4.6, to: 6.6, speed: 0.8, focus: [590, 40, 1890, 290], text: "Water went up £61.28 over June and July." },
    { from: 6.6, to: 9.1, speed: 0.85, focus: [590, 350, 1890, 600], text: "Warmer weather explains £12.63. The rest is use beyond the weather." },
    { from: 9.1, to: 10.9, speed: 1.5, text: null },
    { from: 10.9, to: 12.2, speed: 0.5, focus: [1260, 160, 1890, 330], text: <>Up and staying up, with no note to explain it: <Hi>a possible leak</Hi>.</> },
    { from: 12.2, to: 13.5, speed: 0.45, focus: [590, 580, 1240, 780], text: "And how to check: read the water meter twice, 30 minutes apart." },
  ],
};

// Live: ask about a bill that isn't there yet, add it, and the agents explain it.
export const ADDBILL: Cut = {
  clip: "addbill",
  beats: [
    { from: 0.8, to: 5.6, speed: 1.3, focus: [590, 150, 1900, 400], text: "Ask about a bill that isn't there yet." },
    { from: 5.6, to: 9.6, speed: 1.25, focus: [590, 500, 1900, 760], text: "It says the bill is missing, and offers to add it." },
    { from: 9.6, to: 12.6, speed: 1.15, focus: [590, 30, 1890, 250], text: "The form starts where the latest bill ended." },
    { from: 12.6, to: 13.4, text: null },
    { from: 13.4, to: 15.6, speed: 0.8, focus: [590, 20, 1890, 430], text: "Copy in the figures from the bill. Here, example figures." },
    { from: 15.6, to: 19.6, focus: [590, 580, 1890, 800], text: <>Code checks the charges add up, then the bill goes into <Hi>Zetaris</Hi>.</> },
    { from: 19.6, to: 45, speed: 10, focus: [590, 30, 1890, 600], badge: LIVE_BADGE, text: "Then the agents explain it, live." },
    { from: 45, to: 172, speed: 22, focus: [590, 520, 1890, 1020], badge: LIVE_BADGE, text: "Specialists test each cause, with October's bill now in Zetaris." },
    { from: 172, to: 178.2, speed: 3, badge: LIVE_BADGE, text: null },
    { from: 178.2, to: 180.8, focus: [20, 0, 560, 230], text: "October is on the chart now…" },
    { from: 180.8, to: 184.3, focus: [590, 30, 1890, 560], text: "…and explained, every figure with its evidence." },
  ],
};

export const seconds = (cut: Cut) => beatsSeconds(cut.beats);

export const Cutaway: React.FC<{ cut: Cut }> = ({ cut }) => <FootageScene clip={cut.clip} beats={cut.beats} />;
