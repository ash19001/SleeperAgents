# Demo video and voiceover script (3:47)

For the video (rule 6.1: 1 to 4 minutes; show the main workflow, how the agent solves the challenge, key features, and how Zetaris and Meterless are integrated).

The video is built in `video/` (Remotion) from real browser recordings: two live runs through Zetaris, Nightshift and NVIDIA Nemotron (sped up, and labelled so), and recorded live answers in replay mode. It has no sound. Record the voiceover against it; each line below fits its scene at a steady pace (about 150 words a minute).

Each scene shows one thing at a time: the camera moves to it, the rest of the screen dims, and a caption says what it is. Say the lines in the same order as the captions.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Title | "Why My Bill: NVIDIA Nemotron agents that explain why a household bill changed, with the evidence." |
| 0:06 | The claim; the January gas bill printed line by line; "Why it changed: not stated" | "A bill tells you what you owe. Here, January's gas: a hundred and twenty-three pounds. But it never says why it changed. Colder weather, more days, a price rise, a leak?" |
| 0:17 | **Live run, sped up:** tap the bill; Scout; the orchestrator; the specialists; the review; the checker's rewrite | "Tap the bill. This is a live run, sped up. Scout checks the question and signs a contract for this bill. The orchestrator, Nemotron Ultra, plans the investigation. Specialists on Nemotron Lightning test each cause against Zetaris. The orchestrator reviews what they found and closes the case. And here the checker found a problem in the first draft; the writer fixed it." |
| 0:41 | The agent loop, one part at a time, then the whole loop | "Here's the loop behind it. A guard checks the question, and Scout signs a contract. The orchestrator sends each specialist a task, worked through its own tool loop over Zetaris. Code tests every cause; findings go into the World Model case file. Markovian review sends the work round again, and sends back any specialist code disagrees with. Then the writer drafts, and code fills in every figure." |
| 1:07 | The answer; tap £27.05; its queries; the SQL; the SHA-256; the split; the causes | "January's gas went up thirty-two pounds eighteen, and every pound is accounted for. Tap a figure to see where it came from: two read-only queries Zetaris ran, each with a fingerprint of its rows. The parts add up to the penny, and every cause is tested." |
| 1:28 | **Transparency:** the plan; each round; every step with its receipt; the Evidence tab; one query | "Everything is open to check. How the agents worked it out shows the orchestrator's plan, each specialist's task, and every round. Every step lists which model ran it, with its Nightshift receipt. And the Evidence tab lists every query the answer rests on: open one for its SQL, its rows and their fingerprint." |
| 1:52 | April electricity; the note; asked again; note M1 | "Some causes never show on a bill. April's electricity went down, but use went up thirteen percent and gas use fell ninety-one. Add a note: we installed a heat pump. It's kept in Meterless H-MEM. Ask again, and the answer cites the note for the switch to electric heating." |
| 2:13 | Water: the rise; the weather; a possible leak; how to check | "Water went up sixty-one pounds. Warmer weather explains about thirteen; the rest is use beyond the weather, up and staying up. A possible leak, and how to check." |
| 2:27 | **Add a bill, live, sped up:** the question; "That bill isn't here yet"; the form; the check; the agents; October on the chart | "Ask about a bill that isn't there yet, and it says so and offers to add it. The form starts where the last bill ended. Copy in the figures; here, example figures. Code checks the charges add up, and the bill goes into Zetaris. Then the agents explain it, live. October appears on the chart, explained, with its evidence." |
| 3:00 | Zetaris: the six sources; Zetaris; the evidence; the rule | "Zetaris is the only way the agents see data: six sources, including live Octopus prices and Open-Meteo weather, behind four views. Every agent tool is one read-only query, with its evidence." |
| 3:15 | Meterless: one part at a time | "Meterless runs through every step: Nightshift for every model call, Scout for the signed contract, World Model for the case file, Markovian for the review rounds, and H-MEM for household memory." |
| 3:29 | Results, one line at a time | "Against a planted answer key, it found all nineteen causes, wrongly supported none, and passed fifty-eight of fifty-eight checks in both full runs." |
| 3:39 | Close | "Why My Bill. Every number traced, every cause tested, every fallback said out loud." |

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

The footage (`video/public/footage/`, about 25,000 JPEG frames) isn't committed. It was recorded with a Playwright script driving the app at 1280 × 720 CSS pixels and a scale of 1.5 (1920 × 1080 frames), with a drawn cursor; each clip's `frames.json` gives every frame's time. `node scripts/footage.mjs` rebuilds `src/footage.ts` from those files.
