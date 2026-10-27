import React from "react";
import { Composition, Folder } from "remotion";
import { Close, Loop, Meterless, Problem, Results, Title, Zetaris } from "./scenes/Cards";
import { FPS, TOTAL, WhyMyBill } from "./Video";

const stills: [string, React.FC, number][] = [
  ["Title", Title, 6],
  ["Problem", Problem, 10.5],
  ["Loop", Loop, 19],
  ["Zetaris", Zetaris, 13],
  ["Meterless", Meterless, 13],
  ["Results", Results, 10],
  ["Close", Close, 8],
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="WhyMyBill" component={WhyMyBill} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} />
    <Folder name="Scenes">
      {stills.map(([id, component, s]) => (
        <Composition key={id} id={id} component={component} width={1920} height={1080} fps={FPS} durationInFrames={Math.round(s * FPS)} />
      ))}
    </Folder>
  </>
);
