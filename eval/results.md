# Evaluation results

SAMPLE household data throughout. Details: `eval/triage_results.md` and `eval/scout_harness_report.md`.

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
