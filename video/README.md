# Why My Bill: demo video

The hackathon demo video, made with [Remotion](https://www.remotion.dev/) from real recordings of the app. The voiceover script, timed to the scenes, is in [`../docs/DEMO-SCRIPT.md`](../docs/DEMO-SCRIPT.md).

- `src/Video.tsx`: the running order and scene lengths.
- `src/scenes/Footage.tsx`: the screen recordings, cut into segments (with speed), camera moves and captions.
- `src/scenes/Cards.tsx`: the designed scenes (title, problem, the agent loop, Zetaris, Meterless, results, close).
- `scripts/capture/`: the Playwright scripts that recorded the footage (they need `playwright-core` and the app running: live mode on port 5177, replay mode on 5178).
- `scripts/footage.mjs`: rebuilds `src/footage.ts` from the recorded clips.
- Long live takes: set `FOOTAGE_OUT` to a folder outside the project and move the clip into `public/footage/` afterwards. With frames written inside the project, two live takes lost their stream partway (the dev server's file watcher is the likely cause).
- `scripts/capture/addbill.mjs` really adds an October 2026 gas bill (`.household/added.json`) and refreshes Zetaris's cached feeds. To undo it, delete that file and the recorded October answer in `eval/answers/`, then refresh again: `node --env-file=.env.local --input-type=module -e "await (await import('./src/data/zetaris.ts')).refreshFeeds(['supplier-a-bills', 'supplier-a-reads'])"` from the repo root.

```bash
npm ci
npm run dev                                    # preview in Remotion Studio
npx remotion render WhyMyBill out/why-my-bill.mp4 --codec h264 --crf 18
```

The footage frames (`public/footage/`) and renders (`out/`) are not committed.
