# Why My Bill — Build Plan

24 Oct 2026

A step-by-step plan, from creating accounts to submitting, for an agent that tells UK homeowners why any utility bill went up or down. It is written for two readers: you, and the Claude Code session you hand it to. Save it in the repo as `PLAN.md`.

## How to use this plan

Work through the phases in order; each one ends with a "Done when" check, and nothing moves on until that check passes. Steps marked **(you)** need a human: an account, a key, a download or a decision. Steps marked **(Claude Code)** are for the coding session.

**To start a Claude Code session,** put this file in the repo root as `PLAN.md` and open with: *"Read PLAN.md in full, then tell me which phase we are on and the next three steps."*

**Rules for Claude Code:**

1. Read `PLAN.md` at the start of every session. Work on the current phase only and tick its boxes as steps pass.
2. At a **(you)** step, stop and ask. Never create accounts, generate keys or paste secrets yourself.
3. Secrets live only in `.env.local` (gitignored). Never print, log or commit them.
4. Zetaris: the agent's queries are read-only, one SQL statement per call. Show a dry run and wait for a yes before creating or dropping anything.
5. Arithmetic is done in code, never by the model. The model receives a table of facts and writes with placeholders such as `{F3}`; code fills in the numbers.
6. Log the route and model of every LLM call. Never hide a fallback.
7. Label sample data as SAMPLE in file names, the UI and the README.
8. Do not copy code from other hackathon entries. Meterless engines are vendored unchanged and declared as pre-existing.
9. Keep sessions small (Claude Pro has usage limits): finish one step, run its check, commit, and append a two-line summary to `PROGRESS.md`.
10. Prefer the Node standard library; add a dependency only when it saves real time.

## Project brief

**Why My Bill** (working name) answers one question for UK homeowners: *"Why did my electricity, gas or water bill go up, or down?"* It splits the change into exact £ parts, tests each likely cause against the household's bills and public data, says which causes it ruled out, and tells the owner what to do next. Every number in the answer is traced to the query that produced it.

| Item | Detail |
| --- | --- |
| Event | GenAI Works Open Agent Hackathon 2026, fully online |
| Track | 02 — The Agent That Can Explain Why (investigate across data sources, connect findings, give evidence-backed answers) |
| Deadline | 27 Oct 2026, 23:45 UTC (= 23:45 UK time). Target: submit Monday 26 Oct evening |
| Team | Solo, with Claude Pro (usage limits apply) |
| Working time | Saturday 24 setup only; Sunday 25 and Monday 26 full days; Tuesday 27 buffer |
| Required stack | Zetaris (data), Meterless Nightshift + an engine (H-MEM), NVIDIA Nemotron (models), Cursor (optional, sponsor's build tool) |
| Prizes | Track 02: $1,600 / $1,200 / $900. Separate prize for best use of Nemotron |

**Scoring (100 points).** Impact 30 is on the official page. Entrants report the rest as Technical execution 20, Innovation 15, Demo 15, Product and UX 10, Sponsor tech 10.

**Scope for the demo.** Electricity and gas in depth; water if Monday morning allows. Bills that went up and bills that went down. Broadband and council tax are out of scope because they are not usage-based; they go on a roadmap slide.

**What sets it apart.** One existing Track 02 entry (Kilowhy) explains electricity bills for small businesses on half-hourly tariffs. Why My Bill is for households, covers several utilities through one bill model, explains drops as well as rises, and uses household memory ("we installed a heat pump in March") to explain usage changes.

## Architecture and repo layout

One Node/TypeScript server runs on your machine (not in Docker, so it can reach Nightshift on loopback). It reads all data through Zetaris, calls Nemotron through Nightshift, and keeps household memory in H-MEM.

```text
 Web page (web/index.html)  --question-->  server (src/server.ts)  --answer + evidence-->  Web page
                                                |
                                          src/agent.ts
        +----------------+-----------------+----------------+-----------------+
        |                |                 |                |                 |
  src/data.ts     src/decompose.ts   src/causes/*.ts   src/llm.ts        src/memory.ts
  read-only SQL   exact £ split      cause tests       fast + deep lane  H-MEM notes,
  -> evidence                        (SQL + rules)     route logged      findings, feedback
        |                                                   |
     Zetaris  (UI :3000, REST :8888)              Meterless Nightshift :8088/v1
        |                                                   |
  SAMPLE bills (CSV, 3 suppliers)                  NVIDIA Nemotron (cloud or local)
  Octopus tariff rates (REST or CSV)               fallback: NVIDIA API direct, labelled
  Open-Meteo weather (REST or CSV)
  Water charges (CSV)
```

```text
why-my-bill/
  PLAN.md  PROGRESS.md  CLAUDE.md  README.md  .env.example  .gitignore
  data/sample/        generated household bills and meter reads (SAMPLE)
  data/reference/     tariff rates, weather, water charges
  scripts/            generate_sample.ts, fetch_tariffs.ts, fetch_weather.ts,
                      zetaris/ (register + views SQL), smoke_*.ts, ask.ts, note.ts, eval.ts
  src/                server.ts, agent.ts, data.ts, decompose.ts, causes/, llm.ts,
                      memory.ts, facts.ts, verify.ts, thresholds.ts
  web/index.html      one page, no build step
  vendor/meterless/   H-MEM reference, unchanged (Apache-2.0)
  eval/               scenarios.json (answer key), results.md
  docs/               SPONSOR-TECH.md, PRE-EXISTING.md, DEMO-SCRIPT.md, slides.pdf
```

`CLAUDE.md` holds three lines: read `PLAN.md` first, follow its rules, log progress in `PROGRESS.md`.

## The bill model

Every metered bill, whatever the utility, has the same shape, so one piece of arithmetic splits any change into exact £ parts that add up to the penny. The agent then runs the cause tests that apply to that utility.

**Terms, per bill** (A = previous bill, B = the bill being asked about): `d` days in the period; `q` true units per day from meter reads (kWh or m³); `Qt = d × q` true units; `e` units billed minus true units (non-zero when an estimated reading was used); `p` average unit price including VAT (energy charge ÷ billed units); `s` standing or fixed charge per day; `a` one-off charges minus credits; `h` mean daily weather driver (heating degree days at base 15.5 °C for gas and electricity; mean daily maximum temperature for water).

```text
bill = p × (Qt + e) + s × d + a

B − A =  (dB − dA) × (pA × qA + sA)        period length
       +  pA × dB × (qB − qA)                daily usage   = weather part + other part
       +  QtB × (pB − pA)                     unit price
       +  dB × (sB − sA)                      standing charge
       +  (pB × eB − pA × eA)                 estimated reading
       +  (aB − aA)                           one-offs and credits

weather part = pA × dB × β × (hB − hA)     β from q = α + β × h fitted on the prior 12 months
other part   = daily usage − weather part
```

The six parts sum exactly to the change; a unit test must prove this on every sample bill. A bill that went down runs the same maths with negative parts. Unmetered water has no units, so only period, price and one-off parts apply.

**Cause tests.** Each is one read-only SQL query through Zetaris plus a rule, returning *supported*, *ruled out* or *inconclusive* (not enough data). Thresholds live in `src/thresholds.ts`.

| ID | Cause | Applies to | Supported when (default) | £ effect |
| --- | --- | --- | --- | --- |
| C1 | Unit price changed (price cap, fixed deal ended, April water rise) | All metered | pB differs from pA by 1% or more; the tariff source dates the change | unit price |
| C2 | Standing or fixed charge changed | All | sB differs from sA by 0.5p/day or more | standing charge |
| C3 | Billing period longer or shorter | All | dB differs from dA by 2 days or more | period length |
| C4 | Estimated reading, later corrected | Metered | Either bill was estimated and e is over 2% of billed units | estimated reading |
| C5 | One-off charge or credit | All | aB differs from aA | one-offs |
| C6 | Weather | Gas, electricity (cold); water (hot, dry) | Weather part is 20% or more of daily usage, same sign, fit R² 0.5 or more | weather part |
| C7 | Usage changed beyond the weather | Metered | Other part moves daily usage by 10% or more; recall household notes to explain it | other part |
| C8 | Possible leak | Water | Other part up 15% or more for two bills running, with no note explaining it | flag + next step |
| C9 | Switched fuel (heat pump, EV, new cooker) | Gas + electricity | Gas usage falls and electricity rises beyond weather in the same period, or a note says so | links two bills |

**Answer contract.** `agent.ts` returns one JSON object; the web page and the eval both read it.

```json
{
  "question": "Why did my gas bill go up in January?",
  "utility": "gas", "bill_a": "GAS-2025-12", "bill_b": "GAS-2026-01",
  "change_gbp": 42.17,
  "components": [{ "id": "weather", "gbp": 28.40, "evidence": ["E5"] }],
  "causes": [{ "id": "C6", "verdict": "supported", "effect_gbp": 28.40, "evidence": ["E5"], "memory": [] }],
  "facts": [{ "id": "F1", "value": "£42.17", "evidence": ["E1"] }],
  "answer_markdown": "Your gas bill rose by {F1} ... [E5]",
  "next_steps": [{ "action": "Send an actual meter reading", "evidence": ["E4"] }],
  "evidence": [{ "id": "E5", "sql": "SELECT ...", "rows": 12, "sha256": "...", "at": "..." }],
  "trace": [{ "step": "write", "route": "nightshift", "model": "...", "ms": 2140 }]
}
```

**Verifier** (`src/verify.ts`), run before any answer is shown:

1. Components sum to `change_gbp` within £0.01.
2. Every number in the answer text matches a fact.
3. Every sentence that names a cause cites evidence.
4. Only *supported* causes are given as reasons; *ruled out* ones are listed separately.
5. On failure, send one rewrite with the errors; if that fails too, show a plain template answer built from the facts.

## Phase 0: Accounts and installs (you) — Saturday afternoon

Start the Zetaris download first (step 3), because it takes 20 to 30 minutes; do the rest while it runs.

- [ ] 1. Sign in at [hackathon.genai.works](https://hackathon.genai.works/event/open-agent-hackathon-2026) and read rules sections 05 "What you can use" and 06 "Submission requirements". Note anything that changes Phase 9.
- [x] 2. Create a public GitHub repo named `why-my-bill`, clone it, and put this file in it as `PLAN.md`.
- [x] 3. Create a Zetaris Cloud account at [cloud.enterprise.zetaris.com/register](https://cloud.enterprise.zetaris.com/register) and start the "Run locally" download (or the AWS route; see Phase 1).
- [x] 4. Create an NVIDIA API key at [build.nvidia.com/settings/api-keys](https://build.nvidia.com/settings/api-keys) (starts with `nvapi-`). Keep it for `.env.local`.
- [x] 5. Install Meterless Nightshift from [meterless.ai](https://meterless.ai/): Windows 10/11 or Mac M1 to M4. On Linux or a Mac M5+, skip it and use NVIDIA direct (note this in `PROGRESS.md`).
- [x] 6. Install Node 20+, Python 3.9+ and Docker Desktop (give Docker 8 GB of memory and 4 CPUs; on Windows use WSL2). Optional: Cursor.
- [x] 7. Decide the household's location for weather (any UK town; you only need its latitude and longitude).

**Done when:** you have a repo, an NVIDIA key, Nightshift installed (or a note saying why not), and Zetaris downloading or provisioning.

## Phase 1: Zetaris running — Saturday

Run Zetaris locally if Docker can have 8 GB of memory; otherwise use a managed AWS cluster on a new AWS account (up to $200 free credits; a small cluster used about $80 in a week of Zetaris's testing). If local is not answering `SELECT 1` by 20:00 tonight, switch to AWS.

- [x] 1. **(you)** Install: local via [Install locally](https://zetaris.github.io/getting-started/docs/install/updated_zetaris_installation_guide.html), or AWS via the [AWS Free Tier checklist](https://zetaris.github.io/getting-started/docs/install/aws-free-tier-checklist.html) then [Managed AWS cluster](https://zetaris.github.io/getting-started/docs/install/managed-aws-cluster-guide.html). Local endpoints: UI `http://localhost:3000`, REST `http://localhost:8888/api/v1.0`.
- [x] 2. **(you)** In the Zetaris UI, create an API key under **Management → API Tokens** (shown once) and copy the numeric **ID** from **Management → Organisation**. Put both in `.env.local` yourself. Put the same values in the getting-started clone's own `.env.local` too; its scripts read their own copy.
- [x] 3. **(Claude Code)** Clone [zetaris/getting-started](https://github.com/zetaris/getting-started) next to the repo (not inside it) and read its `AGENTS.md`, `docs/connections/client-setup.md` and `scripts/HOWTO.md`.
- [x] 4. **(Claude Code)** Run its read-only preflight (`python3 scripts/preflight.py`), then `SELECT 1` and `SHOW LIGHTNING DATABASES` through `scripts/query_zetaris.py`.
- [ ] 5. **(Claude Code)** Read the [File cookbook](https://zetaris.github.io/getting-started/open_data/parquet_csv/HOWTO.html), the [REST cookbook](https://zetaris.github.io/getting-started/open_data/rest_apis/HOWTO.html) and the [SQL gotchas](https://zetaris.github.io/getting-started/docs/guides/zetaris-lightning-sql-companion.html) so Phase 4 uses the right registration syntax. Summarise the steps for registering a CSV file and a REST API in `PROGRESS.md`.

**Done when:** `SELECT 1` returns 1 through the helper script, and `PROGRESS.md` holds the registration steps for files and REST APIs.

## Phase 2: Nightshift serving Nemotron — Saturday

Nightshift is the AI provider: an OpenAI-compatible API on your machine that routes each call to a model. Behind it, NVIDIA Nemotron does the reasoning. A direct NVIDIA call is the labelled fallback.

- [x] 1. **(you)** Start Nightshift. In its **Providers** tab, add NVIDIA with your `nvapi-` key. If your GPU allows, also install a local Nemotron model.
- [x] 2. **(you)** Find the runtime token (the `proxy-token` file in Nightshift's state folder, or the key in its connect link `http://<host>:<port>/connect#k=<key>`) and put it in `.env.local` as `NIGHTSHIFT_TOKEN`. The placeholder `rt-local` is rejected.
- [x] 3. **(Claude Code)** Write `scripts/smoke_llm.ts`:
  - `GET {NIGHTSHIFT_BASE_URL}/models` with `Authorization: Bearer <token>`. 200 with `meterless/*` ids = online; 401 or 403 = wrong token; no answer = offline.
  - `POST /chat/completions` with model `meterless/fast`, headers `meterless-app: why-my-bill` and `meterless-scope: user`, timeout 180 s. Print the text and the `model` field.
  - The same call against `https://integrate.api.nvidia.com/v1` with `NVIDIA_API_KEY` and model `nvidia/nemotron-3.5-lightning-30b-a3b`.
- [x] 4. **(Claude Code)** Record in `PROGRESS.md` which `meterless/*` modes `/models` lists and which Nemotron model each one routed to.

**Done when:** both calls in the smoke script return text, and the Nightshift reply names a Nemotron model.

## Phase 3: Repo scaffold — Saturday evening (Claude Code)

Set up the skeleton so Sunday starts with agent code, not plumbing.

- [ ] 1. Create the folders from the repo layout above, `package.json` (type `module`, scripts below), `tsconfig.json`, `.gitignore` (`.env.local`, `.memory/`, `vendor/**/node_modules`, `tmp/`) and `CLAUDE.md`.
- [ ] 2. Write `.env.example` (the human copies it to `.env.local` and fills in the secrets):

```dotenv
# Data: Zetaris
ZETARIS_BASE_URL=http://localhost:3000
ZETARIS_REST_URL=http://localhost:8888/api/v1.0
ZETARIS_ORG_ID=
ZETARIS_API_KEY=
ZETARIS_DB=whybill

# Power: Meterless Nightshift (primary)
NIGHTSHIFT_BASE_URL=http://127.0.0.1:8088/v1
NIGHTSHIFT_TOKEN=
NIGHTSHIFT_APP_ID=why-my-bill
MODEL_FAST=meterless/fast
MODEL_DEEP=meterless/deep

# Power: NVIDIA direct (labelled fallback)
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=
NVIDIA_MODEL_FAST=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_MODEL_DEEP=nvidia/nemotron-3-super-120b-a12b

# Build: Meterless H-MEM
HMEM_PATH=.memory

# Household
HOME_LAT=
HOME_LON=
PORT=5175
```

- [x] 3. Vendor H-MEM: run `npx degit meterless/meterless/templates/agentathon-starter tmp/starter`, then `cd tmp/starter && npm install && npm run setup && npx tsx notebook.ts seed && npx tsx notebook.ts ask "what did we decide about storage"`. When that works, copy the H-MEM reference it vendored into `vendor/meterless/hmem/` unchanged and record the upstream commit in `vendor/README.md`.
- [ ] 4. Write `src/llm.ts` from the Phase 2 smoke script: `chat(lane, messages)` tries Nightshift; on a network failure only, it calls NVIDIA direct; it returns `{text, route, model, ms}` and never hides which route answered. A 401, 403 or other refusal is thrown, not swallowed.
- [ ] 5. Write `src/data.ts`: `runSql(sql)` ported from getting-started `scripts/query_zetaris.ts` (bearer key, `X-Org-ID`, a fresh UUID `X-Request-ID`), and `evidence(id, sql)` which refuses anything but `SELECT`/`WITH`/`SHOW`/`DESCRIBE` and returns `{id, sql, rows, rowCount, sha256, at}`. REST returns values as strings, so convert numbers explicitly.
- [ ] 6. Add npm scripts: `smoke:zetaris`, `smoke:llm`, `smoke:hmem`, `ask`, `note`, `eval`, `serve`, `test`. Commit.

**Done when:** `npm run smoke:zetaris`, `npm run smoke:llm` and `npm run smoke:hmem` all pass from this repo.

## Phase 4: Data — Saturday night to Sunday morning (Claude Code)

One SAMPLE household, 1 Oct 2025 to 20 Oct 2026, with real prices and real weather underneath, so every planted cause can be checked against an answer key. The three bill files deliberately use different formats; unifying them in Zetaris is the "fragmented data" part of the story.

**Public data (fetch first, save raw JSON and a CSV copy in `data/reference/`):**

- **Tariffs, electricity and gas** — Octopus public API, no key: `GET https://api.octopus.energy/v1/products/?is_variable=true&is_business=false` to find the household variable product, then `GET /v1/products/{product}/electricity-tariffs/E-1R-{product}-{region}/standard-unit-rates/` and `/standing-charges/`, and the same under `gas-tariffs/G-1R-{product}-{region}/`. Use `period_from` and `period_to` for history; read `value_inc_vat` (p/kWh for unit rates, p/day for standing charges). Find the region letter with `GET /v1/industry/grid-supply-points/?postcode=<postcode>` (`_A` means region A). If the product code changed during the year, fetch each version and join them by date.
- **Weather** — Open-Meteo archive, no key: `https://archive-api.open-meteo.com/v1/archive?latitude={HOME_LAT}&longitude={HOME_LON}&start_date=2024-10-01&end_date=2026-10-20&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=Europe/London`. Heating degree days = max(0, 15.5 − mean temperature). The extra year before Oct 2025 is for fitting β.
- **Water charges** — no public API. Write `data/reference/water_charges_SAMPLE.csv` with 2025/26 and 2026/27 rates (water and sewerage £/m³, fixed charge per year, rise on 1 April), labelled illustrative.

**`scripts/generate_sample.ts`** (deterministic, fixed seed). Daily usage = α + β × weather + noise, priced with the real tariffs, then the planted events below. Files:

| File | Shape (deliberately different) |
| --- | --- |
| `data/sample/supplierA_energy_bills_SAMPLE.csv` | Monthly electricity and gas bills; kWh; pence; read flag `A`/`E`; line items for energy, standing, adjustments |
| `data/sample/supplierA_meter_reads_SAMPLE.csv` | Monthly actual meter reads for both fuels (the true usage) |
| `data/sample/waterco_bills_SAMPLE.csv` | Bills every two months; litres; pounds; read status `Actual`/`Estimated`; separate water and sewerage lines |
| `eval/scenarios.json` | Answer key: for each planted bill pair, the causes that must come out *supported* and *ruled out* |

**Planted events** (record each in the answer key with the bill pair it affects):

1. Gas: an estimated reading on the November 2025 bill, corrected by a catch-up on the December bill (C4).
2. Gas and electricity: a 35-day January 2026 bill after a 28-day December bill (C3), in the coldest month (C6).
3. Every real tariff change in the year becomes a price scenario (C1, C2), dated by the Octopus data; record each date and direction.
4. Heat pump installed 15 March 2026: electricity daily usage up, gas down (C7, C9). This is the note the user adds in Phase 6.
5. Electricity: a £50 goodwill credit on the June 2026 bill, which is also 3 days shorter (C5, C3), so the bill goes down.
6. Water: the 1 April 2026 charge rise (C1) and a hot, dry July (C6).
7. Water: a hidden leak from mid-June, raising usage on the next two bills with no explanation (C8).
8. One control pair with no planted cause, where every test should come out *ruled out*.

**Register in Zetaris** (SQL files in `scripts/zetaris/`, dry-run first, then wait for a yes):

- [ ] 1. Register the three SAMPLE CSV files as file sources, using the syntax recorded in Phase 1.
- [ ] 2. Register Octopus and Open-Meteo as REST sources. Time box: one hour; past that, register the saved CSV copies instead and say so in the README.
- [ ] 3. Create views in `whybill`: `bills` (all utilities in one shape: `utility, bill_id, period_start, period_end, days, units_billed, unit, energy_gbp, standing_gbp_per_day, adjustments_gbp, read_type, total_gbp`), `reads`, `weather_daily` (with `hdd`), `tariffs` and `water_charges`. Unit and currency conversions happen in these views.
- [ ] 4. Write `scripts/check_data.ts`: for every bill, energy + standing + adjustments equals the total within £0.01, and true units from reads are present.

**Done when:** `SELECT utility, COUNT(*) FROM whybill.bills GROUP BY utility` returns three utilities, `check_data.ts` passes, and `eval/scenarios.json` lists all eight events.

## Phase 5: Core agent — Sunday (Claude Code)

By Sunday night one question goes from plain English to a verified, cited answer on the command line. Code does every calculation; Nemotron understands the question and writes the explanation.

- [ ] 1. `src/decompose.ts`: the six-part split from the bill model, plus the weather fit (β, R²) per utility. Unit test: on every consecutive bill pair in the sample, the parts sum to the change within £0.01.
- [ ] 2. `src/causes/C1.ts` to `C9.ts`: each builds its SQL, calls `evidence()`, applies its rule from `thresholds.ts`, and returns `{id, verdict, effect_gbp, evidence, detail}`. Each utility lists which causes apply to it.
- [ ] 3. `src/facts.ts`: turn components and cause results into a facts table (`F1`, `F2`, …) with formatted values and their evidence ids.
- [ ] 4. `src/agent.ts`, the pipeline:
  1. **Understand** (fast lane): question → strict JSON `{utility or "all", month, direction}`. Resolve the bill pair with SQL. If a name or month is ambiguous, return a clarifying question instead of guessing.
  2. **Recall**: household notes from H-MEM (a stub returning nothing until Phase 6).
  3. **Test**: run the decomposition and every applicable cause test, in parallel.
  4. **Write** (deep lane): the model gets the facts, verdicts and notes, and writes 3 to 6 sentences using `{F#}` for numbers and `[E#]` / `[M#]` for citations. It never writes a digit itself.
  5. **Verify**: `src/verify.ts` per the bill model; one rewrite with the errors, then the template fallback.
  6. **Next steps**: a fixed map from supported causes to actions (C4 → send an actual meter reading; C1 → compare fixed deals; C8 → check the water meter with every tap off; C6 → nothing to fix, it was the weather). The model only words them.
- [ ] 5. Keep prompts in `src/prompts/*.md` so they can be tuned without touching code. For the write step, try `chat_template_kwargs: {enable_thinking: false}` if answers come back slow or wordy.
- [ ] 6. `scripts/ask.ts`: prints the answer, the £ split, supported and ruled-out causes, evidence SQL and the trace (route and model per call). Save each run as JSON in `eval/answers/`.
- [ ] 7. Commit and log in `PROGRESS.md`.

**Done when:** `npm run ask -- "Why did my gas bill go up in January?"` and `npm run ask -- "Why was my electricity bill lower in June?"` both print verified answers whose supported causes match `eval/scenarios.json`.

## Phase 6: Household memory with H-MEM — Monday morning, or Sunday night if ahead (Claude Code)

Memory explains what bills cannot show: a heat pump, a new baby, working from home. It is also the Meterless engine judges look for, so every use must go through a named H-MEM service.

- [ ] 1. `src/memory.ts` wraps the vendored H-MEM reference: `remember(text, {source, utility, date})`, `recall(query, {utility, from, to})` returning `M#` items with the retrieval trace, `audit(id)`, and `feedback(id, "helpful" | "not_helpful")`.
- [ ] 2. `scripts/note.ts`: `npm run note -- "We installed a heat pump on 15 March 2026"` stores a note; `npm run note -- --audit mem-1` prints its ledger.
- [ ] 3. In `agent.ts`, the Recall step passes notes for the utility and period to the write step, and C7 and C9 use them: a note dated in or before the period that names an appliance or household change becomes the explanation, cited as `[M#]`.
- [ ] 4. After a verified answer, store each supported cause as a finding with its evidence ids, so later questions ("has my gas been this high before?") can recall it.
- [ ] 5. Run H-MEM's own test suite from `vendor/meterless/hmem` and record the result in `docs/SPONSOR-TECH.md`.

**Done when:** asking about April electricity before and after adding the heat pump note gives two different answers, the second citing `[M1]`, and `--audit mem-1` shows the note being created and recalled.

## Phase 7: The web page — Monday late morning (Claude Code or Cursor)

One page, no build step, served by the same Node server. Building it in Cursor counts toward sponsor use and saves Claude usage; keep its prompts in `docs/cursor-log.md`.

- [ ] 1. `src/server.ts` (Node `http`, no framework): `POST /api/ask`, `GET /api/bills`, `POST /api/note`, `POST /api/feedback`. Optional: stream step updates with server-sent events.
- [ ] 2. `web/index.html`, top to bottom:
  - A SAMPLE data banner.
  - Tabs for Electricity, Gas and Water, each with a bar per bill; clicking a bar asks "Why did this bill change?"
  - A question box with three example questions.
  - The answer card: the change in £, the split as a short bar list, the supported causes, a "Ruled out" panel and the next steps.
  - Citation chips `[E#]` that open a drawer with the exact SQL, row count and hash; `[M#]` chips that show the note.
  - "How this answer was made": each step with its model, route and time.
  - An "Add a household note" box and thumbs up and down on each answer.
- [ ] 3. Replay mode: with `REPLAY=1`, the server answers from `eval/answers/` so the demo works with Zetaris and Nightshift off. Label it on the page.

**Done when:** clicking the January gas bar returns the verified answer, an evidence chip opens its SQL, and the same flow works with `REPLAY=1`.

## Phase 8: Prove it works — Monday early afternoon (Claude Code)

A short, honest evaluation is cheap to make and strong evidence for the Technical score.

- [ ] 1. `scripts/eval.ts`: for every scenario in `eval/scenarios.json`, run the decomposition and cause tests (no model needed) and compare verdicts with the answer key.
- [ ] 2. Run the full agent, model included, on three scenarios (one up, one down, one water) and confirm the verifier passes.
- [ ] 3. Write `eval/results.md`: a table of expected against actual per scenario and cause; precision and recall of *supported*; the identity check across all bill pairs; and the control pair.
- [ ] 4. Fix real bugs. If you change a threshold, record the old and new values and the reason in `results.md`.

**Done when:** every planted cause is found or its miss is explained, the control pair has no wrong *supported* verdict, and every bill pair sums to the penny.

## Phase 9: Deliver and submit — Monday evening

Freeze features at 17:00 on Monday and submit by 22:00; Tuesday is only a buffer. Check rules section 06 first and adjust this list to match it.

- [ ] 1. **(Claude Code)** `README.md`: one-line pitch; demo video link; "Review it in two minutes" (replay mode, no keys needed); who it is for and the problem; how it works; a **For judges** table mapping each scoring criterion (Impact, Technical, Innovation, Demo, Product and UX, Sponsor tech) to evidence with file paths; how to run it live; data sources with SAMPLE labels.
- [ ] 2. **(Claude Code)** `docs/SPONSOR-TECH.md`: Zetaris (sources, views, "every cause is a query", file paths); Meterless (Nightshift as provider, H-MEM services used, test results); Nemotron (model per step, taken from real traces); Cursor (what it built).
- [ ] 3. **(Claude Code)** `docs/PRE-EXISTING.md`: vendored H-MEM (Apache-2.0, upstream commit), any code ported from zetaris/getting-started (check and credit its licence), tools used; everything else written from 22 Oct.
- [ ] 4. **(Claude Code)** `docs/DEMO-SCRIPT.md`, about 2.5 minutes:
  - 0:00 The problem: the bill shows a number, never the reason.
  - 0:20 Click January gas: colder weather, a longer bill and a catch-up from November's estimate; price change ruled out. Open one evidence chip to show the SQL Zetaris ran.
  - 1:00 Add the heat pump note, ask about April: electricity up, gas down, the answer cites the note.
  - 1:35 A bill that went down (June electricity: credit and a shorter bill), then water: the April rise and a possible leak, with "check your meter with every tap off".
  - 2:00 Under the hood: Zetaris sources, Nightshift receipts naming Nemotron, the H-MEM audit, the evaluation table.
- [ ] 5. **(you)** Record the screen with your voice, 2 to 3 minutes. Upload to YouTube as unlisted and add the link to the README.
- [ ] 6. **(you + Claude Code)** Slides as a PDF in `docs/`: problem, user, demo screenshot, how it works, sponsor stack, evaluation, roadmap (bill photo upload, real smart-meter data, broadband and council tax).
- [ ] 7. **(Claude Code)** Final checks: a fresh clone runs in replay mode with no keys, and `git log -p` contains no keys (search for `nvapi-` and the Zetaris key).
- [ ] 8. **(you)** Submit on the event platform: Track 02, repo URL, video, slides; opt in to the Nemotron prize if the form offers it.

**Done when:** the submission confirmation is on screen, before 23:45 UTC on 27 Oct at the very latest.

## Time boxes and fallbacks

When a step overruns its time box, take the fallback and move on; a smaller entry that works beats a bigger one that doesn't.

| If this is not working | By (UK time) | Do this instead |
| --- | --- | --- |
| Local Zetaris answering `SELECT 1` | Sat 20:00 | Managed AWS cluster |
| Nightshift serving a Nemotron model | Sat 22:00 | NVIDIA direct, labelled in the trace and in `SPONSOR-TECH.md` |
| Octopus or Open-Meteo registered as REST sources | 1 hour of trying | Register the saved CSV copies; say so in the README |
| Sample data passing `check_data.ts` | Sun 11:00 | Electricity and gas only, events 1 to 5 and 8 |
| One question answered end to end | Sun 21:00 | Drop water, C8 and C9; ship electricity and gas |
| H-MEM recall in answers | Mon 11:00 | Keep notes via the starter's notebook commands and show recall from the command line |
| The web page | Mon 15:00 | A static HTML report written by `ask.ts` for each answer |
| Claude usage limit reached | Any time | Switch to Cursor for UI and docs; record video or draft slides until it resets |

**Stretch, only if ahead:** run the write and verify steps as Meterless Markovian chunks; hold the property, meters and suppliers in the Meterless World Model; read a photo of a paper bill with a Nemotron vision model.

## Sources

- [Open Agent Hackathon 2026 event page](https://hackathon.genai.works/event/open-agent-hackathon-2026) and [GenAI Academy course page](https://academy.genai.works/courses/open-agent-hackathon-2026/details)
- Zetaris: [getting started](https://zetaris.github.io/getting-started/), [client setup](https://zetaris.github.io/getting-started/docs/connections/client-setup.html), [client scripts](https://zetaris.github.io/getting-started/scripts/HOWTO.html), [choose an install](https://zetaris.github.io/getting-started/docs/install/choose-install.html)
- Meterless: [Nightshift](https://meterless.ai/), [engines and provider contract](https://meterless.ai/engines.html), [repo](https://github.com/Meterless/Meterless), [agentathon starter](https://github.com/Meterless/Meterless/blob/main/templates/agentathon-starter/README.md)
- NVIDIA: [Nemotron credentials and base URL](https://docs.n8n.io/credentials/nvidia/)
- Octopus Energy: [API reference](https://developer.octopus.energy/docs/api/) and [endpoints guide](https://developer.octopus.energy/rest/guides/endpoints)
- Open-Meteo: [API docs](https://open-meteo.com/en/docs), including daily variables and the [historical weather API](https://open-meteo.com/en/docs/historical-weather-api)
- Existing Track 02 entry for contrast: [Kilowhy](https://github.com/yy5652-hash/kilowhy)
