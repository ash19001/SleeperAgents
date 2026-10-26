---
name: Why My Bill
description: A household's own bill, marked up with a yellow highlighter on the figures that answer the question.
colors:
  highlighter-yellow: "#ffde3b"
  highlighter-yellow-hover: "#f5cc14"
  highlighter-wash: "#fff3b0"
  letterhead-navy: "#13224a"
  letterhead-mist: "#c3cbe0"
  selected: "#13224a"
  desk-ground: "#eef1f6"
  paper: "#ffffff"
  paper-tint: "#f5f7fa"
  ink: "#0b1530"
  ink-soft: "#3c4760"
  ink-muted: "#59647a"
  line: "#dce1ea"
  rule: "#e8ecf2"
  control: "#8792a6"
  grid: "#e3e8f0"
  axis: "#a3adc0"
  select-wash: "#e7ecf7"
  link-blue: "#2b54b8"
  bar-slate: "#7d8db3"
  bar-slate-hover: "#5d6e98"
  rise-brick: "#b42318"
  rise-wash: "#fdecea"
  fall-blue: "#2b54b8"
  fall-wash: "#e7eefb"
typography:
  display:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.4rem, 1.1rem + 0.9vw, 1.8rem)"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  figure:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  drawer-title:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
  ask-label:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 800
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 700
    lineHeight: 1.375
    fontFeature: "tnum"
  answer:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 400
    lineHeight: 1.7
    fontFeature: "tnum"
  body:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  supporting:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  label:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "tnum"
  caption:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  tag:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.55
    fontFeature: "tnum"
  citation:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    lineHeight: 1
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.625
  mono-small:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.76rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  mark: "2px"
  tag-sm: "3px"
  tag: "4px"
  md: "6px"
  drawer: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.letterhead-navy}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.highlighter-yellow-hover}"
    textColor: "{colors.letterhead-navy}"
  button-primary-large:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.letterhead-navy}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-quiet-hover:
    backgroundColor: "{colors.paper-tint}"
  button-quiet-pressed:
    backgroundColor: "{colors.select-wash}"
  button-quiet-small:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  field-large:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  letterhead:
    backgroundColor: "{colors.letterhead-navy}"
    textColor: "{colors.paper}"
    typography: "{typography.wordmark}"
    height: "64px"
  rail:
    backgroundColor: "{colors.desk-ground}"
    width: "minmax(300px, 380px)"
  main-plane:
    backgroundColor: "{colors.paper}"
    width: "1080px"
  drawer-strip:
    backgroundColor: "{colors.letterhead-navy}"
    textColor: "{colors.paper}"
    padding: "12px 24px"
  marker:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.letterhead-navy}"
    rounded: "{rounded.mark}"
    padding: "0 0.16em"
  verdict-supported:
    backgroundColor: "{colors.select-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "1px 6px 1px 4px"
  note-id:
    backgroundColor: "{colors.highlighter-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag-sm}"
    padding: "0 4px"
  tooltip:
    backgroundColor: "{colors.letterhead-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
---

# Design System: Why My Bill

## Overview

**Creative North Star: "The Bill, Highlighted"**

The screen is a supplier's "your bill explained" statement that the household has gone over with a highlighter. A navy letterhead with a yellow rule along its foot runs across the top; below it the page is two flat planes, a white page where the household asks and reads the answer, and a pale blue-grey rail beside it holding their bills and notes. Navy ink carries the text; a flat yellow marker band sits behind the few figures that answer the question, and the same yellow fills the one main action. Each highlighted figure opens the query behind it, so the highlight is both emphasis and proof.

Density is that of a statement, not a dashboard: ruled ledger rows, a ruled line of From / To / Days / Change, labelled bars drawn at true length to one right edge, and plain sentences. Nothing on the page is boxed as a card; space, the two planes and rules do the grouping. Libre Franklin carries everything with tabular figures, so money lines up. Surfaces are flat at rest; depth appears only for things that float over the page (tooltip, evidence drawer). The page is light in every colour scheme (`color-scheme: only light`, in CSS and the viewport meta), so browsers' automatic dark modes do not repaint it; there is no dark theme.

The world refuses the category default of an assistant chat beside KPI tiles on grey cards.

**Key Characteristics:**
- Navy letterhead with a 4px yellow foot rule; a white page beside a blue-grey rail; no cards.
- Yellow for the main action and as a highlighter on evidence; selection and state in navy.
- Ruled statement rows with a heavy ink top rule and light rules between.
- Tabular Libre Franklin throughout; weight, not new faces, makes the hierarchy.
- Flat at rest; shadow only on floating layers.
- Rises in brick red, falls in mid blue, always with a sign and an arrow or label.

## Colors

Navy and yellow on paper: a cool, inky statement palette with one hot accent kept to action and evidence.

### Primary
- **Highlighter Yellow** (`highlighter-yellow`, CSS `--primary` and `--hl`): the fill of the main action buttons (Ask, Save note, "Save bill and explain it") with navy text (11.6:1), the marker band on evidenced figures, the letterhead's foot rule, the selected bar's 6px cap, focus rings and text selection.
- **Highlighter Yellow Hover** (`highlighter-yellow-hover`): main-action hover only (navy text holds 10.0:1).
- **Highlighter Wash** (`highlighter-wash`): a pale tint for household-note IDs, household-note quotes and notices in the drawer and triage card.

### Secondary
- **Letterhead Navy** (`letterhead-navy`): the letterhead, the footer, the evidence drawer's header strip, the chart tooltip, and the ink on yellow.
- **Selected** (`selected`, same navy as its own token): everything that shows selection or state: the 3px underline of the active tab, the border of a pressed quiet button, a focused field's border, the selected chart bar and the timeline dots.
- **Letterhead Mist** (`letterhead-mist`): secondary text on navy (household line, mode label, footer).

### Tertiary
- **Rise Brick** (`rise-brick`) and **Rise Wash** (`rise-wash`): money that adds to the bill; low-confidence tag.
- **Fall Blue** (`fall-blue`) and **Fall Wash** (`fall-wash`): money that comes off the bill.
- **Link Blue** (`link-blue`): the "Try:" example questions under the ask box, evidence IDs, caret.
- **Bar Slate** (`bar-slate`, hover `bar-slate-hover`): unselected chart bars.

### Neutral
- **Desk Ground** (`desk-ground`): the rail, and the page behind everything.
- **Paper** (`paper`): the main plane (ask box and answer), the drawer, fields and quiet buttons.
- **Paper Tint** (`paper-tint`): row hover, quiet-button hover, code blocks, form summaries.
- **Ink** (`ink`), **Ink Soft** (`ink-soft`), **Ink Muted** (`ink-muted`): primary text, supporting text, meta and axis labels.
- **Line** (`line`): the rules that separate sections (the rail's right edge, the rule above the answer, the rule above Household notes, the answer line's top and bottom), tab-list bases. **Rule** (`rule`): hairlines between ledger rows. **Grid** (`grid`): chart gridlines. **Axis** (`axis`): split-bar zero line, decorative icons, scrollbar thumb.
- **Control** (`control`): borders of fields and quiet buttons (3.1:1 on paper).
- **Select Wash** (`select-wash`): pressed quiet buttons, the "Supported" and "High confidence" tags.

### Named Rules
**The Yellow Rule.** Yellow (`highlighter-yellow`) is for the main action, the letterhead's foot rule, the highlighter on the figures that answer the question (the change and the two largest supported causes), the selected chart bar's cap, focus rings and text selection. State and selection are never shown in yellow on white: tabs, pressed buttons, focused fields, the selected bar and timeline dots are navy (`selected`). Ticks and status icons are ink, and no tag or label is yellow.

**The Bars Hold Rule.** Chart bars hold 3:1 against their plane (bar slate 3.3:1 on paper, and on the rail).

**The Signed Money Rule.** Rise and fall colours never carry meaning alone: every amount shows its sign, and the answer line adds an arrow and "Up"/"Down".

## Typography

**Display Font:** Libre Franklin (via `next/font`, with system-ui, -apple-system, Segoe UI fallback)
**Label/Mono Font:** ui-monospace, SF Mono, Menlo, Consolas (SQL, receipts, contract IDs and signatures only)

**Character:** one statement face for everything, set with tabular figures site-wide so pounds and pence align in every column. Hierarchy comes from weight (400 / 600 / 700 / 800) and a few deliberate sizes, never from a second display face.

### Hierarchy
- **Display** (800, 2rem, -0.015em): the highlighted figure at the top of the evidence drawer.
- **Headline** (800, fluid 1.4-1.8rem, -0.015em, balanced wrap): the question as the answer's heading, with a plain muted meta line under it at body size.
- **Figure** (800, 1.6rem, -0.01em): the change in the answer line, always with the marker. Other values on that line are 1.25rem semibold; the two-utility switch shows each change at 1.25rem bold.
- **Drawer title** (800, 1.45rem, -0.01em): evidence and note headings in the drawer.
- **Wordmark** (800, 1.3rem, -0.015em, line-height 1): "Why My Bill" in the letterhead.
- **Ask label** (800, 1.15rem, -0.01em): "Ask why a bill changed"; one step above Title because the ask box is the page's main control.
- **Title** (700, 1.02rem, snug): section and block headings ("Your bills", "Household notes", "Where the £ went", "Why it changed").
- **Answer** (400, 1.08rem, 1.7, max 68-70ch): the 2-4 sentence answer, with figures in bold and evidenced figures marked.
- **Body** (400, 15px, 1.55): everything else, including the answer's meta line and cause explanations (ink-soft, max 66ch), at 0.94-0.95rem.
- **Supporting** (400, 0.92rem): example questions, agent and trace detail lines, notices.
- **Label** (400, 0.875rem): answer-line labels, status text, "Try:".
- **Caption** (400, 0.82rem): legends, chart notes, form hints, timings; chart axis months sit at 0.69-0.7rem.
- **Tag** (600, 0.78rem): verdict tags and note IDs.
- **Citation** (600, 0.68rem, raised 0.42em): evidence references.
- **Mono** (0.8rem) for SQL and contract IDs; **Mono small** (0.76rem) for receipts, allowed-column chips and signatures.

### Named Rules
**The Tabular Rule.** Every figure is tabular (`font-variant-numeric: tabular-nums` on body); money columns are right-aligned to one edge.

**The Weight Not Face Rule.** Emphasis inside prose is bold Libre Franklin; there is no italic, no second family, and no uppercase labels.

## Layout

Two planes under a full-width letterhead and over a full-width footer, with no page-wide cap; the side gutter is 16px on phones and 32px from 1024px (both clear the safe-area insets). The letterhead is a 64px navy bar with a 4px yellow rule along its foot.

From `lg` (1024px) the page is two columns at full height. On the left, the rail (`minmax(300px, 380px)`, desk ground, a 1px line on its right) holds "Your bills" (tabs and chart) and then "Household notes" under a top rule, 32px apart. On the right, the main plane (paper) centres its content at a maximum of 1080px: the ask box, then a 1px line, then the answer section, 40px apart with 40px above the answer. Content starts 32px below the letterhead (40px from `lg`) and ends 56px above the footer. Below `lg` the order is ask, answer, then the rail, which takes a top rule instead of a side rule. A navy footer closes the page: the product line and one line per mode saying the household is made up (letterhead mist, 0.875rem, 24px padding).

Inside the answer: the heading and meta line, then 24px between blocks. The answer line (From / To / Days / Change) is one ruled line: a 1px line top and bottom, 16px vertical padding, four columns from `sm` (640px) and two on phones, with no inner boxes. The Answer tab splits into two columns from `xl` (1280px): "Where the £ went" with steps and confidence on the left, "Why it changed" on the right, 40px apart; blocks inside are 32px apart.

Rhythm runs on 4px: 8px and 12px inside rows, 16px between controls, 24px between answer parts, 32px between blocks and rail sections, 40px between the main plane's parts. Ledger rows take 8-12px vertical padding.

**The Ask and Answer First Rule.** The ask box, then the answer, lead the reading order on every width: the top of the main plane on wide screens, the first two blocks on phones, with the rail after them. The question field lives only in the ask box: no second question form in the rail, and no ask control in the answer. Chart bars and note actions ask through it.

**The Two Planes Rule.** Sections are grouped by the two planes, space and rules, never by a card. The ask box, the answer, "Your bills" and "Household notes" have no border, box or fill of their own.

## Elevation & Depth

Flat at rest. The rail and the main plane are separated by tone (blue-grey beside white) and a 1px line, not shadow; sections inside them by space and rules. Shadow appears only on layers that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 2px 6px rgb(11 21 48 / 0.08), 0 18px 40px rgb(11 21 48 / 0.18)`): the chart tooltip and the evidence drawer only. The drawer's backdrop is navy at 45%.

### Named Rules
**The Flat Sheet Rule.** Nothing that sits on the page casts a shadow. If it does not float over the page, it has no shadow.

## Shapes

Small, mostly square-ish corners, on controls and small wells only. 2px for the marker band, chart bar tops and the citation swipe; 3-4px for tags (verdicts, confidence, note IDs, allowed-column chips); 6px for buttons, fields, the tooltip, code blocks, notices and form summaries. Page sections have no corners because they have no boxes. The evidence drawer is square-edged as a side sheet from 768px and takes 12px top corners as a bottom sheet on phones. Full rounds only for timeline and preview dots.

Rules are the main structural device: the yellow 4px foot of the letterhead; 1px lines between planes and sections; a 1px line above and below the answer line; a 2px ink rule under the chart; a 1px ink top rule over every ledger list (causes, split, evidence, live progress); light rules between rows; 3px navy underlines for active tabs. Empty states use a dashed control border.

## Components

### Buttons
Plain, solid, statement-office buttons.
- **Shape:** gently squared (6px), 40px tall; the Ask button alone is 48px.
- **Primary:** highlighter-yellow fill, navy semibold label, 16px side padding. Hover deepens the yellow; press nudges down 1px. Disabled at 60% opacity. One per area: Ask, Save note, "Save bill and explain it".
- **Primary large:** the same button at 48px with 24px side padding and a 1.05rem bold label; used only for Ask in the ask box, to match the 48px field beside it.
- **Quiet:** paper fill with a control-coloured border, ink semibold label; hover darkens the border to ink-soft and tints the fill; pressed (`aria-pressed`) takes a navy (`selected`) border and select wash. A 32px small size (10px padding, 0.875rem) is used for in-row actions, read-type choices and bill options.
- **On the drawer strip:** text buttons with a 10% white hover wash (Close, Back).

### Chips (citations)
- **Style:** not chips. Citations are small raised reference groups (0.68rem semibold, raised 0.42em) in muted ink, kept on one line. On hover or focus a yellow highlighter swipe draws in from the left (300ms) behind the ID and the text turns navy.
- **State:** household-note references (M#) sit on the highlighter wash at rest and take full yellow on hover.

### Cards / Containers
- **Corner Style:** none at page level; 6px for small wells.
- **Background:** the main plane is paper, the rail is desk ground.
- **Shadow Strategy:** none (Flat Sheet Rule).
- **Border:** none around sections; a 1px line rule separates them.
- **Internal Padding:** the planes take the page gutter (16px, 32px from `lg`) and 32-40px top padding. Wells (code block, notices, form summary) take 12-16px.

### Inputs / Fields
- **Style:** paper, 1px control border, 6px radius, 12px side padding, 40px tall in forms; muted placeholder. The question field is 48px with 1.05rem text. Notes use the same look as a resizable textarea.
- **Focus:** the border goes navy (`selected`) and a 3px yellow outline sits flush outside it.
- **Global focus:** every other control gets a 3px yellow outline, 2px offset, with a 5px letterhead-navy halo so the ring reads on paper, the rail, navy and the yellow button.

### Navigation
- **Letterhead:** a full-width 64px navy bar with a 4px yellow rule along its foot: the Mark (a white bill with one yellow highlighted line), the "Why My Bill" wordmark, the household line in letterhead mist behind a faint divider (hidden below 768px; "Your bills" repeats it on phones), and the mode label at the right.
- **Tabs:** semibold labels, muted at rest, ink when active with a 3px navy underline that overlaps the 1px line beneath; arrow keys move between tabs. Used for the utility tabs in the rail and the answer tabs (which shorten their labels on phones).
- **Utility switch:** when an answer covers two utilities, the same underline tab treatment, 32px apart: the utility name at 0.875rem over its signed change at 1.25rem bold; the chosen one takes the navy underline.

### Ask box
The page's main control, at the top of the main plane and first on phones; unboxed. Holding, 12px apart: the "Ask why a bill changed" label (Ask label), a row of the 48px question field and the large yellow Ask button 8px apart, and a "Try:" row of example questions. "Try:" is 0.875rem muted; each example is a link-blue text button at 0.92rem, 16px apart, wrapping under one another beside "Try:"; on hover the text turns ink and gains its underline. Asking from an example, a chart bar or a note runs the same question through this box.

### Answer
Unboxed, below a rule. The question is the heading (Headline) with a plain muted meta line under it ("Your gas bill, Dec 2025 → Jan 2026 · Checked in code"). Then the answer line (see Layout), the answer paragraph, and the Answer | How the agents worked it out | Evidence tabs.

### Footer
A full-width navy band matching the letterhead: the product line (wordmark semibold in white) and, per mode, one line in letterhead mist saying the household is made up and which data is real. This line is how the page meets PLAN.md rule 8 (label sample data in the UI), by the owner's decision of 26 Oct; nothing else on the page labels the data as sample.

### The Highlighter (signature)
A flat yellow band behind a figure that answers the question: navy bold text, 2px corners, 0.16em side padding, never wrapping. When an answer lands it draws in from the left over 560ms (`cubic-bezier(0.16, 1, 0.3, 1)`), 200ms after landing and staggered 140ms per figure, while the figure's ink turns from ink to navy so it stays readable throughout. Each marked figure is a button that opens the evidence drawer. Reduced motion shows it static.

### Where the £ went (signature)
A ledger of labelled rows: label, bar track, right-aligned signed amount, with a bold "Total change" row. Bars are 12px tall in rise brick or fall blue, drawn to one £ scale for both directions; the zero line is a thin axis rule placed by the data (the biggest fall's share of the total span), so the bars use the whole track. On phones the track drops under the label and value.

### Bills chart
Twelve slate bars to one £ scale with nice-step gridlines and a 2px ink baseline; the selected bar is navy with a 6px yellow cap and its amount printed above. Hover or focus shows a navy tooltip with the Float shadow. Every bar is a button that asks about that bill.

### Agents' timeline
A 2px line rail with 12px navy dots ringed in paper; each step is a semibold line with 0.92rem muted detail, max 72ch.

### Verdict and confidence tags
4px tags at 0.78-0.82rem semibold with an ink icon: "Supported" on select wash, "Ruled out" outlined in line with muted text, "Inconclusive" with a dashed control border; confidence High on select wash, Medium outlined, Low on rise wash in rise brick.

### Evidence drawer
A native dialog: right side sheet up to 600px from 768px (slides in 32px over 260ms), bottom sheet to 88vh with 12px top corners on phones (rises 24px). A navy header strip (Back, Close), the figure at Display size with the marker or a Drawer title, then evidence rows and the SQL in a mono code block on paper tint.

## Do's and Don'ts

### Do:
- **Do** keep yellow to the Yellow Rule list: the main action, the letterhead's foot rule, evidenced figures (the change and the two largest supported causes), the selected bar's cap, focus and selection highlight.
- **Do** show selection and state in navy (`selected`): tab underlines, pressed-button borders, focused-field borders, the selected bar, timeline dots.
- **Do** use one yellow primary button per area, with navy text.
- **Do** make every marked figure a button that opens its evidence.
- **Do** group with the two planes, space and 1px rules; head only the floating drawer with a navy strip.
- **Do** draw money at true length to one scale, with signed amounts right-aligned to one edge.
- **Do** separate ledger rows with light rules under a 1px ink top rule.
- **Do** set citations as small raised reference groups in muted ink that take the highlighter swipe on hover or focus.
- **Do** keep chart bars at 3:1 or better against their plane.
- **Do** put the ask box first, then the answer, then the rail on phones.
- **Do** say the household is made up in the one footer line for the mode, and nowhere else.

### Don't:
- **Don't** show state or selection in yellow on white; yellow underlines, yellow pressed states and yellow tab markers are out.
- **Don't** box a page section: no border, card, fill or radius around the ask box, the answer, the answer line, the bills or the notes.
- **Don't** colour ticks or status icons yellow; they are ink.
- **Don't** box citations as chips or pills.
- **Don't** give a split chart separate scales for rises and falls, or fix the zero line at the centre.
- **Don't** put a shadow on anything that sits on the page.
- **Don't** let rise and fall colour carry meaning without a sign.
- **Don't** add a second typeface or uppercase labels.
- **Don't** add a dark theme or tokens keyed to `prefers-color-scheme: dark`; the page is `only light`.
- **Don't** add a SAMPLE tag, badge or banner; the footer line carries it.
- **Don't** build an assistant chat beside KPI tiles on grey cards.
