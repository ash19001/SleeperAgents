# Evaluation results

SAMPLE household data throughout. Details: `eval/answers/` (recorded answers), `eval/triage_results.md` and `eval/scout_harness_report.md`.

## Whole answers (25 Oct 2026)

`npm run eval:answers` asks the whole pipeline (guard, intake, Scout contracts, orchestrators, specialists, writer, checker) about each of the 11 answer-key scenarios in `eval/scenarios.json`, the way the page does when a bar is tapped, plus the page's four example questions, April electricity with the heat pump note, and "Why did my energy bills change in April?". It scores the supported and ruled-out causes against the key.

| Run | Data | Answer key | Planted causes found | Wrongly supported | Checker | Model calls |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Local SAMPLE files | 58 of 58 | 19 of 19 | 0 of 34 | 18 of 18 answers passed on the first draft | All through Nightshift with receipts; 32 to 64 s a utility |
| 2 | Through Zetaris | 58 of 58 | 19 of 19 | 0 of 34 | 18 of 18 passed on the first draft | NVIDIA rate-limited the key: 80 calls failed with 429, so specialists often fell back to code settling their causes; 64 to 207 s a utility |

The 58 checks are the key's 53 (19 causes that must be found, 34 that must be ruled out) plus the April electricity pair again with the heat pump note, where the answer also cites the note. The control pair, where nothing should be found, had nothing supported in both runs. Every bill pair splits to the penny (`npm test`, bill model tests).

Reading the run-1 answers found two faults the checker can't see, both fixed before run 2:

- December gas said November's estimate was too high; it was too low. The writer now gets a plain line per cause saying which way it went, and must stick to it.
- November gas (one earlier bill, so no weather fit) claimed use rose 54% beyond the weather. With no fit, use-based causes are now "not enough data", and the answer says that part can't be explained yet.

Not changed: April–May water flags a possible leak (use up 17% beyond a trusted weather fit, from the sample's garden watering on dry warm days). The key doesn't cover it; it may be a false alarm, and the answer calls a leak a pattern to check, not a fault.

## Triage (25 Oct 2026)

`npm run eval:triage` runs the 25 questions in `eval/triage_cases.json` through the real triage, with the intake agent on Nemotron 3.5 Lightning via Meterless Nightshift.

| Run | Passed | Notes |
| --- | --- | --- |
| 1 | 24 of 25 | One intake slip on "sewerage"; the keyword cross-check caught it and asked which bill instead of guessing |
| 2 | 23 of 25 | Two intake calls hit NVIDIA's rate limit (429) and fell back to keywords; led to pacing and back-off in `llm.ts` |
| 3 | 25 of 25 | After pacing; 22 of 22 intake calls through Nightshift with receipts; 15 s for the set |
| 4 | 25 of 25 | After the Scout changes below; 23 of 23 intake calls through Nightshift |

## Meterless's Scout eval harness (25 Oct 2026)

Meterless publish Scout as a specification with an eval harness and no code. Ours is in `src/scout/`; the harness ran against it with `SCOUT_IMPL=src/scout/index.ts npm run evals` in `vendor/meterless/scout-intent` (their 32-example corpus v1, their 13-intent business registry, no lexicon, so our Stage-1 triggers are derived from their examples).

| Metric | First run | Final | Floor or ceiling |
| --- | --- | --- | --- |
| intent_top1 | 0.824 | 1.000 | 0.85 |
| intent_top3_recall | 1.000 | 1.000 | 0.94 |
| injection_precision | 1.000 | 1.000 | 0.90 |
| injection_recall | 0.571 | 1.000 | 0.82 |
| tool_precision | 1.000 | 1.000 | 0.80 |
| clarification_rate | 0.094 | 0.031 | max 0.25 |
| Gate | fail | **pass** | |
| Self-test, worst scan | 128.7 ms | 0.113 ms | 16 ms |

What changed between the first run and the final one, all general rather than per-example:

- Recency counts in the score only when sessions are tracked; before, a perfect keyword match topped out at 0.89, below the spec's 0.95 bar for high-risk intents.
- Verbs such as "show", "find" and "draft" are no longer treated as filler words; they tell intents apart.
- Three standard injection classes added to the guard: privilege escalation ("grant me admin"), requests to reveal credentials, and invisible or text-direction control characters.
- Stage-1 matching splits the text into words once and looks phrases up in a table, instead of one pattern per trigger.

**Caveat:** the corpus is 32 examples and the fixes above were made after seeing its misses, so the final scores overstate how well this generalises. Our own guard tests (29 blocked and allowed cases) and the 25 triage questions were run again after the changes and still pass.
