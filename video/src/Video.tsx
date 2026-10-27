import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { Close, Loop, Meterless, Problem, Results, Title, Zetaris } from "./scenes/Cards";
import { ANSWER, Cutaway, HEATPUMP, LIVE, WATER, WORKED, seconds } from "./scenes/Footage";

export const FPS = 30;
const FADE = 12;
const f = (s: number) => Math.round(s * FPS);

// The running order. Footage scenes last as long as their cuts.
export const SCENES: { name: string; frames: number; el: React.ReactNode }[] = [
  { name: "Title", frames: f(6), el: <Title /> },
  { name: "Problem", frames: f(10.5), el: <Problem /> },
  { name: "Live run", frames: f(seconds(LIVE)), el: <Cutaway cut={LIVE} /> },
  { name: "The loop", frames: f(19), el: <Loop /> },
  { name: "The answer", frames: f(seconds(ANSWER)), el: <Cutaway cut={ANSWER} /> },
  { name: "How it was worked out", frames: f(seconds(WORKED)), el: <Cutaway cut={WORKED} /> },
  { name: "Heat pump note", frames: f(seconds(HEATPUMP)), el: <Cutaway cut={HEATPUMP} /> },
  { name: "Water", frames: f(seconds(WATER)), el: <Cutaway cut={WATER} /> },
  { name: "Zetaris", frames: f(13), el: <Zetaris /> },
  { name: "Meterless", frames: f(13), el: <Meterless /> },
  { name: "Results", frames: f(10), el: <Results /> },
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
