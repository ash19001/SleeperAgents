---
version: 1
slug: "docs-deck-index-html"
primary_target: "docs/deck/index.html"
related_targets: []
---

# Hackathon deck (docs/deck/index.html)

Mode: Persuade. A 10-slide, 16:9 deck (1920 x 1080 per slide) that GenAI Works Open Agent Hackathon judges read on their own, submitted as a PDF or link; drafted as this HTML page, then ported to a Slides artifact.

Audience and job: judges scoring impact, technical depth, innovation, demo, product and sponsor use. Content, one topic per slide, in the organisers' order: cover; problem and target users; solution; agent workflow; technical stack; how Zetaris was used; how Meterless was used; what was unique about our sponsor use; product visuals; future enhancements with the close. Proof is folded in, never given its own slide: the 58/58 answer key, the orchestrator benchmark (93% against 61%), real Nightshift receipts, SQL and hashes from a recorded answer.

Constraints: only what the Slides format carries (inline styles, px, flex and grid, h1-h3, p, ul, table, img, small svg; spans set colour or bold only, so a highlighted figure stands alone as its own block); every figure is from the repo's recorded answers, eval results or data; type at 24px or more.

## Direction contract

THESIS: Each slide is a page of the product's own "your bill explained" statement with its receipt attached: the claim set on paper at the left, its proof printed on a receipt tape down the right. It refuses the pitch-deck default of labelled headings over rows of equal cards and big-number tiles.

OWN-WORLD: The product's world, unchanged: a navy letterhead band (#13224a) with a 6px yellow foot rule, the bill monogram and the "Why My Bill" wordmark; white paper for the statement; a pale paper-tint tape (#f5f7fa) with dashed perforations top and bottom; navy ink; Libre Franklin, 800 for headlines; the system mono only for receipt lines, SQL, IDs and timings; yellow only as the letterhead rule and a flat marker behind the one or two figures that answer the slide; rises brick, falls blue, always signed; 1px rules, no cards, no shadows.

STORY: A judge reading alone sees what a household asks and gets, then how the agents, Zetaris and Meterless produce it, and believes each claim because the receipt beside it carries the real receipts, SQL, hashes and scores.

FIRST VIEWPORT: The cover. A full-width navy letterhead (monogram and wordmark left; "Track 02 · Page 1 of 10" right). Statement column: "Why My Bill" at 120px, a 44px one-sentence offer, and a ruled bill line (Dec 2025 £91.04, Jan 2026 £123.22, change marked +£32.18). Tape column: "This statement covers", the nine topics with their page numbers as receipt lines, a total, and the repository address.

FORM: Statement and receipt, seventh on my ordered list of seven grounded structures, dealt to lead by the roll and chosen by the owner. Raised by the declined challengers: from the elbow-panel console, the frame is the grid (letterhead and tape sit in the same place on every slide, and each topic fills that frame); from the VU-meter bridge, identical units read as a ruler (every tape line has one format, label left and value right, one mono size); from the iridescent cloud edge, colour lives only at the edge (yellow at the answering figure and the letterhead rule, nowhere else). seed:48e6c2df4664e530

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
