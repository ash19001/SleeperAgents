# Submission form answers

## How the project uses the sponsors' technology

Up to 4,000 characters; this is 3,878 (3,906 if line breaks count as two). Covers rule 6.4: how Zetaris and Meterless are integrated, how Cursor was used, where NVIDIA contributes, and what was unique. Paste the text below as it is.

```text
Why My Bill explains why a UK household's electricity, gas or water bill changed. A team of NVIDIA Nemotron agents investigates; Zetaris is the only way they read data; Meterless routes, scopes, remembers and records everything they do. Full detail: docs/SPONSOR-TECH.md.

ZETARIS: the one data layer
- Six sources in three formats, registered as Lightning REST tables and cached: the SAMPLE household's supplier feeds (energy bills in pence with nested adjustments, meter readings, water bills, water charges), Octopus Energy's live tariff API and Open-Meteo's live weather archive.
- Four SchemaStore views (bills, reads, tariffs, weather_daily) put them in one shape: pence to pounds, litres to m³, nested adjustments summed, each bill's true use from the meter readings either side, Open-Meteo's arrays read pairwise with posexplode.
- Every agent tool is one read-only query through the SQL API; our client refuses anything but SELECT, WITH, SHOW or DESCRIBE. Each query becomes an evidence record with its exact SQL and a SHA-256 of its rows, shown behind every figure on the page.
- Adding a missing bill saves it to the supplier's feed and refreshes Zetaris's cached copy (UNCACHE/CACHE TABLE), so the agents see it about a second later.
- npm run zetaris:check proves the views match the source files: all 30 bills, 750 weather days, and the same answers on all 11 test scenarios.

METERLESS: all five parts, each in a working feature
- Nightshift: the gateway for every model call. The NVIDIA key lives in Nightshift, not in the app; each call's receipt is shown on the page.
- Scout Intent: Meterless publish it as a spec and test harness, with no code. We implemented it: guard, intent routing, and a signed (HMAC-SHA256), five-minute contract per utility naming the bills and data the agents may read. The agent loop refuses any tool the contract doesn't grant. Tested with Meterless's own harness.
- World Model: each investigation's case file. Bills and causes are entities; every finding and review is a fact recording which agent and which round.
- Markovian: runs the orchestrator's review rounds, carrying state from one round to the next (at most two follow-ups).
- H-MEM: household notes the bills can't show ("we installed a heat pump"), findings from checked answers, and feedback. A "No" on an answer flags the notes it used, and they aren't recalled until the household keeps them. The trust ledger is on the page as the memory audit.

NVIDIA: every agent is Nemotron
- Nemotron 3.5 Lightning 30B: intake and five specialists (billing, tariff, weather, usage, leak), running tool-calling loops in parallel.
- Nemotron 3 Ultra 550B: the orchestrators, with reasoning on, and the writer and combiner.
- We measured the reasoning choice: on 33 case files with planted mistakes, the orchestrator sent 93% of them back to the right specialist with reasoning on, against 61% with it off (p = 0.0005). It stays off for the short, structured roles, where it could spend the whole budget thinking and reply empty.

SPACEX AI AND CURSOR: not used.

WHAT WAS UNIQUE
- Zetaris is the boundary, not a data dump: the agents never see a file, and every number in an answer traces to a read-only query and a hash of its rows. Code measures each figure; the writer can only place figures by reference, and a checker rejects any number the model typed.
- We built Scout from its spec, so a signed contract scopes every agent's data access.
- We tested the platform as we built and fixed what we found: Nightshift injected earlier answers into prompts (now a fresh scope per call: 0 of 132 calls injected); its cache dropped tool calls (now tagged to stay fresh); NVIDIA rejected bursts of parallel calls (now paced: 68 rejections to none).
- Result: 58 of 58 answer-key checks in two full runs, one through Zetaris; 19 of 19 planted causes found, none wrongly supported.
```
