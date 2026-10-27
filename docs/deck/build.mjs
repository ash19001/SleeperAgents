// Builds the hackathon deck from one source: the HTML draft (docs/deck/index.html)
// and, with --slides <dir> --images <json>, one file per slide for the Slides
// artifact (project/slides/<id>.html, with speaker notes and uploaded image URLs).
// Every style is inline and inside the Slides format's subset, so both outputs
// carry the same markup. Figures come from eval/results.md, eval/answers/ and
// data/sample/.
//
// Run: node docs/deck/build.mjs [--slides <dir> --images <json>]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

const SANS = "'Libre Franklin', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SECTION = `background:#ffffff;color:#0b1530;font-family:${SANS};font-variant-numeric:tabular-nums;padding:0px;display:flex;flex-direction:column`;
const MONOGRAM = `<svg aria-label="Why My Bill monogram" width="34" height="44" viewBox="0 0 34 44"><rect x="1" y="1" width="32" height="42" rx="3" fill="#ffffff"/><rect x="7" y="11" width="20" height="3" fill="#c3cbe0"/><rect x="5" y="20" width="24" height="7" rx="1" fill="#ffde3b"/><rect x="7" y="32" width="14" height="3" fill="#c3cbe0"/></svg>`;

const letterhead = (label) =>
  `<div style="flex:none;height:110px;background:#13224a;border-bottom:6px solid #ffde3b;display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:0px 128px">\n<div style="display:flex;flex-direction:row;align-items:center;gap:20px">${MONOGRAM}<p style="font-size:36px;font-weight:800;letter-spacing:-0.5px;color:#ffffff">Why My Bill</p></div>\n<p style="font-size:24px;color:#c3cbe0">${label}</p>\n</div>`;

// The statement on the left, the receipt tape on the right.
const body = (left, tape, { pad = "56px 72px 64px 128px", gap = 28, justify = "" } = {}) =>
  `<div style="flex:1;display:grid;grid-template-columns:1fr 560px">\n<div style="padding:${pad};display:flex;flex-direction:column;gap:${gap}px${justify}">\n${left}\n</div>\n<div style="background:#f5f7fa;border-left:1px solid #dce1ea;padding:64px 56px;display:flex;flex-direction:column;gap:14px;font-family:${MONO};color:#13224a">\n${tape}\n</div>\n</div>`;

const perf = `<hr style="border-top:3px dashed #a3adc0">`;
const rule = `<hr style="border-top:2px solid #13224a">`;
const tapeHead = (t) => `<p style="font-family:${SANS};font-size:28px;font-weight:800;padding:12px 0px 4px">${t}</p>`;
const line = (l, v) => `<div style="display:flex;flex-direction:row;justify-content:space-between"><p style="font-size:24px">${l}</p><p style="font-size:24px">${v}</p></div>`;
const total = (l, v, colour = "") => `<div style="display:flex;flex-direction:row;justify-content:space-between"><p style="font-size:26px;font-weight:600">${l}</p><p style="font-size:26px;font-weight:600${colour ? `;color:${colour}` : ""}">${v}</p></div>`;
const footnote = (t) => `<p style="font-family:${SANS};font-size:24px;line-height:1.45;color:#59647a;padding:6px 0px 0px">${t}</p>`;
const tape = (...parts) => [perf, ...parts, perf].join("\n");

const h2 = (t) => `<h2 style="font-size:72px;font-weight:800;line-height:1.08;letter-spacing:-1.5px;color:#13224a">${t}</h2>`;
const prose = (t, size = 30) => `<p style="font-size:${size}px;line-height:1.5;color:#3c4760">${t}</p>`;
// The answering figure under the yellow marker, with what it means beside it.
const marked = (figure, text) =>
  `<div style="display:flex;flex-direction:row;align-items:center;gap:24px"><p style="font-size:56px;font-weight:800;line-height:1.1;white-space:nowrap;color:#13224a;background:#ffde3b;padding:0px 12px;border-radius:2px">${figure}</p><p style="flex:1;font-size:28px;line-height:1.4;color:#3c4760">${text}</p></div>`;
const ledger = (rows, { label = 250, size = 28, pad = 12 } = {}) =>
  `<div style="display:flex;flex-direction:column;border-top:2px solid #0b1530">\n${rows
    .map(([l, v]) => `<div style="display:grid;grid-template-columns:${label}px 1fr;gap:32px;padding:${pad}px 0px;border-bottom:1px solid #e8ecf2"><p style="font-size:${size + 2}px;font-weight:700;color:#13224a">${l}</p><p style="font-size:${size}px;line-height:1.4;color:#3c4760">${v}</p></div>`)
    .join("\n")}\n</div>`;
const figure = (label, value, extra = "") =>
  `<div style="display:flex;flex-direction:column;gap:4px"><p style="font-size:24px;color:#59647a">${label}</p>${extra || `<p style="font-size:40px;font-weight:700">${value}</p>`}</div>`;
const change = (value, size, word) =>
  `<div style="display:flex;flex-direction:row;align-items:center;gap:12px"><p style="font-size:${size}px;font-weight:800;color:#13224a;background:#ffde3b;padding:0px 8px;border-radius:2px">${value}</p><p style="font-size:24px;font-weight:700;color:#b42318">${word}</p></div>`;
const muted = (t) => `<span style="color:#59647a">${t}</span>`;

const IMG = { answer: "img/answer.png", evidence: "img/evidence-phone.png" };

// The agent diagram (slide 4): the orchestrator at the top, its specialists
// around it, icons first and labels second. Nodes are pinned in a 1160 x 650
// host; one SVG draws every arrow under them, from the same coordinates.
// Icons are lucide's (lucide-react, ISC), the app's own set.
const LUCIDE = join(here, "..", "..", "node_modules", "lucide-react", "dist", "esm", "icons");
const ICONS = {};
for (const name of ["message-circle-question-mark", "shield-check", "bot", "signature", "network", "receipt-pound-sterling", "tag", "cloud-sun", "gauge", "droplets", "ruler", "pen-line", "list-checks", "merge", "file-check", "database", "notebook-pen", "repeat", "folder-open"]) {
  ICONS[name] = (await import(pathToFileURL(join(LUCIDE, `${name}.mjs`)).href)).__iconData.node;
}
const icon = (name, colour, size = 28) => {
  const shapes = ICONS[name]
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg aria-label="" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="scale(${(size / 24).toFixed(4)})" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</g></svg>`;
};
const KIND = {
  input: ["#ffffff", "3px solid #8792a6", "#13224a"],
  code: ["#f5f7fa", "3px dashed #8792a6", "#13224a"],
  lightning: ["#ffffff", "3px solid #13224a", "#13224a"],
  ultra: ["#13224a", "3px solid #13224a", "#ffffff"],
  answer: ["#fff3b0", "3px solid #ffde3b", "#13224a"],
};
const BORDER = 3;
// A round icon badge; `size` is its outer diameter, border included.
const badge = (kind, iconName, size, iconSize) => {
  const [bg, border, ink] = KIND[kind];
  const inner = size - 2 * BORDER;
  return `<div style="width:${inner}px;height:${inner}px;display:flex;flex-direction:row;align-items:center;justify-content:center;background:${bg};border:${border};border-radius:50%">${icon(iconName, ink, iconSize)}</div>`;
};
const label = (text, size = 24, weight = 800, colour = "#13224a") => `<p style="font-size:${size}px;font-weight:${weight};line-height:1.25;color:${colour};text-align:center;white-space:nowrap">${text}</p>`;
// One node: badge, then name, then a quiet line under it.
const agent = ({ cx, cy, size, iconSize, kind, iconName, name, sub = [], nameSize = 24, width = 120, after = "" }) =>
  `<div style="position:absolute;left:${cx - width / 2}px;top:${cy - size / 2}px;width:${width}px;display:flex;flex-direction:column;align-items:center;gap:6px">${badge(kind, iconName, size, iconSize)}${label(name, nameSize)}${sub.map((t) => label(t, 24, 400, "#59647a")).join("")}${after}</div>`;
const STROKE = "#59647a";
// The pen the arrow helpers draw with: the loop in navy and heavier, the pipeline around it lighter.
let INK = STROKE, WIDTH = 3;
const segment = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="${WIDTH}" fill="none"/>`;
const arrow = (x1, y1, x2, y2) => {
  const t = Math.atan2(y2 - y1, x2 - x1);
  const [len, half] = [16, 8];
  const bx = x2 - len * Math.cos(t), by = y2 - len * Math.sin(t);
  const f = (n) => n.toFixed(1);
  return `${segment(x1, y1, f(bx), f(by))}<path d="M${x2} ${y2}L${f(bx + half * Math.sin(t))} ${f(by - half * Math.cos(t))}L${f(bx - half * Math.sin(t))} ${f(by + half * Math.cos(t))}Z" fill="${INK}"/>`;
};

// A routed path through points, with its head on the last segment.
const route = (...pts) => {
  const [x2, y2] = pts.at(-1);
  const [x1, y1] = pts.at(-2);
  const head = arrow(x1, y1, x2, y2);
  const body = pts.slice(0, -1).map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
  return `<path d="${body}" stroke="${INK}" stroke-width="${WIDTH}" fill="none" stroke-linejoin="round"/>${head}`;
};
// A curved arrow from (x1, y1) to (x2, y2) bending through (cx, cy).
const curve = (x1, y1, cx, cy, x2, y2) => {
  const t = Math.atan2(y2 - cy, x2 - cx);
  const [len, half] = [16, 8];
  const bx = x2 - len * Math.cos(t), by = y2 - len * Math.sin(t);
  const f = (n) => n.toFixed(1);
  return `<path d="M${x1} ${y1}Q${cx} ${cy} ${f(bx)} ${f(by)}" stroke="${INK}" stroke-width="${WIDTH}" fill="none"/><path d="M${x2} ${y2}L${f(bx + half * Math.sin(t))} ${f(by - half * Math.cos(t))}L${f(bx - half * Math.sin(t))} ${f(by + half * Math.cos(t))}Z" fill="${INK}"/>`;
};
const quiet = (left, top, width, html) => `<div style="position:absolute;left:${left}px;top:${top}px;width:${width}px;display:flex;flex-direction:row;align-items:center;gap:8px">${html}</div>`;

const DIAGRAM = (() => {
  // The agentic loop: orchestrator -> specialists -> code measures -> case file -> orchestrator,
  // with the inputs flowing in from the left and the answer out to the right.
  const W = 1160, H = 650, ROW = 80, SMALL = 76, HUB = 134, SPEC = 92, MEASURE = 76, GAP = 4;
  const inputs = [
    [60, "input", "message-circle-question-mark", "Question", "household"],
    [180, "code", "shield-check", "Guard", "code"],
    [300, "lightning", "bot", "Intake", "Lightning"],
    [420, "code", "signature", "Contract", "code"],
  ];
  const outputs = [
    [740, "ultra", "pen-line", "Writer", "Ultra"],
    [860, "code", "list-checks", "Checker", "code"],
    [980, "ultra", "merge", "Combiner", "Ultra"],
    [1100, "answer", "file-check", "Answer", "checked"],
  ];
  const SPEC_Y = 330;
  const specialists = [
    [340, "receipt-pound-sterling", "Billing", false],
    [460, "tag", "Tariff", false],
    [580, "cloud-sun", "Weather", false],
    [700, "gauge", "Usage", true],
    [820, "droplets", "Leak", true],
  ];
  const hub = { cx: 580, cy: ROW };
  const fanFrom = 236; // under the orchestrator's labels
  const bus = 466;
  const measure = { cx: 580, cy: 550 };
  const caseFile = { cx: 150, cy: 550 };
  const quietIcon = (name) => icon(name, "#59647a", 26);

  const nodes = [
    ...inputs.map(([cx, kind, ic, name, sub]) => agent({ cx, cy: ROW, size: SMALL, iconSize: 40, kind, iconName: ic, name, sub: [sub] })),
    agent({ cx: hub.cx, cy: hub.cy, size: HUB, iconSize: 68, kind: "ultra", iconName: "network", name: "Orchestrator", nameSize: 28, width: 260, sub: ["Ultra, reasoning on"] }),
    ...outputs.map(([cx, kind, ic, name, sub]) => agent({ cx, cy: ROW, size: SMALL, iconSize: 40, kind, iconName: ic, name, sub: [sub] })),
    ...specialists.map(([cx, ic, name, notes]) =>
      agent({ cx, cy: SPEC_Y, size: SPEC, iconSize: 50, kind: "lightning", iconName: ic, name, width: 120, after: `<div style="display:flex;flex-direction:row;gap:6px">${quietIcon("database")}${notes ? quietIcon("notebook-pen") : ""}${quietIcon("repeat")}</div>` }),
    ),
    `<div style="position:absolute;left:${measure.cx - MEASURE / 2}px;top:${measure.cy - MEASURE / 2}px;width:400px;display:flex;flex-direction:row;align-items:center;gap:14px">${badge("code", "ruler", MEASURE, 40)}<div style="display:flex;flex-direction:column"><p style="font-size:24px;font-weight:800;line-height:1.25;color:#13224a">Measure</p><p style="font-size:24px;line-height:1.25;color:#59647a">code tests every cause</p></div></div>`,
    `<div style="position:absolute;left:${caseFile.cx - MEASURE / 2}px;top:${caseFile.cy - MEASURE / 2}px;width:${MEASURE}px;display:flex;flex-direction:column;align-items:center">${badge("lightning", "folder-open", MEASURE, 40)}</div>`,
    `<div style="position:absolute;left:${caseFile.cx - 80}px;top:${caseFile.cy - MEASURE / 2 - 70}px;width:160px;display:flex;flex-direction:column;align-items:center">${label("Case file")}${label("World Model", 24, 400, "#59647a")}</div>`,
    quiet(56, 252, 236, `${icon("repeat", "#13224a", 30)}<p style="font-size:24px;line-height:1.25;color:#13224a"><b>Markovian</b>:<br>up to 2 more rounds</p>`),
    quiet(250, 558, 260, `<p style="font-size:24px;line-height:1.25;color:#59647a">findings</p>`),
    quiet(990, 360, 160, `<p style="font-size:24px;line-height:1.25;color:#59647a">sent back when code disagrees</p>`),
  ];

  const r = SMALL / 2 + GAP;
  const paths = [];
  // In and out along the top row: the pipeline, drawn light.
  INK = "#8792a6";
  WIDTH = 3;
  const row = [...inputs.map((n) => n[0]), hub.cx, ...outputs.map((n) => n[0])];
  for (let i = 0; i < row.length - 1; i++) {
    const [x1, x2] = [row[i], row[i + 1]];
    paths.push(arrow(x1 + (x1 === hub.cx ? HUB / 2 + GAP : r), ROW, x2 - (x2 === hub.cx ? HUB / 2 + GAP : r), ROW));
  }
  // The checker sends a failed draft back to the writer once.
  paths.push(curve(860, ROW - r, 800, 2, 740 + 10, ROW - r - 2));
  // The loop: tasks out, measured, recorded, reviewed. Drawn in navy, heavier.
  INK = "#13224a";
  WIDTH = 4;
  for (const [cx] of specialists) paths.push(arrow(hub.cx, fanFrom, cx, SPEC_Y - SPEC / 2 - GAP));
  const specBottom = SPEC_Y - SPEC / 2 + SPEC + 6 + 30 + 6 + 26 + GAP;
  for (const [cx] of specialists) paths.push(segment(cx, specBottom, cx, bus));
  paths.push(segment(specialists[0][0], bus, specialists[4][0], bus));
  paths.push(arrow(measure.cx, bus, measure.cx, measure.cy - MEASURE / 2 - GAP));
  paths.push(arrow(measure.cx - MEASURE / 2 - GAP, measure.cy, caseFile.cx + MEASURE / 2 + GAP, caseFile.cy));
  paths.push(route([caseFile.cx - MEASURE / 2 - GAP, caseFile.cy], [36, caseFile.cy], [36, 242], [hub.cx - 44, 242]));
  // Code sends a contradicted verdict back to its specialist.
  paths.push(route([measure.cx, measure.cy + MEASURE / 2 + GAP], [measure.cx, 628], [970, 628], [970, SPEC_Y], [specialists[4][0] + SPEC / 2 + GAP, SPEC_Y]));

  INK = STROKE;
  WIDTH = 3;
  const svg = `<svg aria-label="The agentic loop: the orchestrator sends tasks to five specialists, code measures every cause, findings go into the case file, and the orchestrator reviews them for up to two more rounds before the writer, checker and combiner produce the answer" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0px;top:0px">${paths.join("")}</svg>`;
  return `<div style="position:relative;width:${W}px;height:${H}px">${svg}\n${nodes.join("\n")}</div>`;
})();

const slides = [
  {
    id: "cover",
    label: "Track 02 · Page 1 of 10",
    pad: "96px 72px 72px 128px",
    justify: ";justify-content:space-between",
    left: [
      `<div style="display:flex;flex-direction:column;gap:36px">`,
      `<h1 style="font-size:120px;font-weight:800;line-height:1.0;letter-spacing:-3px;color:#13224a">Why My Bill</h1>`,
      `<p style="font-size:44px;line-height:1.3;color:#3c4760">An agent team that explains why a household’s electricity, gas or water bill changed: to the penny, with the evidence behind every number.</p>`,
      `</div>`,
      `<div style="display:grid;grid-template-columns:1fr 1fr 1.3fr;border-top:1px solid #dce1ea;border-bottom:1px solid #dce1ea;padding:24px 0px">`,
      `<div style="display:flex;flex-direction:column;gap:4px"><p style="font-size:24px;color:#59647a">Gas, December 2025</p><p style="font-size:44px;font-weight:700">£91.04</p></div>`,
      `<div style="display:flex;flex-direction:column;gap:4px"><p style="font-size:24px;color:#59647a">Gas, January 2026</p><p style="font-size:44px;font-weight:700">£123.22</p></div>`,
      `<div style="display:flex;flex-direction:column;gap:4px"><p style="font-size:24px;color:#59647a">Change</p>${change("+£32.18", 44, "Up. Why?")}</div>`,
      `</div>`,
      `<p style="font-size:24px;line-height:1.45;color:#59647a">GenAI Works Open Agent Hackathon 2026 · Track 02: The Agent That Can Explain Why. A SAMPLE household, with real Octopus prices and Open-Meteo weather.</p>`,
    ],
    tape: tape(
      tapeHead("This statement covers"),
      line("The problem", "2"),
      line("The solution", "3"),
      line("Agent workflow", "4"),
      line("Technical stack", "5"),
      line("Zetaris", "6"),
      line("Meterless", "7"),
      line("What was unique", "8"),
      line("Product visuals", "9"),
      line("What’s next", "10"),
      rule,
      total("Pages", "10"),
      footnote("github.com/ash19001/SleeperAgents"),
    ),
    notes:
      "Why My Bill answers the question every household asks when a bill arrives: why did it go up, or down? A team of NVIDIA Nemotron agents investigates each bill, Zetaris is the only way they read data, and Meterless routes, scopes, remembers and records what they do. Each page is laid out like a bill statement: the claim on the left, and on the right a receipt with the proof.",
  },
  {
    id: "problem",
    label: "The problem · Page 2 of 10",
    gap: 32,
    pad: "64px 72px 72px 128px",
    left: [
      h2("A bill says what you owe. Never why it changed."),
      prose("For UK households with electricity, gas and water bills: the person who opens this month’s bill, sees it’s £32 higher than last month, and wonders why.", 32),
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">`,
      `<div style="display:flex;flex-direction:column;gap:12px;border-top:2px solid #0b1530;padding:16px 0px 0px"><h3 style="font-size:32px;font-weight:800;color:#13224a">Usually mundane</h3><ul style="font-size:30px;line-height:1.5;color:#3c4760"><li>A longer billing period</li><li>A colder month</li><li>A price change</li><li>An estimated reading</li></ul></div>`,
      `<div style="display:flex;flex-direction:column;gap:12px;border-top:2px solid #0b1530;padding:16px 0px 0px"><h3 style="font-size:32px;font-weight:800;color:#13224a">Sometimes it matters</h3><ul style="font-size:30px;line-height:1.5;color:#3c4760"><li>A leak</li><li>A new appliance</li><li>A switch from gas to a heat pump</li></ul></div>`,
      `</div>`,
      prose("Each cause needs a different response, and a guess can cost money: a leak left running, or a tariff switch over a bill that was only longer."),
    ],
    tape: tape(
      tapeHead("Your gas bill, January 2026"),
      line("Period", "29 Dec to 1 Feb"),
      line("Days", "35"),
      line("Gas used", "1,879 kWh"),
      line("Energy", "£111.38"),
      line("Standing charge", "£11.84"),
      rule,
      total("Total", "£123.22"),
      line("Last bill", "£91.04"),
      total("Why it changed", "not stated", "#b42318"),
      footnote("The SAMPLE household’s January bill, line by line: what you owe, and nothing about why."),
    ),
    notes:
      "A supplier’s bill shows what you owe, never why it changed. The receipt on the right is the household’s January gas bill, line by line: £32 more than December, and no reason given. The causes are usually mundane, a longer bill, a colder month, a price change or an estimated reading, but sometimes they matter: a leak, a new appliance, or a switch to a heat pump. Each needs a different response.",
  },
  {
    id: "solution",
    label: "The solution · Page 3 of 10",
    gap: 24,
    left: [
      h2("Ask why a bill changed. Get the whole explanation."),
      `<div style="display:flex;flex-direction:row;gap:12px"><p style="flex:1;font-size:30px;padding:16px 24px;border:2px solid #8792a6;border-radius:6px">Why did my gas bill change in Jan 2026?</p><p style="font-size:30px;font-weight:700;padding:16px 32px;background:#ffde3b;color:#13224a;border-radius:6px">Ask</p></div>`,
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.3fr;border-top:1px solid #dce1ea;border-bottom:1px solid #dce1ea;padding:20px 0px">${figure("Dec 2025 bill", "£91.04")}${figure("Jan 2026 bill", "£123.22")}${figure("Days on the bill", "28 to 35")}${figure("Change", "", change("+£32.18", 40, "Up"))}</div>`,
      `<div style="display:flex;flex-direction:column">`,
      `<div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:10px 0px;border-bottom:1px solid #e8ecf2"><p style="font-size:30px">The later period was colder</p><p style="font-size:30px;font-weight:800;color:#13224a;background:#ffde3b;padding:0px 8px;border-radius:2px">+£27.05</p></div>`,
      `<div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:10px 0px;border-bottom:1px solid #e8ecf2"><p style="font-size:30px">The later bill covered seven more days</p><p style="font-size:30px;font-weight:800;color:#13224a;background:#ffde3b;padding:0px 8px;border-radius:2px">+£20.04</p></div>`,
      `<div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:10px 0px;border-bottom:1px solid #e8ecf2"><p style="font-size:30px">An earlier low estimate caught up in December</p><p style="font-size:30px;font-weight:800;color:#2b54b8;padding:0px 8px">−£10.87</p></div>`,
      `</div>`,
      prose("Unit price −£6.04 and standing charge +£0.21 make up the rest; credits, a fuel switch and extra use were tested and ruled out. Every answer gives the split to the penny, each cause tested, the query behind every figure, how sure it is, and what to do next.", 26),
    ],
    tape: tape(
      tapeHead("How this answer was made"),
      line("Scout guard", "passed"),
      line("Contract", "…6HJ4XW signed"),
      line("Intake · Lightning", "0.7 s"),
      line("Plan · Ultra", "14.8 s"),
      line("Specialists", "4 of 5 (gas)"),
      line("Zetaris queries", "5, hashed"),
      line("Review · Ultra", "8.2 s"),
      line("Writer · Ultra", "5.3 s"),
      line("Checker", "passed"),
      rule,
      total("Model calls", "18"),
      total("Receipts", "18"),
      total("Answered in", "57.6 s"),
      footnote("Writer’s receipt rcpt_req_pijh8x0c. Gas needs four specialists; the fifth, leak, is for water."),
    ),
    notes:
      "This is a real answer from a recorded live run. The household asks in their own words. The gas bill went up £32.18: the colder month added £27.05, seven more days added £20.04, and a catch-up for an earlier low estimate made December larger, which took £10.87 off the rise. The receipt shows how it was made: the guard, a signed contract, the intake agent, the orchestrator’s plan, four specialists, five Zetaris queries, a review, the writer and the checker. Eighteen model calls, each with a Nightshift receipt, in under a minute.",
  },
  {
    id: "workflow",
    label: "Agent workflow · Page 4 of 10",
    gap: 24,
    left: [h2("Agents investigate. Code decides every number."), DIAGRAM],
    tape: tape(
      tapeHead("Reading the loop"),
      `<div style="display:flex;flex-direction:row;align-items:start;gap:12px">${icon("repeat", "#13224a", 30)}<p style="font-family:${SANS};font-size:24px;line-height:1.35">Each specialist’s tool loop: call, read, decide, up to 6 steps</p></div>`,
      `<div style="display:flex;flex-direction:row;align-items:center;gap:12px">${icon("database", "#13224a", 30)}<p style="font-family:${SANS};font-size:24px">Zetaris views, read-only</p></div>`,
      `<div style="display:flex;flex-direction:row;align-items:center;gap:12px">${icon("notebook-pen", "#13224a", 30)}<p style="font-family:${SANS};font-size:24px">H-MEM household notes</p></div>`,
      rule,
      line("Billing", "bills, reads"),
      line("Tariff", "tariffs, bills"),
      line("Weather", "weather, £ split"),
      line("Usage", "reads, £ split, notes"),
      line("Leak", "reads, £ split, notes"),
      rule,
      total("Writes", "none"),
      footnote("Navy: Ultra. Outlined: Lightning. Dashed: code. The arc over the writer is its one rewrite when the checker fails a draft; leak runs for water only."),
    ),
    notes:
      "This is the loop that answers one bill. The question passes Scout’s guard, the intake agent on Nemotron Lightning reads it, and Scout signs a contract naming the data the investigation may read. The orchestrator on Nemotron Ultra, reasoning on, sends a task to each of five Lightning specialists. Each runs its own tool loop: call a read-only tool, read the result, decide the next step, up to six times. Every cause they look at is measured in code, so no model decides a number, and the findings go into the case file in World Model. The orchestrator reviews the case file and either closes it or sends follow-ups, for up to two more rounds that Markovian runs. Code also sends a specialist back when its verdict contradicts the measurement. When the case closes, the writer drafts the answer, the checker in code verifies it and allows one rewrite, and the combiner links bills when there are several. Nothing in the team writes data.",
  },
  {
    id: "stack",
    label: "Technical stack · Page 5 of 10",
    left: [
      h2("Our own agent loop, so every step is visible"),
      ledger(
        [
          ["App", "Next.js 16 (App Router, TypeScript), Tailwind 4, lucide icons"],
          ["Agents", "Our own TypeScript agent loop with zod schemas; no agent framework"],
          ["Models", "NVIDIA Nemotron 3.5 Lightning 30B and Nemotron 3 Ultra 550B, through Meterless Nightshift"],
          ["Data", "Zetaris in local Docker: Lightning REST tables, SchemaStore views, SQL API"],
          ["Engines", "Meterless H-MEM, World Model and Markovian, vendored unchanged; our implementation of Meterless Scout Intent"],
          ["Quality", "Vitest, 174 tests; evaluations for the answer key, triage and the orchestrator"],
        ],
        { label: 200, size: 28, pad: 14 },
      ),
    ],
    tape: tape(
      tapeHead("Nemotron model per agent"),
      line("Intake", "Lightning 30B"),
      line("Specialists ×5", "Lightning 30B"),
      line("Orchestrator", "Ultra 550B"),
      line("Writer", "Ultra 550B"),
      line("Combiner", "Ultra 550B"),
      rule,
      total("Calls per bill", "18 to 27"),
      total("Route", "Nightshift"),
      tapeHead("Orchestrator reasoning, measured"),
      line("Problems sent back", "61% to 93%"),
      line("Closed anyway", "39% to 7%"),
      line("Time per review", "4.6 to 13.5 s"),
      footnote("33 case files with planted problems, reviewed off and on; paired test p = 0.0005. Cursor was not used."),
    ),
    notes:
      "A Next.js app with our own TypeScript agent loop and no agent framework, so every step, retry and fallback is ours and visible on the page. Models are NVIDIA Nemotron, Lightning for the many short parallel steps and Ultra for judgement and wording, always through Meterless Nightshift. Data is Zetaris in Docker. The three Meterless engines are vendored unchanged, and Scout Intent is our implementation of Meterless’s specification. We measured whether the orchestrator should reason before it decides: on 33 case files with planted problems, reasoning sent back 93% of them against 61%, for about nine seconds more per review, so it is on for the orchestrator only. We didn’t use Cursor.",
  },
  {
    id: "zetaris",
    label: "Zetaris · Page 6 of 10",
    left: [
      h2("Zetaris is the only way the agents see data"),
      marked("5 queries", "behind the January gas answer, each read-only and hashed with SHA-256."),
      ledger(
        [
          ["Six sources", "Supplier bills and meter readings, the water company’s bills and charges (three formats), and two live public APIs: Octopus tariffs and Open-Meteo weather"],
          ["Tables and views", "Nine Lightning REST tables, cached; four SchemaStore views put them in one shape: pence to pounds, litres to m³, UTC to UK dates"],
          ["Read-only", "One SELECT per agent tool, checked against the bill’s signed contract; every read is evidence with its SQL and SHA-256"],
          ["Live data in", "A bill the household adds is saved in its supplier’s format; UNCACHE and CACHE TABLE refresh it in about a second"],
        ],
        { label: 250, size: 28, pad: 12 },
      ),
    ],
    tape: tape(
      tapeHead("Evidence E4, gas meter readings"),
      `<p style="font-size:24px;line-height:1.5">SELECT utility, read_date,<br>&#160;&#160;register, unit, source<br>FROM whybill.reads<br>WHERE utility = 'gas'<br>&#160;&#160;AND read_date BETWEEN<br>&#160;&#160;'2025-11-30'<br>&#160;&#160;AND '2026-02-01'<br>ORDER BY read_date</p>`,
      rule,
      line("Rows returned", "3"),
      line("SHA-256", "dfb0848bce14…"),
      line("Cause tested", "C4, estimate"),
      footnote("Checked against the source files: 30 bills, 750 weather days, the same verdicts on all 11 scenarios."),
    ),
    notes:
      "Zetaris is the one data layer. Six sources in three formats, including two live public APIs, Octopus tariffs and Open-Meteo weather, are registered as Lightning REST tables, cached, and put into one shape by four SchemaStore views. Each agent tool sends one read-only statement, checked against the contract, and every read becomes evidence with the exact SQL and a SHA-256 of its rows. The receipt is one of the five queries behind the January answer. When the household adds a missing bill, Zetaris refreshes its copy in about a second.",
  },
  {
    id: "meterless",
    label: "Meterless · Page 7 of 10",
    left: [
      h2("Meterless at every step"),
      marked("18 of 18", "model calls in the January gas answer went through Nightshift, each with a receipt."),
      ledger(
        [
          ["Nightshift", "The gateway for every Nemotron call. The NVIDIA key lives there, and each call’s receipt is on the page."],
          ["Scout Intent", "Published as a spec with no code, so we built it: the guard, intent routing and a signed, expiring contract per bill. Meterless’s own harness passes it."],
          ["World Model", "The case file: bills and causes as entities, every finding and review a fact with provenance."],
          ["Markovian", "Runs the orchestrator’s review rounds, carrying state from one round to the next."],
          ["H-MEM", "Household notes, saved findings, feedback that changes what is recalled, and an audit trail on the page."],
        ],
        { label: 240, size: 27, pad: 12 },
      ),
    ],
    tape: tape(
      tapeHead("Scout contract, this answer"),
      `<p style="font-size:24px">01M5WJW6QWZPSGFRPTG36HJ4XW</p>`,
      line("Intent", "bill.explain.gas"),
      line("Bills", "Dec 2025, Jan 2026"),
      line("Model", "nemotron-ultra"),
      line("Signed", "HMAC-SHA256"),
      line("Expires", "after 5 min"),
      rule,
      total("Receipts", "18 of 18"),
      total("Markovian steps", "2"),
      footnote("H-MEM, World Model and Markovian are vendored unchanged (Apache-2.0)."),
    ),
    notes:
      "Every Meterless part does a real job. Nightshift routes every Nemotron call and gives each a receipt: all 18 in the January answer. Scout Intent is published as a specification with no code, so we implemented it, and Meterless’s own harness scores our build; the receipt is the signed contract from this answer. World Model is the case file the orchestrator reads and the specialists write to. Markovian runs the review rounds. H-MEM keeps household notes, findings and feedback, with its audit on the page.",
  },
  {
    id: "unique",
    label: "What was unique · Page 8 of 10",
    left: [
      h2("Guarantees, not plumbing"),
      marked("58/58", "answer-key checks, in both full runs: on the local files and through Zetaris."),
      `<div style="display:flex;flex-direction:column;border-top:2px solid #0b1530">`,
      ...[
        ["Zetaris is the boundary, not a dump", "The agents never see a file. Every number in an answer traces to a read-only query and a hash of its rows."],
        ["A signed contract scopes every agent", "Scout signs one per bill, naming the bills and data allowed; the agent loop refuses any tool it doesn’t grant."],
        ["Memory the household controls", "A “No” on an answer flags the notes it used, and recall leaves them out until kept. Every change is in H-MEM’s audit, on the page."],
        ["We tested the platform as we built", "Nightshift injected earlier answers into prompts: now a fresh scope per call, 0 of 132 injected. NVIDIA rejected bursts: calls are paced, 68 rejections to none."],
      ].map(
        ([title, text]) =>
          `<div style="display:flex;flex-direction:column;gap:6px;padding:14px 0px;border-bottom:1px solid #e8ecf2"><h3 style="font-size:30px;font-weight:800;color:#13224a">${title}</h3><p style="font-size:26px;line-height:1.45;color:#3c4760">${text}</p></div>`,
      ),
      `</div>`,
    ],
    tape: tape(
      tapeHead("Results"),
      line("Answer key, 2 runs", "58/58"),
      line("Planted causes", "19/19"),
      line("Wrongly supported", "0/34"),
      line("First-draft passes", "18/18"),
      line("Triage questions", "25/25"),
      line("Scout harness", "passed"),
      rule,
      total("Automated tests", "174"),
      footnote("The answer key planted causes in 11 SAMPLE bill pairs, plus a control pair where nothing should be found. Nothing was."),
    ),
    notes:
      "We used the sponsors’ tools as guarantees, not plumbing. Zetaris is the boundary: the agents never see a file, only what a read-only query returns, and every number traces to one. Scout contracts scope each investigation, and the agent loop enforces them on every tool call. H-MEM feedback changes what the agents recall, and the audit is on the page. And we tested the platform as we built: Nightshift was injecting earlier answers into prompts, and NVIDIA rejected bursts of calls; both are fixed and measured. Against a planted answer key, both full runs scored 58 of 58.",
  },
  {
    id: "visuals",
    label: "Product visuals · Page 9 of 10",
    left: [
      h2("The answer comes first; the proof is one tap away"),
      `<div style="display:flex;flex-direction:row;gap:32px;align-items:start">`,
      `<img src="${IMG.answer}" alt="The answer to ‘Why did my gas bill change in Jan 2026?’: the bills, the +£32.18 change highlighted, and the answer with its highlighted causes and citations" style="width:875px;height:572px;object-fit:contain;border:1px solid #dce1ea;border-radius:6px">`,
      `<div style="flex:1;display:flex;flex-direction:column;gap:24px">`,
      `<div style="display:flex;flex-direction:column;gap:6px;border-top:2px solid #0b1530;padding:14px 0px 0px"><h3 style="font-size:28px;font-weight:800;color:#13224a">Answer first</h3><p style="font-size:24px;line-height:1.45;color:#3c4760">The change and its two biggest causes, highlighted.</p></div>`,
      `<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #dce1ea;padding:14px 0px 0px"><h3 style="font-size:28px;font-weight:800;color:#13224a">Proof on tap</h3><p style="font-size:24px;line-height:1.45;color:#3c4760">Each highlight and citation opens its query: right, on a phone.</p></div>`,
      `</div>`,
      `</div>`,
    ],
    tape: tape(
      tapeHead("Tap a figure, see its query"),
      `<div style="display:flex;flex-direction:row;justify-content:center"><img src="${IMG.evidence}" alt="Evidence E4 on a phone: gas meter readings, the SQL sent to Zetaris, 3 rows returned, and the SHA-256 fingerprint of the rows" style="width:414px;height:600px;object-fit:contain;border:1px solid #dce1ea;border-radius:6px"></div>`,
      footnote("Evidence E4 on a phone: the SQL sent to Zetaris, the rows it returned and a SHA-256 of them."),
    ),
    notes:
      "This is the product as a household sees it, from replay mode. The answer leads: the change and its two biggest causes are highlighted, and every figure and citation opens the query behind it. On the right, the evidence drawer on a phone: the SQL Zetaris ran for the gas meter readings, the three rows it returned, and a SHA-256 fingerprint, so anyone can check the data hasn’t changed.",
  },
  {
    id: "next",
    label: "What’s next · Page 10 of 10",
    left: [
      h2("From one SAMPLE household to yours"),
      ledger(
        [
          ["Your own bills", "A postcode or an uploaded bill, for your area’s prices, weather and water charges"],
          ["Read a paper bill", "A photo of the bill, read by a Nemotron vision model"],
          ["Smart-meter data", "Half-hourly readings, to show which days and hours changed"],
          ["More bills", "Broadband and council tax, explained the same way"],
          ["From why to what next", "Compare tariffs when the cause is a price rise"],
        ],
        { label: 380, size: 26, pad: 12 },
      ),
      `<p style="font-size:30px;line-height:1.45;color:#3c4760"><b style="color:#13224a">Try it from a fresh clone, with no keys:</b> replay mode serves recorded live answers.</p>`,
      `<p style="font-size:44px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;color:#13224a">Every number traced. Every cause tested. Every fallback said out loud.</p>`,
    ],
    tape: tape(
      tapeHead("Try it in two minutes"),
      `<p style="font-size:24px;line-height:1.5">git clone https://github.com/<br>&#160;&#160;ash19001/SleeperAgents.git<br>cd SleeperAgents<br>npm ci<br>SAMPLE_MODE=true npm run dev</p>`,
      rule,
      total("Open", "localhost:5175"),
      total("Keys needed", "none"),
      footnote("Replay mode serves recorded live answers. Live mode needs Zetaris, Nightshift and an NVIDIA key."),
    ),
    notes:
      "Today the household is a SAMPLE one with real prices and weather. Next: your own bills, from a postcode or an uploaded bill, or a photo of a paper bill read by a Nemotron vision model; half-hourly smart-meter data; broadband and council tax; and from explaining why to helping with what next, such as comparing tariffs. You can try it now in two minutes with no keys. Every number traced, every cause tested, every fallback said out loud. Thank you.",
  },
];

const sectionHtml = (s, images, withNotes) => {
  let html = `<section id="${s.id}"${withNotes ? ' data-transition="fade"' : ""} style="${SECTION}">\n${letterhead(s.label)}\n${body(s.left.join("\n"), s.tape, { pad: s.pad, gap: s.gap, justify: s.justify })}${withNotes ? `\n<aside>${s.notes}</aside>` : ""}\n</section>`;
  for (const [key, local] of Object.entries(IMG)) html = html.replaceAll(`src="${local}"`, `src="${images[key] ?? local}"`);
  return html;
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="only light">
<title>Why My Bill: hackathon deck</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400..800&display=swap">
<style>
  /* Page chrome only, generated by build.mjs. Each slide carries its own inline styles, in the subset the Slides artifact accepts. */
  :root { color-scheme: only light; }
  body { margin: 0; background: #eef1f6; display: flex; flex-direction: column; align-items: center; gap: 48px; padding: 48px 0; }
  section { flex: none; box-sizing: border-box; width: 1920px; height: 1080px; overflow: hidden; outline: 1px solid #dce1ea; }
  p, h1, h2, h3, ul { margin: 0; }
  ul { padding-left: 1.1em; }
  hr { border: 0; margin: 0; height: 0; width: 100%; }
  ::selection { background: #ffde3b; color: #13224a; }
</style>
</head>
<body>
${slides.map((s) => sectionHtml(s, {}, false)).join("\n\n")}
</body>
</html>
`;
writeFileSync(join(here, "index.html"), page);
console.log(`wrote ${join(here, "index.html")}`);

const slidesDir = opt("--slides");
if (slidesDir) {
  const images = JSON.parse(readFileSync(opt("--images"), "utf8"));
  mkdirSync(join(slidesDir, "project", "slides"), { recursive: true });
  for (const s of slides) writeFileSync(join(slidesDir, "project", "slides", `${s.id}.html`), sectionHtml(s, images, true) + "\n");
  console.log(`wrote ${slides.length} slides to ${join(slidesDir, "project", "slides")}: ${slides.map((s) => s.id).join(", ")}`);
}
