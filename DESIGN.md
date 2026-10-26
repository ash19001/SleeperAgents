---
name: Why My Bill
description: A household's own bill, marked up with a yellow highlighter on the figures that answer the question.
colors:
  letterhead-navy: "#13224a"
  letterhead-navy-hover: "#22356a"
  letterhead-mist: "#c3cbe0"
  highlighter-yellow: "#ffde3b"
  highlighter-wash: "#fff3b0"
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
    fontSize: "clamp(1.35rem, 1.1rem + 0.8vw, 1.65rem)"
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
  label:
    fontFamily: "Libre Franklin, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
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
rounded:
  mark: "2px"
  tag-sm: "3px"
  tag: "4px"
  md: "6px"
  lg: "8px"
  drawer: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
  4xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.letterhead-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.letterhead-navy-hover}"
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
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "20px"
  sheet-strip:
    backgroundColor: "{colors.letterhead-navy}"
    textColor: "{colors.paper}"
    padding: "12px 28px"
  sample-tag:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.letterhead-navy}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  marker:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.letterhead-navy}"
    rounded: "{rounded.mark}"
    padding: "0 0.16em"
  verdict-supported:
    backgroundColor: "{colors.select-wash}"
    textColor: "{colors.ink}"
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

The screen is a supplier's "your bill explained" statement that the household has gone over with a highlighter. A navy letterhead runs across the top and heads each statement sheet; white paper sheets sit on a pale blue-grey desk; navy ink carries the text; and a flat yellow marker band sits behind the few figures that answer the question. Each highlighted figure opens the query behind it, so the highlight is both emphasis and proof.

Density is that of a statement, not a dashboard: ruled ledger rows, a field strip of From / To / Days / Change, labelled bars drawn at true length to one right edge, and plain sentences. Libre Franklin carries everything with tabular figures, so money lines up. Surfaces are flat at rest; depth appears only for things that float over the page (tooltip, evidence drawer). Dark mode is the same statement on a navy ground, with the letterhead going darker than the ground and yellow taking the primary-action role.

The world refuses the category default of an assistant chat beside KPI tiles on grey cards.

**Key Characteristics:**
- Navy letterhead bar and sheet strips; white sheets on a blue-grey desk.
- One yellow, used as a highlighter on evidence, never as decoration.
- Ruled statement rows with a heavy ink top rule and light rules between.
- Tabular Libre Franklin throughout; weight, not new faces, makes the hierarchy.
- Flat at rest; shadow only on floating layers.
- Rises in brick red, falls in mid blue, always with a sign and an arrow or label.

## Colors

Navy and yellow on paper: a cool, inky statement palette with one hot accent kept rare.

### Primary
- **Letterhead Navy** (`letterhead-navy`): the top bar, the footer, every sheet and drawer header strip, the primary button, the selected chart bar, active tab underlines, timeline dots and the ink on yellow. In dark mode the letterhead deepens (#060d24) below the ground, and the primary-action role passes to yellow (see the Yellow Rule).
- **Letterhead Navy Hover** (`letterhead-navy-hover`): primary button hover only.
- **Letterhead Mist** (`letterhead-mist`): secondary text on the letterhead (household line, sheet meta, mode label, footer).

### Secondary
- **Highlighter Yellow** (`highlighter-yellow`): the marker band, the selected bar's 6px cap, the SAMPLE tag, focus rings and text selection. Same value in both themes.
- **Highlighter Wash** (`highlighter-wash`): a pale tint for household-note IDs, household-note quotes and notices in the drawer and triage card. Dark: #3d3a1c.

### Tertiary
- **Rise Brick** (`rise-brick`) and **Rise Wash** (`rise-wash`): money that adds to the bill; low-confidence tag. Dark: #ff9486 / #3a1f28.
- **Fall Blue** (`fall-blue`) and **Fall Wash** (`fall-wash`): money that comes off the bill. Dark: #94b3ff / #182b55.
- **Link Blue** (`link-blue`): example questions, evidence IDs, caret. Dark: #9db8ff.
- **Bar Slate** (`bar-slate`, hover `bar-slate-hover`): unselected chart bars. Dark: #5a6fa8 / #7a8fc8.

### Neutral
- **Desk Ground** (`desk-ground`): the page behind the sheets. Dark: #0a1430.
- **Paper** (`paper`): panels, the answer sheet, the drawer, fields. Dark: #101c3c.
- **Paper Tint** (`paper-tint`): row hover, quiet-button hover, code blocks, form summaries. Dark: #16244a.
- **Ink** (`ink`), **Ink Soft** (`ink-soft`), **Ink Muted** (`ink-muted`): primary text, supporting text, meta and axis labels. Dark: #eef1f8 / #c6cde0 / #9ea9c3.
- **Line** (`line`): panel and field-strip borders, tab-list base. **Rule** (`rule`): hairlines between ledger rows. **Grid** (`grid`): chart gridlines. **Axis** (`axis`): split-bar zero line, decorative icons, scrollbar thumb.
- **Control** (`control`): borders of fields and quiet buttons (3.1:1 on paper; 3.9:1 dark).
- **Select Wash** (`select-wash`): pressed quiet buttons, the chosen bill option, the "Supported" and "High confidence" tags. Dark: #1e2f5c.

### Named Rules
**The Yellow Rule.** Yellow (`highlighter-yellow`) is reserved for the highlighter on the figures that answer the question (the change and the two largest supported causes), the selected chart bar's cap, the SAMPLE tag, focus rings and text selection. Ticks and status icons are ink, never yellow. The one sanctioned exception is dark mode, where `primary` and the selected bar resolve to yellow because navy would vanish on the navy ground; that is the dark theme's primary-action colour, not extra highlighting.

**The Bars Hold Rule.** Chart bars hold 3:1 against their panel in both themes (bar slate 3.3:1 on paper; 3.4:1 dark).

**The Signed Money Rule.** Rise and fall colours never carry meaning alone: every amount shows its sign, and the field strip adds an arrow and "Up"/"Down".

## Typography

**Display Font:** Libre Franklin (via `next/font`, with system-ui, -apple-system, Segoe UI fallback)
**Label/Mono Font:** ui-monospace, SF Mono, Menlo, Consolas (SQL and code only)

**Character:** one statement face for everything, set with tabular figures site-wide so pounds and pence align in every column. Hierarchy comes from weight (400 / 600 / 700 / 800) and a few deliberate sizes, never from a second display face.

### Hierarchy
- **Display** (800, 2rem, -0.015em): the highlighted figure at the top of the evidence drawer.
- **Headline** (800, fluid 1.35-1.65rem, -0.015em, balanced wrap): the question as the answer sheet's heading. The brand wordmark in the letterhead uses the same weight and tracking at 1.3rem.
- **Figure** (800, 1.6rem, -0.01em): the change in the field strip, always with the marker. Other field-strip values are 1.25rem semibold.
- **Title** (700, 1.02rem, snug): panel and block headings ("Your bills", "Where the £ went", "Why it changed"). Sheet-strip titles are 1.05rem bold on navy.
- **Answer** (400, 1.08rem, 1.7, max 68-70ch): the 2-4 sentence answer, with figures in bold and evidenced figures marked.
- **Body** (400, 15px, 1.55): everything else. Cause explanations run at 0.94rem in ink-soft, max 66ch.
- **Label** (400, 0.875rem): field-strip labels, meta lines, status text; legends and chart notes at 0.82rem.
- **Citation** (600, 0.68rem, raised 0.42em): evidence references.

### Named Rules
**The Tabular Rule.** Every figure is tabular (`font-variant-numeric: tabular-nums` on body); money columns are right-aligned to one edge.

**The Weight Not Face Rule.** Emphasis inside prose is bold Libre Franklin; there is no italic, no second family, and no uppercase except the SAMPLE tag.

## Layout

A centred desk, max 1400px, with a side gutter of 16px on phones and 32px from 1024px (both clear the safe-area insets). The letterhead is a 64px bar. From `lg` (1024px) the desk is two columns: a 360px left column ("Your bills", then "Household notes") and the answer sheet on the right spanning both rows, 24px apart; below `lg` everything stacks with 16px gaps and the answer comes first in reading order. Inside the answer sheet the Answer tab splits into two columns from `xl` (1280px): "Where the £ went" with steps and confidence on the left, "Why it changed" on the right, 40px apart.

Rhythm runs on 4px: 8px and 12px inside rows, 16px between controls, 20px panel padding, 24px between sheet sections, 32px between answer blocks. Sheet body padding is 20px on phones and 28px from 640px. Ledger rows take 8-12px vertical padding.

**The Answer First Rule.** The answer sheet leads the reading order on every width; below `lg` its strip carries an "Ask another question" control that returns focus to the question field.

## Elevation & Depth

Flat at rest. Panels and the sheet are separated from the desk by a 1px line and tone (paper on blue-grey), not shadow. Shadow appears only on layers that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 2px 6px rgb(11 21 48 / 0.08), 0 18px 40px rgb(11 21 48 / 0.18)`; dark uses black at 0.35 / 0.45): the chart tooltip and the evidence drawer only. The drawer's backdrop is navy at 45% (dark: near-black at 65%).

### Named Rules
**The Flat Sheet Rule.** Nothing that sits on the desk casts a shadow. If it does not float over the page, it has no shadow.

## Shapes

Small, mostly square-ish corners. 2px for the marker band, chart bar tops and the citation swipe; 3-4px for tags (SAMPLE, verdicts, note IDs, code spans); 6px for buttons, fields, the field strip and inner boxes; 8px for panels and the answer sheet. The evidence drawer is square-edged as a side sheet from 768px and takes 12px top corners as a bottom sheet on phones. Full rounds only for timeline and preview dots.

Rules are the main structural device: a 2px ink rule under the chart, a 1px ink top rule over every ledger list (causes, split, evidence, live progress), light rules between rows, 3px underlines for active tabs. Empty states use a dashed control border.

## Components

### Buttons
Plain, solid, statement-office buttons.
- **Shape:** gently squared (6px), 40px tall.
- **Primary:** navy fill, white semibold label, 16px side padding (dark: yellow fill, navy label). Hover lightens the navy; press nudges down 1px. Disabled at 60% opacity.
- **Quiet:** paper fill with a control-coloured border, ink semibold label; hover darkens the border to ink-soft and tints the fill; pressed (`aria-pressed`) takes the primary border and select wash. A 32px small size (10px padding, 0.875rem) is used for in-row actions, ratings and bill choices.
- **On the letterhead:** text buttons with a 10% white hover wash (Close, Back, Ask another question).

### Chips (citations)
- **Style:** not chips. Citations are small raised reference groups (0.68rem semibold, raised 0.42em) in muted ink, kept on one line. On hover or focus a yellow highlighter swipe draws in from the left (300ms) behind the ID and the text turns navy.
- **State:** household-note references (M#) sit on the highlighter wash at rest and take full yellow on hover.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** paper on the desk ground.
- **Shadow Strategy:** none (Flat Sheet Rule).
- **Border:** 1px line.
- **Internal Padding:** 20px for left-column panels; the answer sheet is a navy strip (12px by 20-28px) over a body padded 20-28px.

### Inputs / Fields
- **Style:** paper, 1px control border, 6px radius, 12px side padding, 40px tall; muted placeholder.
- **Focus:** border goes to primary and a 3px yellow outline sits flush outside it.
- **Global focus:** every other control gets a 3px yellow outline, 2px offset, with a 5px letterhead-navy halo so the ring reads on both paper and navy.

### Navigation
- **Letterhead:** 64px navy bar: the Mark (a white bill with one yellow highlighted line), the "Why My Bill" wordmark in 800 weight, the household line in letterhead mist behind a faint divider (hidden below 768px), the mode label, and the SAMPLE tag.
- **Tabs:** semibold labels, muted at rest, ink when active with a 3px primary underline that overlaps the 1px line beneath; arrow keys move between tabs. Answer tabs shorten their labels on phones.

### The Highlighter (signature)
A flat yellow band behind a figure that answers the question: navy bold text, 2px corners, 0.16em side padding, never wrapping. When an answer lands it draws in from the left over 560ms (`cubic-bezier(0.16, 1, 0.3, 1)`), 200ms after landing and staggered 140ms per figure, while the figure's ink turns from ink to navy so it stays readable throughout. Each marked figure is a button that opens the evidence drawer. Reduced motion shows it static.

### Where the £ went (signature)
A ledger of labelled rows: label, bar track, right-aligned signed amount, with a bold "Total change" row. Bars are 12px tall in rise brick or fall blue, drawn to one £ scale for both directions; the zero line is a thin axis rule placed by the data (the biggest fall's share of the total span), so the bars use the whole track. On phones the track drops under the label and value.

### Bills chart
Twelve slate bars to one £ scale with nice-step gridlines and a 2px ink baseline; the selected bar is navy with a 6px yellow cap and its amount printed above. Hover or focus shows a navy tooltip with the Float shadow. Every bar is a button that asks about that bill.

### Verdict and confidence tags
4px tags at 0.78-0.82rem semibold with an ink icon: "Supported" on select wash, "Ruled out" outlined in line with muted text, "Inconclusive" with a dashed control border; confidence High on select wash, Medium outlined, Low on rise wash in rise brick.

### Evidence drawer
A native dialog: right side sheet up to 600px from 768px (slides in 32px over 260ms), bottom sheet to 88vh with 12px top corners on phones (rises 24px). Navy header strip, the figure at Display size with the marker, then evidence rows and the SQL in a mono code block on paper tint.

## Do's and Don'ts

### Do:
- **Do** keep yellow to the Yellow Rule list: evidenced figures (the change and the two largest supported causes), the selected bar's cap, SAMPLE, focus and selection.
- **Do** make every marked figure a button that opens its evidence.
- **Do** head every sheet and drawer with the navy letterhead strip.
- **Do** draw money at true length to one scale, with signed amounts right-aligned to one edge.
- **Do** separate ledger rows with light rules under a 1px ink top rule.
- **Do** set citations as small raised reference groups in muted ink that take the highlighter swipe on hover or focus.
- **Do** keep chart bars at 3:1 or better against their panel in both themes.
- **Do** keep the SAMPLE tag visible in the letterhead on every width.

### Don't:
- **Don't** colour ticks or status icons yellow; they are ink.
- **Don't** box citations as chips or pills.
- **Don't** give a split chart separate scales for rises and falls, or fix the zero line at the centre.
- **Don't** put a shadow on anything that sits on the desk.
- **Don't** let rise and fall colour carry meaning without a sign.
- **Don't** add a second typeface or uppercase labels beyond SAMPLE.
- **Don't** build an assistant chat beside KPI tiles on grey cards.
