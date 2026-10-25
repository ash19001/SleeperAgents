# How Why My Bill uses the sponsors' technology

Why My Bill explains why a UK household's electricity, gas or water bill changed: the exact £ split, the causes supported and ruled out, the evidence for each, and what to do next. A team of Nemotron agents does the investigating; Zetaris is the only way they read data; Meterless routes, scopes, remembers and records everything they do.

| Sponsor | Part | What it does here | Where |
| --- | --- | --- | --- |
| Zetaris | Lightning REST tables, CACHE TABLE, SchemaStore views, SQL API | The one data layer: six sources in three formats behind four views; every fact an agent uses is a read-only Zetaris query with its own evidence record | `zetaris/whybill_create.sql`, `src/data/zetaris.ts`, `src/data/index.ts` |
| Meterless | Nightshift | Gateway for every model call, with a receipt per call shown on the page | `src/agent/llm.ts` |
| Meterless | Scout Intent | Guard, intent routing and a signed execution contract per utility; every tool call is checked against it | `src/scout/`, `src/agent/triage.ts`, `src/agent/loop.ts` |
| Meterless | World Model | The case file for each investigation: bills and causes as entities, every finding and review as a fact with provenance | `src/memory/casefile.ts` |
| Meterless | Markovian | Runs the orchestrator's review rounds, carrying state between them | `src/agent/orchestrators/investigate.ts` |
| Meterless | H-MEM | Household memory: notes the bills can't show, findings from checked answers, feedback, and its trust ledger as the audit | `src/memory/hmem.ts` |
| NVIDIA | Nemotron 3.5 Lightning 30B, Nemotron 3 Ultra 550B | Every agent: intake and five specialists on Lightning; orchestrators, writer and combiner on Ultra; all with tool calling | `src/agent/` |

## How a question flows

1. **Scout guard** checks the raw text (injection, out of scope, personal details) before any model sees it.
2. **Intake agent** (Lightning) reads the question into one request per utility and month; code checks it against Scout's keywords.
3. **Scout** issues a signed execution contract per utility (HMAC-SHA256, five-minute expiry) naming the intent, the bills and the capabilities allowed (`bills.read`, `reads.read`, `tariffs.read`, `weather.read`, `memory.recall`, …).
4. **One orchestrator per utility** (Ultra), in parallel, verifies its contract, has code split the change into exact £ parts, and opens a case file in **World Model**. **Markovian** then runs its rounds: Ultra plans a task for each specialist, the specialists work in parallel, Ultra reviews the case file and either asks follow-ups (at most two rounds) or closes the case.
5. **Five specialists** (Lightning: billing, tariff, weather, usage, leak) each run a tool loop. Every tool is a read-only **Zetaris** query, checked against the contract before it runs. Code measures each cause against its threshold, so a verdict and a £ figure always come from a measurement; the agent decides what to look at, links household notes from **H-MEM**, and explains.
6. **Writer** (Ultra) writes the answer using only `{F#}` placeholders from a facts table built in code, and `[E#]`/`[M#]` citations. A **checker** in code verifies it (parts add up to the penny, no number typed by the model, every cause sentence cited, every supported cause passes its threshold); one rewrite, then a plain template. For two or more utilities, the **combiner** (Ultra) writes a summary that links gas and electricity when a fuel switch is supported.
7. The page streams each step as it happens, then shows the answer, every evidence chip (the SQL sent to Zetaris and a SHA-256 of the rows), and "How this answer was made": every step with its model, route, Nightshift receipt and time.

## Zetaris

**Sources.** `zetaris/whybill_create.sql` registers six sources as Lightning REST tables in database `WHYBILL_SRC`, each cached straight away with `CACHE TABLE`:

- the SAMPLE household's supplier feeds, each in its supplier's own format, served read-only by the app (`src/app/api/data/[source]/route.ts`) and reached from Zetaris's containers at `host.docker.internal:5175`: Supplier A's energy bills (JSON, pence, nested adjustments) and meter readings, the water company's bills (litres and pounds) and its charges;
- **Octopus Energy's live tariff API**: the Flexible Octopus prices for the household's region, four series;
- **Open-Meteo's live weather archive** for Manchester.

**Views.** Four SchemaStore views in container `whybill` put them in one shape: `bills`, `reads`, `tariffs`, `weather_daily`. They convert pence to pounds and litres to m³, sum Supplier A's nested adjustments with `aggregate`, take each bill's true units from the meter readings either side of it, turn Octopus's UTC instants into UK dates, and read Open-Meteo's parallel arrays pairwise with `posexplode`.

**Reads.** `src/data/zetaris.ts` sends one read-only statement at a time to Zetaris's SQL API and refuses anything but `SELECT`, `WITH`, `SHOW` or `DESCRIBE`. Each read becomes an evidence record (E1, E2, …) holding the exact SQL, the row count and a SHA-256 of the rows returned; the page shows it behind every citation.

**Checked.** `npm run zetaris:check` compares the views with the source files: all 30 bills field by field, every reading and tariff, all 750 weather days, and the same £ split and verdicts on all 11 answer-key scenarios.

**What's different.** Zetaris isn't a data dump here. It's the boundary between the agents and the data: the agents never see a file, only what a read-only Zetaris query returns, and every number in an answer traces back to one of those queries.

## Meterless

**Nightshift.** Every model call goes through Nightshift's OpenAI-compatible gateway (`src/agent/llm.ts`), with the app and scope headers, and its receipt is kept in the trace and shown on the page. NVIDIA direct is only a fallback when Nightshift can't be reached. We found that Nightshift's response cache keys on the user message alone and drops tool calls from cached replies; `llm.ts` tags each call so agents always get a fresh reply, and allows the cache only where the answer depends on the user message alone.

**Scout Intent.** Meterless publish Scout as a specification and an evaluation harness, with no implementation. We implemented it (`src/scout/`): guard, lexical sense with confidence bands, intent registry, capability graph, model profiles, and signed, expiring execution contracts. Contracts carry the bill references and capability scope; orchestrators verify them, and the agent loop refuses any tool whose capability the contract doesn't grant. Meterless's own harness scores it (`eval/scout_harness_report.md`).

**World Model.** Each investigation's case file (`src/memory/casefile.ts`): the case, its bills and its causes are entities with stable ids; the £ split, each finding, each specialist's open question and each orchestrator review are facts with provenance (which agent, which round). A later finding supersedes the earlier one, and both stay in the history and audit. The orchestrator reads the case through our `promptContext()`, which plays the role of the guide's `buildPromptContext`.

**Markovian.** The orchestrator's rounds are Markovian steps. Each step, Ultra reads the case file and the state carried from earlier steps (completed rounds, open parts, verdicts, open questions), then plans, asks follow-ups or closes the case. The state is passed with Markovian's checkpoint marker and its completion marker ends the run.

**H-MEM.** Household notes ("We installed a heat pump on 15 March 2026") are H-MEM records; the usage and leak specialists recall them through H-MEM's hybrid retrieval and can cite only notes they actually recalled. After each checked answer, its supported causes are stored as findings with their evidence ids. Thumbs up or down become H-MEM feedback on the notes and findings behind the answer, and H-MEM's trust ledger records every create, read and feedback.

## NVIDIA

| Part | Model | Why |
| --- | --- | --- |
| Intake | Nemotron 3.5 Lightning 30B | Fast, cheap, structured output |
| Specialists (billing, tariff, weather, usage, leak) | Nemotron 3.5 Lightning 30B | Many short tool-calling loops in parallel |
| Orchestrators | Nemotron 3 Ultra 550B | Planning and reviewing the whole case |
| Writer and combiner | Nemotron 3 Ultra 550B | The text the household reads |

Both models call tools through Nightshift. Reasoning is switched off by default (`chat_template_kwargs: {enable_thinking: false}`): Nemotron otherwise spends the token budget reasoning and can return an empty reply.

PER_AGENT_FIGURES

## Cursor

Not used so far.

## Results

ANSWER_RESULTS
