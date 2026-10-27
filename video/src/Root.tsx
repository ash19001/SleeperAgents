import React from "react";
import { Composition, Folder } from "remotion";
import { Close, LOOP_FRAMES, Loop, METERLESS_FRAMES, Meterless, Problem, RESULTS_FRAMES, Results, Title, ZETARIS_FRAMES, Zetaris } from "./scenes/Cards";
import { ADDBILL, ANSWER, Cutaway, HEATPUMP, LIVE, TRANSPARENCY, WATER, seconds } from "./scenes/Footage";
import { FPS, TOTAL, WhyMyBill } from "./Video";

const cuts = { Live: LIVE, Answer: ANSWER, Transparency: TRANSPARENCY, HeatPump: HEATPUMP, Water: WATER, AddBill: ADDBILL };

const stills: [string, React.FC, number][] = [
  ["Title", Title, 180],
  ["Problem", Problem, 360],
  ["Loop", Loop, LOOP_FRAMES],
  ["Zetaris", Zetaris, ZETARIS_FRAMES],
  ["Meterless", Meterless, METERLESS_FRAMES],
  ["Results", Results, RESULTS_FRAMES],
  ["Close", Close, 240],
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="WhyMyBill" component={WhyMyBill} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} />
    <Folder name="Scenes">
      {stills.map(([id, component, s]) => (
        <Composition key={id} id={id} component={component} width={1920} height={1080} fps={FPS} durationInFrames={s} />
      ))}
    </Folder>
    <Folder name="Footage">
      {Object.entries(cuts).map(([id, cut]) => (
        <Composition key={id} id={id} component={() => <Cutaway cut={cut} />} width={1920} height={1080} fps={FPS} durationInFrames={Math.round(seconds(cut) * FPS)} />
      ))}
    </Folder>
  </>
);
