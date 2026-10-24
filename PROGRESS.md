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
