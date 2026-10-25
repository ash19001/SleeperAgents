# Why My Bill — Build Plan

Version 2, Sun 25 Oct 2026. Replaces the 24 Oct plan: the agent is now multi-agent (triage, orchestrators, specialists), the web app is Next.js, and every sponsor technology has a named job. Written for two readers: the owner, and the Claude Code session working from it.

## How to use this plan

Work through the phases in order. Each ends with a "Done when" check, and nothing moves on until it passes. **(you)** marks a step that needs a human: an account, a key, a download or a decision. Everything else is for Claude Code.

**To start a session:** "Read PLAN.md in full, then tell me which phase we are on and the next three steps."

**Rules for Claude Code:**

1. Read `PLAN.md` at the start of every session. Work on the current phase only and tick its boxes as steps pass.
2. At a **(you)** step, stop and ask. Never create accounts, generate keys or paste secrets.
3. Secrets live only in `.env.local` (gitignored). Never print, log or commit them.
4. Zetaris: the app's queries are read-only, one SQL statement per call. Show a dry run and wait for a yes before creating or dropping anything.
5. Arithmetic is done in code, never by a model. Agents get every number from a tool and write with placeholders such as `{F3}`; code fills them in.
6. Log the agent, route, model, Nightshift receipt and time of every model call. Never hide a fallback.
7. Name Nemotron models explicitly. Nightshift's `meterless/*` modes route to an on-device Llama on this machine.
8. Label sample data as SAMPLE in file names, the UI and the README.
9. Don't copy code from other hackathon entries. Vendored Meterless engines stay unchanged and are declared.
10. Keep steps small: finish one, run its check, commit, push, and add a two-line entry to `PROGRESS.md`. Commit and push without asking; never force-push.
11. Dependencies: the Next.js stack plus `zod` and `vitest`. Add anything else only when it saves real time.

## Project brief

**Why My Bill** answers one question for UK households: *"Why did my electricity, gas or water bill go up, or down?"* A team of AI agents investigates each bill: it splits the change into exact £ parts, tests each likely cause against the bills and public data, says which causes it ruled out, and says what to do next. Every number traces to the query that produced it.

| Item | Detail |
| --- | --- |
| Event | GenAI Works Open Agent Hackathon 2026, online |
| Track | 02, The Agent That Can Explain Why |
| Deadline | Tue 27 Oct 2026, 23:45 UTC (23:45 UK time), hard. Target: submit Mon 26 Oct by 22:00 |
| Judging (100) | Impact 30, Technical 20, Innovation 15, Demo 15, Product and UX 10, Sponsor tech 10 |
| Prizes | Track 02: $1,600 / $1,200 / $900. Separate prize for best use of Nemotron |
| Repo | github.com/ash19001/SleeperAgents (public) |
| Household | SAMPLE, postcode district M1, Manchester: Octopus price region G (North West England), United Utilities for water |

**Rules that shape the build (event sections 05 and 06):**

- 5.1 Every submission must integrate **Zetaris and Meterless**. Cursor is optional.
- 5.2 Use NVIDIA technology wherever it contributes.
- 5.3 Any language, framework, model or cloud is allowed, including closed-source APIs.
- 5.4 Pre-existing open-source libraries are fine. Pre-existing product code must be declared in the submission form.
- 5.5 Generated code is allowed; we own and answer for the result.
- 6.1 Demo video, 1 to 4 minutes: the main workflow, how the agent solves the challenge, key features, and how Zetaris and Meterless are integrated.
- 6.2 Slide deck: problem and target users, solution, agent workflow or architecture, tech stack, how Zetaris and Meterless were used, what was unique about that use, product visuals, future enhancements.
- 6.3 GitHub repo with all source code and a README covering setup, usage and dependencies.
- 6.4 A clear explanation of how Zetaris and Meterless were integrated, how Cursor was used (if it was), where NVIDIA contributes, and what was unique about the sponsor use.
- No live URL is required, so hosting is optional.

**What sets it apart.** Kilowhy, an existing Track 02 entry, explains half-hourly electricity bills for small businesses. Why My Bill is for households, covers electricity, gas and water, explains drops as well as rises, investigates with a team of agents rather than one prompt, and uses household memory ("we installed a heat pump in March") to explain changes in use.

## What each sponsor does

| Sponsor | Part | Job in Why My Bill |
| --- | --- | --- |
| **Zetaris** | Data platform (local, Docker) | One SQL layer over every source: three bill files in different formats, meter reads, Octopus tariffs, Open-Meteo weather, water charges. Views in database `whybill` put them in one shape. Every specialist tool is a read-only Zetaris query, and each query becomes an evidence record (E#) with a SHA-256 of its rows. |
| **NVIDIA** | Nemotron models | Nemotron 3.5 Lightning 30B for fast steps, Nemotron 3 Ultra 550B for reasoning and writing (see the model table). |
| **Meterless** | Nightshift (desktop app) | Gateway for every model call. Each reply carries a compute receipt naming the model, which goes in the answer's trace. |
| | Scout Intent (spec; we implement it) | Guard, routing and signed execution contracts. No orchestrator acts without a valid contract. |
| | H-MEM (engine) | Household notes, saved findings, feedback, and an audit trail of what was stored and recalled. |
| | World Model (engine) | The case file: specialists write findings to it, orchestrators read it to review. |
| | Markovian (engine) | Keeps the orchestrator's context bounded across review rounds. Last in line; first to drop. |
| **Cursor** | Editor (optional) | One UI tweak built in Cursor on Monday, with its prompts in `docs/cursor-log.md`. |

## Agent architecture

```text
POST /api/ask  "Why did my energy bills go up in January?"
 │
 ├─ 1. Scout Guard (code, ~1 ms) on the raw text
 │      injection patterns, SQL keywords, personal details (redacted) → block or continue
 ├─ 2. Intake agent (Lightning, ~2 s)
 │      raw text → fixed-format requests, each utility ∈ {electricity, gas, water}:
 │      [{gas, 2026-01, up}, {electricity, 2026-01, up}]   or   {unclear: question + options}
 ├─ 3. Code: each request → a bill pair (Dec 2025 → Jan 2026)
 ├─ 4. Scout decide(), once per request
 │      Sense (keyword cross-check of the raw text) → Route (read-only capabilities)
 │      → Recommend (Nemotron model) → signed contract, valid 5 minutes
 ├─ 5. Utility orchestrators (Ultra), in parallel, one per contract
 │      verify contract → split the £ change (tool) → send each £ part to specialists
 │      → review reports in the case file → up to 2 follow-up rounds → stop when every £
 │        is explained or ruled out
 │        Specialists (Lightning, read-only tools, in parallel):
 │          Tariff (C1, C2) · Billing (C3, C4, C5) · Weather (C6) · Usage (C7, C9, notes) · Leak (C8, water)
 ├─ 6. Combiner (Ultra), only when there are two or more utilities: merges answers and finds
 │      causes that span utilities (gas down + electricity up → heat pump)
 ├─ 7. Writer (Ultra): 3 to 6 sentences with {F#} placeholders and [E#] / [M#] citations
 └─ 8. Checker (code): numbers, citations, verdicts. One rewrite, then a plain template answer
```

**Why the intake agent runs before Scout:** Scout's own classifier is keyword rules. "Energy" matches electricity and gas equally on the same word, which its rules treat as a tie and answer with "Which bill do you mean?". The intake agent understands the wording and splits it; Scout then checks, scopes and signs. Scout's spec allows a pluggable "Stage 2" scorer that is never a hard dependency: the intake agent fills that role. If Nemotron is down, Scout's keyword rules run alone, and "energy" falls back to a clarifying question.

**Why the guard runs first:** the intake agent reads the raw text, so a crafted question could try to steer it. Blocking tricks first, and accepting only fixed choices from the intake agent, means a misled intake agent can only pick valid options. Scout's keyword cross-check flags a request where the intake agent's utility contradicts a utility named in the text.

**When it still asks "Which bill?":** only when the question is unclear, such as "Why is my bill so high?" with no utility. The reply offers electricity, gas and water as options.

### Nemotron model per part

| Part | Model | Why |
| --- | --- | --- |
| Intake | `nvidia/nemotron-3.5-lightning-30b-a3b` | Fast parsing into a fixed format |
| Specialists | `nvidia/nemotron-3.5-lightning-30b-a3b` | A few tool calls each, run in parallel |
| Orchestrators | `nvidia/nemotron-3-ultra-550b-a55b` | Planning, reviewing evidence, deciding follow-ups |
| Combiner, writer | `nvidia/nemotron-3-ultra-550b-a55b` | Cross-utility reasoning and careful wording |
| Checker | Code | Numbers must be exact |

Both models call tools through Nightshift (tested 25 Oct). Ultra puts its reasoning before `</think>` in the reply text; `llm.ts` strips it. Expect 30 to 45 s per question, so the page streams progress. Not available on this NVIDIA account: Nemotron 3 Super 120B and the older Llama-Nemotron models.

### Tracing

Every model call records agent, route (`nightshift` or `nvidia-direct`), model, Nightshift `receipt_id` and milliseconds. Every tool call records its evidence id. Scout emits `scout.decision`, `contract.issued`, `contract.verified` and `contract.refused` events. H-MEM's trust ledger records every note stored and recalled. All of it goes into the answer's `trace`, shown under "How this answer was made".

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16.3.8 (App Router, TypeScript), Tailwind 4, lucide-react, fonts via `next/font`. Runs on port **5175** (Zetaris's UI has port 3000). |
| Runtime | Node 22.18 or newer (25 locally) |
| Agent service | TypeScript inside the Next.js app. API routes call `src/agent/`. No separate server, no agent framework. |
| Model calls | Our `src/agent/llm.ts` with `fetch`: Nightshift first, NVIDIA direct on network failure only, receipts, retries, `</think>` stripping |
| Validation | `zod` for model JSON, tool inputs and tool schemas |
| Data access | Our `src/data/zetaris.ts`: read-only SQL guard, evidence records with SHA-256 |
| Tests | `vitest` |
| Engines | Imported from `vendor/` through path aliases (`@meterless/hmem`, `@meterless/world-model`, `@meterless/markovian`). Their files import with `.ts` extensions, so `tsconfig.json` needs `allowImportingTsExtensions`. Scout is ours, in `src/scout/`. |
| Modes | `WHYBILL_MODE`: `preview` (hand-written SAMPLE answers, the default today), `replay` (recorded agent answers from `eval/answers/`), `live` (the agents) |

## Repo layout

```text
PLAN.md  PROGRESS.md  CLAUDE.md  AGENTS.md  README.md  .env.example  package.json
data/sample/        household_SAMPLE.json, preview_SAMPLE.json; Phase 5 adds bills and reads (SAMPLE)
data/reference/     tariffs, weather, water charges (Phase 5)
scripts/            smoke_llm.ts, lookup_area.ts, make_preview_SAMPLE.ts; later fetch_*, generate_sample,
                    zetaris/*.sql, check_data
src/app/            page.tsx, layout.tsx, api/* routes          (built)
src/components/     page components                              (built)
src/lib/            types, format, labels, mode, preview, source  (built)
src/scout/          our Scout: registry, sense, guard, route, recommend, contract, telemetry,
                    intents.json, model-profiles.json, capabilities.json
src/agent/          llm.ts, intake.ts, triage.ts, orchestrators/, specialists/, tools/,
                    combiner.ts, writer.ts, verify.ts, facts.ts
src/data/           zetaris.ts
src/billmodel/      decompose.ts, thresholds.ts, causes/
src/memory/         hmem.ts, casefile.ts (World Model)
vendor/meterless/   H-MEM, World Model, Markovian, Scout spec; unchanged
eval/               triage_cases.json, scenarios.json, answers/, results.md
docs/               SPONSOR-TECH.md, PRE-EXISTING.md, DEMO-SCRIPT.md, cursor-log.md, slides
```

## The bill model

Every metered bill has the same shape, so one piece of arithmetic splits any change into exact £ parts that add up to the penny. It runs in code, as the `split_change` tool.

**Terms, per bill** (A = previous bill, B = the bill asked about): `d` days; `q` true units per day from meter reads; `Qt = d × q`; `e` billed minus true units (non-zero after an estimated reading); `p` energy charge ÷ billed units; `s` standing or fixed charge per day; `a` one-offs minus credits; `h` mean daily weather driver (heating degree days at 15.5 °C for gas and electricity, mean daily maximum temperature for water).

```text
bill = p × (Qt + e) + s × d + a

B − A =  (dB − dA) × (pA × qA + sA)        period length
       +  pA × dB × (qB − qA)                daily usage = weather part + other part
       +  QtB × (pB − pA)                     unit price
       +  dB × (sB − sA)                      standing charge
       +  (pB × eB − pA × eA)                 estimated reading
       +  (aB − aA)                           one-offs and credits

weather part = pA × dB × β × (hB − hA)     β from q = α + β × h on the prior 12 months
```

Parts are rounded to pennies; any leftover penny goes to the largest calculated part, never to a one-off. A unit test proves the identity on every bill pair.

**Cause tests.** Each is a read-only query plus a rule, giving *supported*, *ruled out* or *inconclusive*. Thresholds live in `src/billmodel/thresholds.ts`. A specialist may only call a cause *supported* when its tool's measurement passes the threshold; the checker enforces this.

| ID | Cause | Specialist | Supported when (default) |
| --- | --- | --- | --- |
| C1 | Unit price changed | Tariff | pB differs from pA by 1% or more, dated by the tariff source |
| C2 | Standing or fixed charge changed | Tariff | sB differs from sA by 0.5p a day or more |
| C3 | Billing period longer or shorter | Billing | dB differs from dA by 2 days or more |
| C4 | Estimated reading, later corrected | Billing | Either bill was estimated and e is over 2% of billed units |
| C5 | One-off charge or credit | Billing | aB differs from aA |
| C6 | Weather | Weather | Weather part is 20% or more of the usage change, same sign, fit R² 0.5 or more |
| C7 | Use changed beyond the weather | Usage | Other part moves daily use by 10% or more; notes recalled to explain it |
| C8 | Possible leak | Leak | Water: other part up 15% or more with no note explaining it |
| C9 | Switched fuel | Usage, combiner | Gas falls and electricity rises beyond weather in the same period, or a note says so |

## Answer contract

The API returns one of:

- `{ kind: "answer", answer }` for one utility,
- `{ kind: "answers", answers: [...], summary_markdown }` for two or more (the page shows the summary, then one sheet per utility),
- `{ kind: "clarify", message, options }`,
- `{ kind: "blocked", reason }`,
- `{ kind: "triage", ... }` temporarily in Phase 4, while orchestrators are placeholders.

Each `answer` has: `question, utility, bill_a, bill_b, total_a, total_b, change_gbp, components[{id, gbp, evidence}], causes[{id, verdict, effect_gbp, evidence, memory, detail}], facts[{id, value, evidence}], answer_markdown, next_steps[{cause, action, evidence}], evidence[{id, title, sql, rows, sha256, at}], memory[{id, text, created}], trace[{step, agent, label, route, model, receipt, ms}]`. Live mode streams progress events (`{agent, status, detail}`) before the final result.

**Checker** (`src/agent/verify.ts`), before any answer is shown: components sum to `change_gbp` within £0.01; every number in the text matches a fact; every sentence naming a cause cites evidence; only supported causes are given as reasons; every supported cause passes its threshold. On failure: one rewrite with the errors, then a plain template answer built from the facts.

## Done so far (Sat 24 to Sun 25 Oct)

- [x] Accounts and installs: repo, NVIDIA key, Nightshift (M1 to M4 build), Docker, Node 25, Python 3.14. Rules sections 05 and 06 read.
- [x] Zetaris running locally (UI :3000, REST :8888); `getting-started` cloned next to the repo; preflight passes; `SELECT 1` returns 1.
- [x] Nightshift serves Nemotron by explicit model ID, with receipts; NVIDIA direct works as the fallback; both models call tools (`npm run smoke:llm`).
- [x] Meterless engines vendored unchanged from commit `1742dec`; H-MEM, World Model and Markovian pass their own tests 10 of 10.
- [x] Household area from postcode district M1 (`scripts/lookup_area.ts`).
- [x] Web app in Next.js, preview mode: bills chart, question box, answer sheet, evidence drawer, household notes, API routes. Lint and build pass; 17 API checks and 15 browser checks pass.

## Phase 3: Foundations — Sun afternoon

- [ ] 1. **(you)** Run `openssl rand -hex 32` and add the result to `.env.local` as `SCOUT_SECRET=`. Scout signs contracts with it.
- [ ] 2. **(you)** Check your NVIDIA usage allowance at build.nvidia.com. A question will take about 10 to 15 model calls.
- [x] 3. Run the app on port 5175 (`dev` and `start` scripts) so it never clashes with Zetaris's UI.
- [ ] 4. Add `zod` and `vitest`; add the engine path aliases and `allowImportingTsExtensions`; prove one import from each engine compiles in `next build`.
- [x] 5. `src/agent/llm.ts`: `chat({agent, model, messages, tools})` through Nightshift with the app and scope headers; NVIDIA direct only on a network failure; 401, 403 and refusals are thrown, not swallowed; strips `</think>`; returns `{message, toolCalls, route, model, receipt, ms}` and adds a trace entry. Rewrite `scripts/smoke_llm.ts` to use it.
- [ ] 6. `src/data/zetaris.ts`: `runSql(sql)` with bearer key, `X-Org-ID` and a fresh `X-Request-ID`; `evidence(id, title, sql)` refuses anything but `SELECT`, `WITH`, `SHOW` or `DESCRIBE`, converts number strings, and returns `{id, title, sql, rows, sha256, at}`.

**Done when:** `npm run smoke:llm` passes through `llm.ts`, a `vitest` run passes, and `next build` compiles an import from each engine.

## Phase 4: Triage — Sun afternoon to evening

- [x] 1. `src/scout/` registry: `bill.explain.electricity`, `bill.explain.gas`, `bill.explain.water` and `GENERAL`, each with examples, capabilities, risk class, surfaces and roles, in Scout's intent shape.
- [x] 2. Sense: Scout's Stage-1 keyword scan, its scoring formula and confidence bands (high 0.80, medium 0.55, low 0.40), multi-intent and clarification rules.
- [x] 3. Guard: injection patterns, SQL keywords, out-of-scope tool requests, personal-details redaction (account numbers, card numbers, emails, phone numbers), 500-character limit.
- [x] 4. Intake agent (`src/agent/intake.ts`, Lightning): raw text to `{requests[{utility, period, direction}], unclear?}`, checked with `zod`; months resolved to bill pairs in code. Bills come from `preview_SAMPLE.json` until Phase 5, then from Zetaris.
- [x] 5. Route and Recommend: capability map (`bills.read`, `reads.read`, `tariffs.read`, `weather.read`, `water_charges.read`, `memory.recall`, `memory.write`, `casefile.write`) and model profiles (Lightning, Ultra).
- [x] 6. Contracts: canonical JSON, HMAC-SHA256 with `SCOUT_SECRET`, 5-minute expiry, `verifyContract`; telemetry events into the trace. Unit tests for signing, tampering and expiry.
- [x] 7. Placeholder orchestrators (`src/agent/orchestrators/`): verify the contract's signature, expiry and scope, refuse otherwise, and return `{utility, bill_a, bill_b, model, contractId, status: "placeholder"}`.
- [x] 8. `/api/ask` in live mode runs triage and returns `{kind: "triage"}` (or `clarify` or `blocked`); the page shows a temporary triage card.
- [ ] 9. `eval/triage_cases.json`: about 25 questions with expected results, covering "energy bills", "heating bill", "my bills", both utilities named, water, months, injection attempts and personal details. `scripts/eval_triage.ts` scores them.
- [ ] 10. Run Meterless's Scout harness against our build (`SCOUT_IMPL=... npm run evals` in `vendor/meterless/scout-intent`). Time box: 45 minutes. Record the score as it is in `eval/results.md`.

**Done when:** "Why did my energy bills go up in January?" returns two signed contracts (gas and electricity, Dec→Jan), both verified by their placeholder orchestrators; an injection attempt is blocked; "Why is my bill so high?" asks which utility; the triage cases score 90% or better; the trace shows the intake agent's Nightshift receipt.

## Phase 5: Data — Sun evening (Zetaris steps need your yes)

- [ ] 1. Read Zetaris's file and REST cookbooks and SQL gotchas in `../getting-started`. Find out whether Zetaris (in Docker) can read CSV files from this repo; if not, **(you)** either add a Docker volume or upload the files in the Zetaris UI. Write the registration steps in `PROGRESS.md`.
- [ ] 2. `scripts/fetch_tariffs.ts`: Octopus household variable product, region G, unit rates and standing charges for electricity and gas, 1 Oct 2025 to 20 Oct 2026 (`value_inc_vat`). Save raw JSON and a CSV in `data/reference/`.
- [ ] 3. `scripts/fetch_weather.ts`: Open-Meteo archive for M1 (53.4775, -2.2361), 1 Oct 2024 to 20 Oct 2026, daily mean and max temperature and rain; heating degree days = max(0, 15.5 − mean).
- [ ] 4. `data/reference/water_charges_SAMPLE.csv`: United Utilities style 2025/26 and 2026/27 rates (water and sewerage £/m³, fixed charge), rise on 1 April, labelled illustrative.
- [ ] 5. `scripts/generate_sample.ts` (fixed seed): daily use = α + β × weather + noise, priced with the real tariffs, then the planted events below. Files in `data/sample/`, deliberately in different shapes: `supplierA_energy_bills_SAMPLE.csv` (monthly, kWh, pence, read flag A/E, line items), `supplierA_meter_reads_SAMPLE.csv`, `waterco_bills_SAMPLE.csv` (two-monthly, litres, pounds, Actual/Estimated, water and sewerage lines). Answer key in `eval/scenarios.json`.
- [ ] 6. Register the CSVs (and Octopus and Open-Meteo as REST sources, time box one hour; otherwise their saved CSVs) in Zetaris; create views in `whybill`: `bills` (one shape for all utilities, including `units_true`), `reads`, `weather_daily` (with `hdd`), `tariffs`, `water_charges`. Dry run first, then wait for a yes.
- [ ] 7. `scripts/check_data.ts`: every bill's parts sum to its total within £0.01; true units present. Switch `src/lib/source.ts` and the intake agent's bill lookup to Zetaris.

**Planted events** (each in the answer key with its bill pair):

1. Gas: estimated reading on the November 2025 bill, caught up on the December bill (C4).
2. Gas and electricity: 35-day January 2026 bill after a 28-day December bill (C3), in the coldest month (C6).
3. Every real tariff change in the year (C1, C2), dated from the Octopus data.
4. Heat pump installed 15 March 2026: electricity up, gas down (C7, C9). The note the user adds in the demo.
5. Electricity: £50 goodwill credit on the June 2026 bill, which is also 3 days shorter (C5, C3).
6. Water: the 1 April 2026 charge rise (C1) and a hot, dry July (C6).
7. Water: a hidden leak from mid-June (C8).
8. One control pair with no planted cause, where every test should be ruled out.

**Done when:** `SELECT utility, COUNT(*) FROM whybill.bills GROUP BY utility` returns three utilities, `check_data.ts` passes, and the answer key lists all eight events.

## Phase 6: Tools and specialists — Mon morning

- [ ] 1. `src/billmodel/decompose.ts` and the weather fit (β, R²), as the `split_change` and `weather_fit` tools. Unit test: every bill pair sums to the penny.
- [ ] 2. Specialist tools in `src/agent/tools/`: each is a typed function with a `zod` schema, runs read-only Zetaris queries through `evidence()`, checks its capability against the contract, and returns measurements plus evidence ids.
- [ ] 3. Specialists (Lightning): Tariff, Billing, Weather, Usage (with H-MEM recall), Leak. Each takes one task from its orchestrator, calls its tools, and returns `{cause, verdict, effect_gbp, evidence, memory, reasoning, follow_up?}`, checked with `zod` and against the thresholds.

**Done when:** each specialist, run alone on its planted event, returns the answer key's verdict with evidence.

## Phase 7: Orchestrators, combiner, writer, checker — Mon late morning

- [ ] 1. Orchestrator (Ultra), one per utility: verify the contract, run `split_change`, send each part to specialists in parallel, review their reports in the case file, ask follow-ups (at most 2 rounds), stop when every £ part is explained or ruled out.
- [ ] 2. Combiner (Ultra) for two or more utilities, including C9.
- [ ] 3. Writer (Ultra) and `facts.ts`: placeholders and citations only; next steps from a fixed map (C4: send a meter reading; C1: compare fixed deals; C8: check the meter with every tap off; C6: nothing to fix).
- [ ] 4. Checker (`verify.ts`): the rules in the answer contract, one rewrite, then the template.
- [ ] 5. Save each live answer as JSON in `eval/answers/` for replay mode.

**Done when:** "Why did my gas bill go up in January?" and "Why was my electricity bill lower in June?" give checked answers whose supported causes match the answer key, and "Why did my energy bills change in April?" returns both utilities with the fuel switch.

## Phase 8: Memory and the case file — Mon midday

- [ ] 1. `src/memory/hmem.ts` over H-MEM's named services: `MemoryStoreService` (notes and findings), `MemoryRetrievalService` (recall for the Usage specialist), `TrustLedgerService` (audit), feedback from the thumbs.
- [ ] 2. `src/memory/casefile.ts` over World Model: one case per question; bills, meters and causes as entities with stable IDs; specialists write findings; orchestrators read `buildPromptContext`.
- [ ] 3. Markovian for the orchestrator's review rounds (first to drop if late).
- [ ] 4. After a checked answer, store each supported cause as a finding with its evidence ids.

**Done when:** asking about April electricity before and after adding the heat pump note gives two different answers, the second citing `[M1]`, and the H-MEM audit shows the note created and recalled.

## Phase 9: Live page — Mon early afternoon (Cursor optional)

- [ ] 1. `/api/ask` streams progress events; the page shows a live investigation panel (which agent is doing what) before the answer.
- [ ] 2. Show `answers` (two or more utilities) with the summary first; show clarify options as buttons; show blocked messages plainly.
- [ ] 3. "How this answer was made" lists every agent step with model, route, receipt and time.
- [ ] 4. Replay mode serves `eval/answers/` with the agents and Zetaris off, labelled on the page.
- [ ] 5. **(you, optional)** Make one UI tweak in Cursor and keep its prompts in `docs/cursor-log.md`.

**Done when:** clicking the January gas bar shows the live investigation then the checked answer, an evidence chip opens its SQL, and the same flow works with `WHYBILL_MODE=replay`.

## Phase 10: Prove it works — Mon afternoon

- [ ] 1. `scripts/eval.ts`: for every scenario in the answer key, compare verdicts with expected (cause tests alone, then the full agent on three: one up, one down, one water).
- [ ] 2. `eval/results.md`: expected against actual per scenario and cause, precision and recall of *supported*, the penny check on every bill pair, the control pair, triage scores, the Scout harness score.
- [ ] 3. Fix real bugs. Record any threshold change with old value, new value and reason.

**Done when:** every planted cause is found or its miss is explained, the control pair has no wrong *supported* verdict, and every bill pair sums to the penny.

## Phase 11: Deliver and submit — Mon evening

Feature freeze 17:00 Monday; submit by 22:00. Tuesday is buffer only.

- [ ] 1. `README.md`: one-line pitch; video link; review in two minutes with replay mode (no keys); who it's for; how it works; setup, usage and dependencies (rule 6.3); a "For judges" table mapping each scoring criterion to evidence with file paths; data sources with SAMPLE labels.
- [ ] 2. `docs/SPONSOR-TECH.md` (rule 6.4): how Zetaris and Meterless are integrated (with file paths), how Cursor was used, where NVIDIA contributes (model per agent, from real traces), and what was unique about the sponsor use.
- [ ] 3. `docs/PRE-EXISTING.md`: vendored Meterless engines (Apache-2.0, commit `1742dec`), the Next.js scaffold, anything ported from Zetaris `getting-started` (check and credit its licence). Everything else written from 24 Oct. The same list goes in the submission form (rule 5.4).
- [ ] 4. `docs/DEMO-SCRIPT.md`, about 2.5 minutes (rule 6.1: 1 to 4): the problem; January gas with the live investigation and one evidence chip; the heat pump note and April; a bill that went down; water and the leak; under the hood (Zetaris sources and SQL, Nightshift receipts naming Nemotron, Scout contracts, H-MEM audit, the results table).
- [ ] 5. **(you)** Record the video with your voice and upload it to YouTube as unlisted.
- [ ] 6. **(you and Claude Code)** Slides as a PDF in `docs/`, covering every item in rule 6.2.
- [ ] 7. Final checks: a fresh clone runs in replay mode with no keys; `git log -p` contains no keys (search for `nvapi-`, the Zetaris key, the Nightshift token and `SCOUT_SECRET`).
- [ ] 8. **(you)** Submit: Track 02, repo URL, video, slides, pre-existing code declared; opt in to the Nemotron prize if offered.

**Done when:** the submission confirmation is on screen, before 23:45 UTC on 27 Oct at the latest.

## Time boxes and fallbacks

When a step overruns, take the fallback and move on. A smaller entry that works beats a bigger one that doesn't. Zetaris, Nightshift and H-MEM are never dropped: rule 5.1 requires Zetaris and Meterless.

| If this is not working | By (UK time) | Do this instead |
| --- | --- | --- |
| Triage end to end | Sun 18:00 | Scout keywords plus intake only; skip the Scout harness |
| Zetaris reading the CSV files | Sun 21:00 | Upload the files through the Zetaris UI |
| Octopus or Open-Meteo as REST sources | 1 hour of trying | Register their saved CSV copies; say so in the README |
| Sample data in Zetaris and checked | Sun 23:30 | Electricity and gas only, events 1 to 5 and 8 |
| Specialists and orchestrators | Mon 12:00 | One orchestrator for all utilities, no follow-up rounds |
| World Model and Markovian | Mon 14:00 | Drop Markovian first, then World Model; keep H-MEM |
| Live page with streaming | Mon 15:00 | Final answer only, no live panel; replay for the video |
| Claude usage limit reached | Any time | Cursor for UI and docs; record video or draft slides until it resets |

**Roadmap (slides, not build):** enter a postcode or upload a bill for tailored prices and weather; real smart-meter data; broadband and council tax; read a photo of a paper bill with a Nemotron vision model.

## Sources

- [Event page](https://hackathon.genai.works/event/open-agent-hackathon-2026)
- Zetaris: [getting started](https://zetaris.github.io/getting-started/), [client setup](https://zetaris.github.io/getting-started/docs/connections/client-setup.html), [file cookbook](https://zetaris.github.io/getting-started/open_data/parquet_csv/HOWTO.html), [REST cookbook](https://zetaris.github.io/getting-started/open_data/rest_apis/HOWTO.html), [SQL gotchas](https://zetaris.github.io/getting-started/docs/guides/zetaris-lightning-sql-companion.html)
- Meterless: [Nightshift](https://meterless.ai/), [engines and provider contract](https://meterless.ai/engines.html), [repo](https://github.com/Meterless/Meterless); Scout spec in `vendor/meterless/scout-intent/AGENTS.md`
- NVIDIA: [API keys](https://build.nvidia.com/settings/api-keys)
- Octopus Energy: [API reference](https://developer.octopus.energy/docs/api/)
- Open-Meteo: [historical weather API](https://open-meteo.com/en/docs/historical-weather-api)
- postcodes.io: [outcode lookup](https://postcodes.io/)
- Existing Track 02 entry for contrast: [Kilowhy](https://github.com/yy5652-hash/kilowhy)
