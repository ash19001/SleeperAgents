# Demo script (about 2½ minutes)

For the video (rule 6.1: 1 to 4 minutes; show the main workflow, how the agent solves the challenge, key features, and how Zetaris and Meterless are integrated).

## Before recording

- Record most of it in **replay mode** (`SAMPLE_MODE=true npm run dev`): recorded answers appear instantly. Live answers take 20 to 60 s, or several minutes when NVIDIA rate-limits the key.
- Record the two **live** clips separately (`WHYBILL_MODE=live`) and cut the waiting: say on screen that it's sped up.
- Have open in other tabs: the Zetaris SQL Editor, the Nightshift app's receipts, and `eval/results.md` on GitHub.
- Phone-width browser window (about 400 px) looks best; the page is built phone first.

## Script

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | The page, bills chart | "Your gas bill jumped thirty pounds. Your supplier tells you what you owe, never why. Why My Bill is a team of Nemotron agents that works out why, and shows its evidence." |
| 0:12 | **Live clip:** tap the January gas bar. The live panel fills: Scout, intake, orchestrator, five specialists, writer, checker (sped up) | "Scout checks the question and signs a contract for the gas investigation. Nemotron Ultra plans the work, and five Lightning specialists each test their causes by querying Zetaris." |
| 0:30 | The answer: headline, "Where the £ went", "Why it changed" | "Every pound is accounted for, to the penny: seven extra days, the coldest month, an estimated reading catching up, and a lower unit rate. Code measures each cause, so the model can't invent a number." |
| 0:45 | Tap an `E1` chip: the SQL and the SHA-256 | "Every figure links to the exact query Zetaris ran, here over six sources: three supplier feeds in different formats, plus the live Octopus price and Open-Meteo weather APIs." |
| 0:58 | Scroll to "How sure we are" and "How the agents worked it out" | "It says how sure it is and what it can't tell you. And you can see how the agents worked it out: the plan, each round, and any specialist whose verdict contradicted its own measurement being sent back to fix it." |
| 1:15 | Ask "Why did my electricity bill change in April?" (replay) | "April electricity went down overall, but use went up." |
| 1:22 | Use the heat pump example note, save it, ask again | "Add one thing the bills can't show: we installed a heat pump in March. It's stored in Meterless H-MEM." |
| 1:30 | The new answer, citing `M1` | "Now the usage specialist recalls the note, links it to the fuel switch, and the answer cites it." |
| 1:38 | Ask "Why did my energy bills change in April?" | "Ask about both and they're investigated in parallel; the summary links them: gas down, electricity up, the same heat pump." |
| 1:50 | Ask "Why did my water bill go up in June and July?" | "Water: a hot July explains some of it, but use beyond the weather is up and staying up with no note to explain it: a possible leak, and how to check." |
| 2:02 | **Live clip:** ask "Why did my gas bill change in October 2026?"; "That bill isn't here yet"; Add the bill, Fill in example figures, Save; the answer (sped up) | "If a bill is missing, it asks you for it. The figures are checked, saved into the supplier feed and refreshed in Zetaris, then the agents explain it." |
| 2:20 | Quick cuts: Zetaris SQL Editor on `whybill.bills`; Nightshift receipts naming Nemotron; "How this answer was made" with receipts | "Under the hood: Zetaris is the only way the agents read data; every model call goes through Meterless Nightshift with a receipt; World Model holds the case file and Markovian runs the review rounds." |
| 2:32 | `eval/results.md` | "Against a planted answer key it found 19 of 19 causes and wrongly supported none, with every answer checked in code. Why My Bill: explanations you can check." |

## If something goes wrong while recording

- An answer is slow: use replay mode for that question.
- NVIDIA rate limits: wait a few minutes between live clips; the live panel keeps working meanwhile.
- Zetaris is down: the agents use the same files locally and say so on each evidence chip; record the Zetaris shots another time.
