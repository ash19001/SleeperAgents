// Renders chosen frames of the main composition as PNGs, for checking.
// node scripts/stills.mjs 30 400 900 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const id = process.env.COMP ?? "WhyMyBill";
const composition = await selectComposition({ serveUrl, id });
console.log(id, composition.durationInFrames, "frames");
// Frames can be given in seconds with an "s" suffix.
for (const f of process.argv.slice(2).map((a) => (a.endsWith("s") ? Math.round(parseFloat(a) * 30) : Number(a)))) {
  await renderStill({ composition, serveUrl, frame: f, output: path.join(root, `out/stills/${id}-${f}.png`), scale: 0.5 });
  console.log("frame", f);
}
