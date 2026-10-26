# Why My Bill

**An agent team that explains why a UK household's electricity, gas or water bill changed: the exact £ split, the causes supported and ruled out, the evidence behind every number, how sure it is, and what to do next.**

GenAI Works Open Agent Hackathon 2026 · Track 02: The Agent That Can Explain Why · Video: _link to be added_

> SAMPLE data: the household and its bills are made up. Prices (Octopus Energy), weather (Open-Meteo) and the area (postcodes.io) are real.

## Try it in two minutes, no keys

Needs Node 22.18 or later.

```bash
git clone https://github.com/ash19001/SleeperAgents.git && cd SleeperAgents
npm ci
SAMPLE_MODE=true npm run dev     # http://localhost:5175
```

`SAMPLE_MODE=true` (replay mode) serves answers recorded from live runs of the agents (`eval/answers/`), so it needs no Zetaris, Nightshift or keys. Try the example questions, tap an evidence chip (`E1`) to see the SQL Zetaris ran, open "How the agents worked it out" and "How this answer was made", and add the note "We installed a heat pump on 15 March 2026" before asking about April electricity.

## Who it's for

A household that opens a bill and wonders why it's £30 higher than last month. Suppliers' bills show what you owe, not why it changed. The causes are usually mundane, such as a longer bill, a colder month, a price change or an estimated reading. Sometimes they matter: a leak, an appliance, or a switch from gas to a heat pump. Each one needs a different response.

## What it does

Ask "Why did my gas bill go up in January?". The answer gives:

- the change split exactly into parts that add up to the penny (days on the bill, weather, use beyond the weather, unit price, standing charge, estimated readings, credits);
- each cause marked supported, ruled out or not enough data, with the measurement and its threshold;
- a short explanation where every figure is a measurement and every reason cites its evidence;
- how sure it is and what it can't tell you;
- what to do next (send a meter reading, check for a leak, look at heat-pump tariffs);
- how the agents worked it out, and every step with its model, Nightshift receipt and time.

Ask about a bill that isn't there yet ("October 2026") and it says so and asks you to add it. The bill is checked and saved into your supplier data in Zetaris, then explained.

## How it works

```
question ─► Scout guard ─► Intake agent ─► Scout: one signed contract per utility
                                                │ (in parallel per utility)
                                                ▼
         ┌──────────── Orchestrator (Nemotron Ultra) — rounds run by Meterless Markovian ───────────┐
         │  plans tasks ─► 5 specialists (Nemotron Lightning) query Zetaris through tools            │
         │  ◄── findings into the case file (Meterless World Model); code measures every cause      │
         │  reviews ─► follow-ups; code sends back verdicts a measurement contradicts or untested   │
         └───────────────────────────────────────────────────────────────────────────────────────────┘
                                                ▼
   Writer (Ultra, placeholders only) ─► Checker (code: sums, figures, citations; one rewrite)
                                                ▼
   Combiner (Ultra) for two or more utilities ─► answer · findings saved to Meterless H-MEM
```

| Part | Runs on | Job |
| --- | --- | --- |
| Scout guard and contracts | Code (our Meterless Scout Intent) | Blocks injection and off-topic input; signs a contract per utility saying which bills and data each investigation may read |
| Intake | Nemotron 3.5 Lightning | Turns the question into one request per utility and month |
| Orchestrator, one per utility | Nemotron 3 Ultra, reasoning on | Plans each specialist's task, reviews the case file, sends problems back, closes the case. With reasoning it sent back 93% of planted problems against 61% without |
| Specialists: billing, tariff, weather, usage, leak | Nemotron 3.5 Lightning | Tool loops over Zetaris queries; each tests the causes it owns; usage and leak recall household notes from H-MEM |
| Code measurement | Code | Every verdict and £ figure; the agents choose what to look at and explain, but can't change a number |
| Writer and combiner | Nemotron 3 Ultra | The text the household reads, with `{F1}` placeholders and `[E1]` citations only |
| Checker | Code | Parts add up, no number typed by a model, every cause sentence cited, supported causes pass their thresholds |

More: [docs/SPONSOR-TECH.md](docs/SPONSOR-TECH.md) (how Zetaris, Meterless and NVIDIA are used), [data/README.md](data/README.md) (every data source), [eval/results.md](eval/results.md) (results).

## Run it live

Needs Docker with the hackathon's Zetaris images running locally (UI on port 3000), the Meterless Nightshift app with an NVIDIA key and Nemotron available, and Node 22.18 or later.

1. `npm ci`, then copy `.env.example` to `.env.local` and fill in the Zetaris org ID and API key, the Nightshift token, and `SCOUT_SECRET` (`openssl rand -hex 32`). Set `WHYBILL_MODE=live`.
2. `npm run dev` (port 5175; Zetaris fetches the SAMPLE supplier feeds from it).
3. `npm run zetaris:setup` shows what it will create; `npm run zetaris:setup -- --apply` registers the sources and views in Zetaris; `npm run zetaris:check` confirms Zetaris matches the files.
4. Open http://localhost:5175 and ask. A question takes 20 to 60 s normally, longer if NVIDIA rate-limits the key; the page shows each agent at work meanwhile, and the server log prints every step with its model and receipt.

If Zetaris isn't set up, the agents read the same files locally and every evidence record says so. If Nightshift is down, the intake falls back to keywords, code settles every cause, and the answer uses a checked template.

## Checks

| Command | What it shows |
| --- | --- |
| `npm test` | 160 tests: bill model (every pair to the penny), Scout, the agent loop, specialists, orchestrator and critique loop, case file, H-MEM, facts, checker, confidence, adding bills, pipeline |
| `npm run eval:answers` | The whole pipeline against the answer key: 58 of 58 checks in both full runs ([eval/results.md](eval/results.md)) |
| `npm run eval:triage` | 25 triage questions: 25 of 25 (25 Oct) |
| `npm run eval:orchestrator` | The orchestrator's judgement on 33 case files, reasoning off against on: 61% against 93% of planted problems sent back (p = 0.0005); [eval/orchestrator_benchmark.md](eval/orchestrator_benchmark.md) |
| `npm run zetaris:check` | Zetaris's views against the source files, and the same verdicts on all 11 scenarios |
| `npm run lint`, `npm run build` | Clean |

Sample inputs: `eval/scenarios.json` (11 bill pairs with their answer key), `eval/triage_cases.json` (25 questions). Sample outputs: `eval/answers/` (full recorded answers with traces and receipts).

## For judges

| Criterion | Where to look |
| --- | --- |
| Impact | A real question every household has; answers end in a concrete next step; [data/README.md](data/README.md) for the scenarios |
| Technical | Code-measured causes and an exact £ split (`src/billmodel/`); 160 tests; 58 of 58 on the answer key; fallbacks for Zetaris, Nightshift and model failures |
| Innovation | Models never write a number (placeholders plus a code checker); signed per-utility contracts scope what each agent may read; code critiques the specialists and sends work back; the orchestrator's reasoning measured, not assumed (93% against 61% of planted problems caught) |
| Demo | Replay mode (no keys); the live panel shows the agents at work; [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) |
| Product and UX | Phone-first page; every number has an evidence chip; confidence and limitations in plain English; add a missing bill |
| Sponsor tech | [docs/SPONSOR-TECH.md](docs/SPONSOR-TECH.md): Zetaris as the only data path, all four Meterless engines plus Nightshift in working features, Nemotron Lightning and Ultra per agent |

Pre-existing code (the vendored Meterless engines, the Next.js scaffold) is listed in [docs/PRE-EXISTING.md](docs/PRE-EXISTING.md).

## Stack

Next.js 16 (App Router, TypeScript), Tailwind 4, zod, Vitest. Data: Zetaris (local Docker). Models: NVIDIA Nemotron 3.5 Lightning and Nemotron 3 Ultra through Meterless Nightshift. Engines: Meterless H-MEM, World Model and Markovian (vendored, Apache-2.0), and our implementation of Meterless Scout Intent.
