# Progress

## Sat 24 Oct 2026

**Phase 0.** Repo is `ash19001/SleeperAgents` (not `why-my-bill`). Zetaris, NVIDIA key, Nightshift (M1-M4 build, Mac M4 Pro), Docker, Node 25, Python 3.14 done.
Still open: step 1 (read rules 05 and 06) and step 7 (household town, `HOME_LAT`/`HOME_LON`).

**Phase 1, steps 1-4.** Zetaris runs locally (UI :3000, REST :8888). `getting-started` cloned to `~/Projects/getting-started` with its own `.env.local`. Preflight REST checks pass, `SELECT 1` returns 1 through `query_zetaris.py`, Lightning databases: `NY_TAXI`, `TPCDS_DB`.
Preflight also fails `ZETARIS_USERNAME`/`ZETARIS_PASSWORD`; those are only for JDBC and the OpenAPI spec, which we don't use. Step 5 (registration notes) still to do.

**Phase 2.** `npm run smoke:llm` passes: Nightshift and NVIDIA direct both answer with `nvidia/nemotron-3.5-lightning-30b-a3b`.
Nightshift's token file is `runtime-token` in `~/Library/Application Support/ai.meterless.nightshift.m1m4/`, not `proxy-token`.

`/models` lists `meterless/auto|fast|deep|cheap|local|fusion`, six `nvidia/*` models and eight on-device `webllm/*` models. Routing tested:

| Requested through Nightshift | Answered by |
| --- | --- |
| every `meterless/*` mode | `webllm/Llama-3.2-1B-Instruct` (on device), even with NVIDIA added |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | same model, about 2-4 s; used for `MODEL_FAST` |
| `nvidia/nemotron-3-ultra-550b-a55b` | same model, about 10 s; used for `MODEL_DEEP`. Reply contains its reasoning ending in `</think>`, which `llm.ts` must strip |
| `nvidia/nemotron-3-super-120b-a12b` (plan's deep model) | 404, not available to this NVIDIA account |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1` | 404 |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 410, endpoint retired |

So `.env.example` names the Nemotron models explicitly instead of `meterless/fast|deep`. Every Nightshift reply carries a `meterless.compute_receipt.v1` receipt (`receipt_id`, `routed_model`, `winning_route`, phases), which the trace can show.

**Phase 7 (early, backend on hold).** `web/index.html` built: bills chart per utility, question box, answer sheet (£ split, causes, ruled out, next steps, feedback, trace), evidence drawer, household notes. No server yet, so it runs in preview mode on `web/preview_SAMPLE.js`.
Preview answers are hand-written SAMPLEs from `scripts/make_preview_SAMPLE.ts` (bill-model splits, all sum to the penny). Page needs from the answer contract: `total_a`, `total_b`, `evidence[].title`, `memory[]`, `next_steps[].cause`, `trace[].label`; and the API routes listed at the top of its script.

**Household area.** Sample household set to postcode district M1 (Manchester): Octopus price region G (North West England), coordinates 53.4775, -2.2361 from postcodes.io, water by United Utilities. Saved in `data/sample/household_SAMPLE.json` by `scripts/lookup_area.ts`, replacing `HOME_LAT`/`HOME_LON` in `.env`. The page shows the area under "Your bills". Tailoring to a viewer's own postcode or bill is a roadmap item.

**Meterless engines vendored.** H-MEM, World Model, Markovian and Scout Intent copied unchanged into `vendor/meterless/` from Meterless commit `1742dec` (Apache-2.0); see `vendor/README.md`. Taken straight from the repo rather than through the starter's `degit` step.
Own test suites: H-MEM, World Model and Markovian each pass 10 of 10. Scout Intent is a spec with an eval harness and no implementation, so we write our own Scout and test it with `SCOUT_IMPL`.

**Web page moved to Next.js.** Next.js 16.3.8 (App Router, TypeScript), Tailwind 4, lucide-react icons, fonts via `next/font`. Page in `src/app/page.tsx` (server-rendered) and `src/components/`; API routes in `src/app/api/*` (status, household, bills, notes, ask, note, feedback); data access by mode in `src/lib/source.ts`, with `WHYBILL_MODE` = preview (default), replay or live. Old `web/` single file removed; preview data is now `data/sample/preview_SAMPLE.json`.
Checks: lint clean, `next build` passes, 17 API checks and 15 browser click-through checks (headless Chromium at phone size) pass with no console errors. Static hosting on GitHub Pages no longer fits (API routes need a server); Vercel would host replay mode.

**Plan v2 (25 Oct).** `PLAN.md` rewritten: multi-agent design (guard, Lightning intake, Scout contracts, Ultra orchestrators, Lightning specialists, combiner, writer, code checker), Nemotron model per part, sponsor jobs, tech stack, rules 05 and 06, phases 3 to 11 with time boxes. Old phases 0 to 2 and the preview web app recorded under "Done so far".
Found: Next.js defaults to port 3000, which Zetaris's UI uses; the app moves to port 5175 in Phase 3.

**Phase 3, steps 3 and 5.** App on port 5175; zod 4.6.5 and Vitest 3.2.4 added (Vitest 5 doesn't list Node 25). `src/agent/llm.ts` and `trace.ts` built; `npm run smoke:llm` passes 5 of 5 through them (both models, receipts, a tool call, the trace).
Found: Nightshift caches replies keyed on the user message alone (system message ignored) and drops tool calls from cached replies. `llm.ts` tags every call to skip the cache unless the caller opts in, retries an empty cached reply, and records `cached` in the trace.

**Phase 4, steps 1 to 8 (triage).** Our Scout (`src/scout/`: registry, Sense, Guard, Route, Recommend, contracts, `decide()`), the Lightning intake agent, bill-pair lookup, `triage.ts` and placeholder orchestrators; `/api/ask` in live mode runs triage and the page shows a triage card with contracts and the trace. 78 unit tests pass; live: "energy bills in January" gives two verified contracts in 0.8 s, injection blocked in 4 ms, "my bill" asks which, browser flow 6 of 6.
Found: Nemotron reasons before answering unless `enable_thinking: false` (now the default in `llm.ts`); the intake agent needed the exact bill months and worked examples; a keyword cross-check now catches intake mistakes both ways.

**Phase 4, step 9 (triage cases).** `eval/triage_cases.json` (25 questions) and `npm run eval:triage`: 25 of 25 pass, 22 of 22 intake calls through Nightshift with receipts, 15 s for the set (`eval/triage_results.md`). Earlier runs: 24/25 (one intake slip, caught by the cross-check) and 23/25.
Found: NVIDIA answers 429 Too Many Requests when calls come quickly (Nightshift passes it on as a 502 naming nvidia_429). `llm.ts` now paces calls (LLM_RPM 30 a minute, LLM_CONCURRENCY 4) and backs off on 429. This will matter for the multi-agent phases (10 to 15 calls a question).
