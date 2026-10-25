# Vendored code

Copied unchanged from [github.com/Meterless/Meterless](https://github.com/Meterless/Meterless) at commit `1742dec56a66e58eef9dda2d2b865823758ca8cd` (19 Oct 2026), on 25 Oct 2026. None of it was written for this project. Every engine is Apache-2.0 and keeps its own `LICENSE`. None is published on npm, so copying it in is the way to use it.

| Folder | Upstream path | What it is | Copied | Own tests |
| --- | --- | --- | --- | --- |
| `meterless/hmem` | `engines/hmem` | Memory engine, reference implementation | `reference/`, `LICENSE`, `README.md`, `AGENTS.md`, `HOW_TO_USE_H-MEM.md` | 10 of 10 pass |
| `meterless/world-model` | `engines/world-model` | Shared state for agents, reference implementation | `reference/`, `LICENSE`, `README.md`, `AGENTS.md`, `HOW_TO_USE_WORLD_MODEL.md` | 10 of 10 pass |
| `meterless/markovian` | `engines/markovian` | Long tasks in bounded chunks, reference implementation | `reference/`, `LICENSE`, `README.md`, `AGENTS.md`, `HOW_TO_USE_MARKOVIAN_ENGINE.md` | 10 of 10 pass |
| `meterless/scout-intent` | `engines/scout-intent` | Specification, examples and eval harness. Meterless publish no implementation; ours lives in `src/` and is tested with `SCOUT_IMPL=<path> npm run evals` | Everything except `images/`, `content/` and `workshops/` (media and course material) | Runs against our implementation |

Dependencies are not committed. To install them, run `npm ci` in each `reference/` folder and in `scout-intent/`. To run an engine's tests, run `npm test` in its `reference/` folder.
