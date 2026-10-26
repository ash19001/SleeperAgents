---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/BillDesk.tsx"]
---

# Bill desk (the one screen)

Mode: Operate. The household's working screen: pick or ask about a bill, read why it changed, check the evidence. Also what judges see in the demo video and replay mode.

Audience and job: a UK household asking why a bill changed; judges checking the agent team and the evidence. Action: ask (tap a bar or type). Proof: the £ split to the penny, verdicts per cause, the query behind every figure, the agents' trace. Constraints: SAMPLE label always visible; figures come from the API untouched; every answer kind keeps a designed state (answer, answers, clarify, missing bill, blocked, error, live progress, add-bill form).

Layout decision (owner allowed a layout rethink, 26 Oct): answer first; bills and question in a left column; the long material (agents' timeline, trace, evidence list) behind tabs in the answer sheet instead of one long column.

## Direction contract

THESIS: The answer is the household's own bill, marked up: the figures that answer the question carry a yellow highlighter swipe, and each highlight opens the query behind it. It refuses the category default of an assistant chat beside KPI tiles on grey cards.

OWN-WORLD: A navy statement letterhead (#13224a) across the top and as the answer sheet's header strip; white paper sheets on a pale blue-grey desk ground (#eef1f6); navy ink text; highlighter yellow (#ffde3b) as a flat marker band behind the few evidenced figures, the selected bill and the focus ring; rises in brick red, falls in a mid navy-blue; Libre Franklin throughout with tabular figures; ruled statement rows; 6-8px radii; no shadows at rest.

STORY: The household sees the change and its two biggest causes first, trusts it because each highlighted figure opens its SQL, sees what was ruled out and how sure the answer is, and knows what to do next. A judge reaches "How the agents worked it out" and "Evidence" in one click.

FIRST VIEWPORT: A 64px navy bar: monogram, "Why My Bill", household line, mode, yellow SAMPLE tag. A 360px left column: "Your bills" (utility tabs, 12-bar chart with the selected bar navy and capped yellow, the ask field with a navy Ask button, example questions). On the right a white statement sheet: navy strip "Your gas bill, explained · Dec 2025 → Jan 2026"; the question as a 26px h1; a From / To / Days / Change field strip with the change highlighted; a 2-4 sentence answer with highlighted figures and small superscript references; tabs Answer | How the agents worked it out | Evidence; under Answer, "Where the £ went" (true-length bars, one right edge) beside "Why it changed" (verdict list). Primary action: Ask, in the left column.

FORM: The assigned direction, 4th on the ordered list (a supplier's "your bill explained" statement), raised by the five declined challengers: claim beside proof; magnitude at true length; one right edge; labelled segments; live rows that update in place. Signature move: the highlighter swipe, a flat yellow marker band behind an evidenced figure that draws in from the left on hover or focus and opens the evidence drawer. seed:b78a1b75d2d60912

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- Dark mode: a navy-ground variant of the same tokens, if time allows before the 17:00 freeze.
