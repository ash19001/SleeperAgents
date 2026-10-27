# Demo video and voiceover script (2:39)

For the video (rule 6.1: 1 to 4 minutes; show the main workflow, how the agent solves the challenge, key features, and how Zetaris and Meterless are integrated).

The video is built in `video/` (Remotion) from real browser recordings: one live run through Zetaris, Nightshift and NVIDIA Nemotron (sped up, and labelled so), and recorded live answers in replay mode. It has no sound. Record the voiceover against it; each line below fits its scene at an easy pace (about 140 words a minute).

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Title | "Why My Bill: Nemotron agents that explain why a household bill changed, with the evidence." |
| 0:06 | The problem: the January gas bill, "Why it changed: not stated" | "A bill tells you what you owe, never why it changed. Colder weather, more days, a price rise, a leak? Each needs a different fix." |
| 0:16 | **Live run, sped up:** tap the January gas bar; the agents work | "Tap the January gas bill. This is a live run, sped up. Scout signs a contract for this bill, and Nemotron Ultra plans the investigation. Lightning specialists test each cause against Zetaris, in parallel. The checker found a problem in the first draft; the writer fixed it." |
| 0:36 | The agent loop, drawn step by step | "Under the hood it's a loop. The orchestrator sends out tasks, each specialist runs its own tool loop, code measures every cause, and findings go into the World Model case file. Markovian review sends work round again when it needs to. Agents investigate; code decides every number." |
| 0:55 | The answer; tap £27.05; the query and its SHA-256; the split | "Every pound is accounted for, to the penny. The writer only uses placeholders; code fills in each figure. Tap one to see the exact read-only query Zetaris ran, with a fingerprint of its rows. Every cause is tested: supported, ruled out, or not enough data." |
| 1:13 | How the agents worked it out; how this answer was made | "You can see how the agents worked it out: the plan, each round, each review. And every Nemotron call goes through Meterless Nightshift, with a receipt." |
| 1:26 | April electricity; add the heat pump note; ask again; note M1 | "Some causes never show on a bill. In April, electricity went down overall, but use went up. Add a note that you installed a heat pump; it's stored in Meterless H-MEM. Ask again, and the answer links the switch to electric heating to your note." |
| 1:46 | Water, June and July: a possible leak | "Water went up sixty-one pounds. Warmer weather explains some of it; the rest is use that's up and staying up. A possible leak, and how to check." |
| 1:56 | Zetaris: six sources, four views, read-only evidence | "Zetaris is the only way the agents see data: six sources, including live Octopus prices and Open-Meteo weather, behind four views. Every tool is one read-only query." |
| 2:09 | Meterless: five parts, each with its proof | "Meterless runs through every step: Nightshift for every model call, Scout for the signed contract, World Model for the case file, Markovian for the review rounds, and H-MEM for household memory." |
| 2:22 | Results | "Against a planted answer key, it found all nineteen causes, wrongly supported none, and passed fifty-eight of fifty-eight checks in both full runs." |
| 2:31 | Close | "Why My Bill. Every number traced, every cause tested, every fallback said out loud. Try it from the repo; no keys needed." |

## Adding the voiceover

- Record each line on its own, then line it up with its scene. The scene times above are where each line starts.
- If a line runs long, the scenes with screen recordings can be slowed in `video/src/scenes/Footage.tsx` (each cut's `speed`), and the designed scenes lengthened in `video/src/Video.tsx`. Then render again (below).
- To mix the voiceover into the video instead of in an editor, put it at `video/public/voiceover.mp3` and add `<Audio src={staticFile("voiceover.mp3")} />` (from `@remotion/media`) to `WhyMyBill` in `video/src/Video.tsx`.

## Rendering

```bash
cd video
npm ci
npm run dev                                   # Remotion Studio, to preview
npx remotion render WhyMyBill out/why-my-bill.mp4 --codec h264 --crf 18
```

The footage (`video/public/footage/`, about 10,000 JPEG frames) isn't committed. It was recorded with a Playwright script driving the app at 1280 × 720 CSS pixels and a scale of 1.5 (1920 × 1080 frames), with a drawn cursor; each clip's `frames.json` gives every frame's time. `node scripts/footage.mjs` rebuilds `src/footage.ts` from those files.
