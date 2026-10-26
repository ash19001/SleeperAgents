# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **UK households** who open an electricity, gas or water bill and wonder why it changed. They want the reason in plain words, how sure the answer is, and what to do about it. Mostly on a laptop or phone, occasionally, when a bill arrives.
- **Hackathon judges** (GenAI Works Open Agent Hackathon 2026, Track 02) who see the screen in a 1 to 4 minute demo video and in replay mode on their own machine. They score impact, technical depth, innovation, demo, product and UX, and sponsor tech.

Confirmed with the owner (26 Oct 2026): serve both equally. The screen must work as a household tool and read clearly at a glance in the demo.

## Product Purpose

Why My Bill answers one question: "Why did my bill go up, or down?" A team of AI agents investigates each bill, splits the change into exact £ parts that add up to the penny, tests each likely cause against the bills and public data, says which causes it ruled out, how sure it is, and what to do next. Every number traces to the query that produced it.

Success: a household understands the change and its cause in seconds and trusts it because the evidence is one tap away; a judge sees the agent team, the evidence trail and the sponsor technology at work.

## Positioning

Explains household bills (electricity, gas and water), drops as well as rises, with an agent team rather than one prompt, exact arithmetic done in code, a cited query behind every number, and household memory ("we installed a heat pump in March") to explain changes in use. The nearest other entry (Kilowhy) covers half-hourly electricity for small businesses.

## Operating Context

- One page: the household's bills by utility (chart), a question box with example questions, the answer, household notes, an evidence drawer, a live view of the agents at work, and a form to add a missing bill.
- Three modes: `preview` (hand-written SAMPLE answers), `replay` (recorded agent answers, no keys needed; what judges run), `live` (the agents; 20 s to a few minutes per question).
- Answers come in several kinds: one utility, several utilities with a summary, a clarifying question with options, a blocked question, a missing bill, an error.

## Capabilities and Constraints

- Next.js 16 App Router, Tailwind 4, lucide-react, fonts via `next/font`. Runs on port 5175. No new dependencies unless they save real time.
- All sample data is labelled SAMPLE in the UI. This label must stay visible.
- Numbers on screen come from code, never a model; the page must not alter, round differently or recompute figures the API returns.
- The page shows the sponsor technology truthfully: Zetaris (data and SQL), NVIDIA Nemotron (models), Meterless Nightshift (receipts), Scout (contracts), H-MEM (notes).
- Deadline: feature freeze 17:00 Mon 26 Oct 2026; submission by 22:00 that day.

## Brand Commitments

- Name: **Why My Bill**.
- Colours: **navy and yellow**, pinned by the owner (26 Oct 2026). How they are applied was left to the designer.
- Voice: plain, direct British English; short sentences; no jargon or hype.

## Evidence on Hand

- SAMPLE household in postcode district M1, Manchester (Octopus price region G, United Utilities water); 30 SAMPLE bills across three utilities (`data/sample/`).
- Real reference data: Octopus tariffs, Open-Meteo weather, postcodes.io area.
- Recorded agent answers in `eval/answers/`; evaluation results in `eval/results.md`.
- No users, testimonials, logos or usage figures exist. None may be invented.

## Product Principles

1. The answer first: the £ change and its main cause before any detail.
2. Every number is checkable: evidence is one tap from the figure it supports.
3. Honest about uncertainty: ruled-out causes and limits are shown, not hidden.
4. Show the agents' work without making the household read it.
5. Sample data is always labelled as sample.

## Accessibility & Inclusion

WCAG 2.2 AA: 4.5:1 text contrast, keyboard access to every control (including the chart bars and tabs), visible focus, screen-reader announcements for new answers, reduced-motion support, and a phone layout from 390 px.
