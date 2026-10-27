import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { Close, LOOP_FRAMES, Loop, METERLESS_FRAMES, Meterless, Problem, RESULTS_FRAMES, Results, Title, ZETARIS_FRAMES, Zetaris } from "./scenes/Cards";
import { ADDBILL, ANSWER, Cutaway, HEATPUMP, LIVE, TRANSPARENCY, WATER, seconds } from "./scenes/Footage";

export const FPS = 30;
const FADE = 12;
const f = (s: number) => Math.round(s * FPS);

// The running order. Footage scenes last as long as their cuts.
export const SCENES: { name: string; frames: number; el: React.ReactNode }[] = [
  { name: "Title", frames: f(6), el: <Title /> },
  { name: "Problem", frames: f(12), el: <Problem /> },
  { name: "Live run", frames: f(seconds(LIVE)), el: <Cutaway cut={LIVE} /> },
  { name: "The loop", frames: LOOP_FRAMES, el: <Loop /> },
  { name: "The answer", frames: f(seconds(ANSWER)), el: <Cutaway cut={ANSWER} /> },
  { name: "Transparency", frames: f(seconds(TRANSPARENCY)), el: <Cutaway cut={TRANSPARENCY} /> },
  { name: "Heat pump note", frames: f(seconds(HEATPUMP)), el: <Cutaway cut={HEATPUMP} /> },
  { name: "Water", frames: f(seconds(WATER)), el: <Cutaway cut={WATER} /> },
  { name: "Add a bill", frames: f(seconds(ADDBILL)), el: <Cutaway cut={ADDBILL} /> },
  { name: "Zetaris", frames: ZETARIS_FRAMES, el: <Zetaris /> },
  { name: "Meterless", frames: METERLESS_FRAMES, el: <Meterless /> },
  { name: "Results", frames: RESULTS_FRAMES, el: <Results /> },
  { name: "Close", frames: f(8), el: <Close /> },
];

export const TOTAL = SCENES.reduce((s, x) => s + x.frames, 0) - FADE * (SCENES.length - 1);

export const WhyMyBill: React.FC = () => (
  <TransitionSeries>
    {SCENES.flatMap((s, i) => [
      ...(i ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />] : []),
      <TransitionSeries.Sequence key={s.name} name={s.name} durationInFrames={s.frames}>
        {s.el}
      </TransitionSeries.Sequence>,
    ])}
  </TransitionSeries>
);
