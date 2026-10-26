# The orchestrator's judgement: reasoning off against on

Run 26 Oct 2026. Nemotron 3 Ultra through Meterless Nightshift, a fresh scope per call so no earlier answers were injected (checked per call below). 33 case files built in code from the 11 answer-key scenarios, each in three versions (clean; one specialist contradicting its own measurement; one specialist skipping its tests), exactly as the orchestrator sees them at its first review. Each reviewed with reasoning off and on, 2 times; the order alternated. Scored in code. Script: `scripts/benchmark_orchestrator.ts`; every decision in `eval/benchmark/`.

| Measure | Reasoning off | Reasoning on |
| --- | --- | --- |
| Problems sent back to the right specialist | 61% (27/44) | 93% (41/44) |
| Cases with problems where it sent every one back | 61% (27/44) | 93% (41/44) |
| Cases with problems it closed anyway | 39% (17/44) | 7% (3/44) |
| Clean cases closed without follow-ups | 94% (17/18) | 94% (17/18) |
| Follow-ups to specialists with no problem | 9 | 12 |
| £ figures in its notes that are in the case file | 99% (138/139) | 100% (83/83) |
| Closing notes naming each part over £1 by its £ figure | 88% (70/80) | 69% (34/49) |
| Replies in the required format | 98% (65/66) | 100% (66/66) |
| Time per review (median) | 4.6 s | 13.5 s |
| Output per review (median tokens, reasoning included) | 107 | 758 |
| Nightshift memories injected into prompts | 0 | 0 |

Paired comparison of the 44 reviews of cases with problems: only reasoning on sent every problem back in 15, only reasoning off in 1 (exact McNemar test, p = 5.2e-4).

## Every case

| Case | Planted problem | Reasoning off | Reasoning on |
| --- | --- | --- | --- |
| gas-estimate/clean | none; a part is open | closed; asked usage | asked usage; asked usage |
| gas-estimate/contradicted | billing claims C4 the opposite of its measurement (billing) | asked billing, usage; asked billing, usage | asked billing, usage; asked billing, usage |
| gas-estimate/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing, usage; asked billing | asked billing, usage; asked billing, usage |
| gas-catch-up/clean | none; a part is open | asked usage; asked usage | asked usage; closed |
| gas-catch-up/contradicted | billing claims C4 the opposite of its measurement (billing) | asked billing, usage; asked billing | asked billing, usage; asked billing, usage |
| gas-catch-up/skipped | billing reports without testing C3, C4, C5 (billing) | asked usage, billing; asked billing, usage | asked billing, usage; asked billing, usage |
| gas-january/clean | none | closed; closed | closed; closed |
| gas-january/contradicted | weather claims C6 the opposite of its measurement (weather) | asked weather; asked weather | asked weather; asked weather |
| gas-january/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; asked billing | asked billing; closed |
| elec-january/clean | none | closed; closed | asked usage; closed |
| elec-january/contradicted | billing claims C3 the opposite of its measurement (billing) | closed; asked billing | asked billing; asked billing |
| elec-january/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; closed | asked billing; asked billing |
| elec-april/clean | none | closed; closed | closed; closed |
| elec-april/contradicted | tariff claims C1 the opposite of its measurement (tariff) | closed; closed | asked tariff; asked tariff |
| elec-april/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; asked billing | asked billing; asked billing |
| gas-april/clean | none | closed; closed | closed; closed |
| gas-april/contradicted | usage claims C7 the opposite of its measurement (usage) | closed; asked usage | asked usage; asked usage |
| gas-april/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; asked billing | asked billing; asked billing |
| elec-june/clean | none | closed; closed | closed; closed |
| elec-june/contradicted | billing claims C5 the opposite of its measurement (billing) | asked billing; closed | asked billing; asked billing |
| elec-june/skipped | billing reports without testing C3, C4, C5 (billing) | closed; closed | asked billing; asked billing |
| water-april-rise/clean | none | closed; closed | closed; closed |
| water-april-rise/contradicted | usage claims C7 the opposite of its measurement (usage) | asked usage; asked usage | asked usage; asked usage |
| water-april-rise/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; asked billing | asked billing; asked billing |
| water-summer-leak/clean | none | closed; closed | closed; closed |
| water-summer-leak/contradicted | usage claims C7 the opposite of its measurement (usage) | closed; asked usage | asked usage; asked usage |
| water-summer-leak/skipped | billing reports without testing C3, C4, C5 (billing) | closed; asked billing | asked billing; asked billing |
| water-leak-continues/clean | none | closed; closed | closed; closed |
| water-leak-continues/contradicted | weather claims C6 the opposite of its measurement (weather) | closed; closed | asked weather; asked weather |
| water-leak-continues/skipped | billing reports without testing C3, C4, C5 (billing) | asked billing; closed | asked billing; asked billing |
| control/clean | none | invalid reply; closed | closed; closed |
| control/contradicted | billing claims C3 the opposite of its measurement (billing) | closed; closed | closed; asked billing |
| control/skipped | billing reports without testing C3, C4, C5 (billing) | closed; closed | asked billing; closed |
