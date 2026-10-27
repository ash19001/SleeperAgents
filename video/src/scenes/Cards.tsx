import { CloudSun, Database, Droplets, FolderOpen, Gauge, Network, NotebookPen, Receipt, Repeat, ShieldCheck, Tag, Zap } from "lucide-react";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FRANKLIN, MONO, Marker, Monogram, Paper, Rise, Tape, TapeLine, ramp } from "../ui";

const H1: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 96, style }) => (
  <h1 style={{ margin: 0, fontSize: size, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, color: C.navy, ...style }}>{children}</h1>
);

const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

// How bright a group is: full while it's the thing to look at, dimmed while
// something else is. `spans` are [from, to) frames of full attention.
const attention = (frame: number, spans: [number, number][], rest = 0.32) => {
  let on = 0;
  for (const [a, b] of spans) on = Math.max(on, ramp(frame, a, a + 10, Easing.linear) * (1 - ramp(frame, b, b + 10, Easing.linear)));
  return rest + (1 - rest) * on;
};

// ---- Opening

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN, color: "#fff", padding: "0 160px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
      <Rise at={4} style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <Monogram size={150} sweep={ramp(frame, 14, 34)} />
        <span style={{ fontSize: 168, fontWeight: 800, letterSpacing: -4 }}>Why My Bill</span>
      </Rise>
      <Rise at={36}>
        <p style={{ margin: 0, fontSize: 52, lineHeight: 1.3, color: C.letterInk, maxWidth: 1380 }}>
          Ask why a household bill changed. A team of <span style={{ color: "#fff", fontWeight: 700 }}>NVIDIA Nemotron</span> agents works it out from the household&apos;s data, and shows its evidence.
        </p>
      </Rise>
      <Rise at={110}>
        <p style={{ margin: 0, fontSize: 32, color: C.letterInk }}>GenAI Works Open Agent Hackathon 2026 · Track 02 · Zetaris · Meterless</p>
      </Rise>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 12, width: `${ramp(frame, 10, 40) * 100}%`, background: C.yellow }} />
    </AbsoluteFill>
  );
};

// One thing at a time: the claim, then the bill line by line, then what it
// leaves out, then the second half of the claim, then why it matters.
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const left = attention(frame, [[0, 44], [196, 400]]);
  const tape = attention(frame, [[44, 196]], 0.45);
  const notStated = ramp(frame, 150, 162);
  return (
    <Paper section="The problem">
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 700px" }}>
        <div style={{ padding: "90px 72px 0 128px", display: "flex", flexDirection: "column", gap: 44, opacity: left }}>
          <Rise at={4}>
            <H1 size={86}>A bill says what you owe.</H1>
          </Rise>
          <Rise at={196}>
            <H1 size={86}>
              Never <Marker at={214}>why</Marker> it changed.
            </H1>
          </Rise>
          <Rise at={262}>
            <p style={{ margin: 0, fontSize: 44, lineHeight: 1.4, color: C.inkSoft }}>
              Colder weather? More days? A price change, an estimated reading, a new heat pump, a leak? Each needs a different response, and a guess can cost money.
            </p>
          </Rise>
        </div>
        <Tape style={{ padding: "72px 60px", opacity: tape }}>
          <Rise at={44}>
            <p style={{ margin: "8px 0 6px", fontFamily: FRANKLIN, fontSize: 34, fontWeight: 800 }}>Your gas bill, January 2026</p>
          </Rise>
          <TapeLine at={58} l="Period" v="29 Dec to 1 Feb" />
          <TapeLine at={68} l="Days" v="35" />
          <TapeLine at={78} l="Gas used" v="1,879 kWh" />
          <TapeLine at={88} l="Energy" v="£111.38" />
          <TapeLine at={98} l="Standing charge" v="£11.84" />
          <div style={{ borderTop: `2px solid ${C.navy}`, opacity: ramp(frame, 104, 110) }} />
          <TapeLine at={110} l="Total" v="£123.22" size={34} weight={700} />
          <TapeLine at={122} l="Last bill" v="£91.04" />
          <div style={{ margin: "6px -16px 0", padding: "10px 16px", borderRadius: 6, background: `rgba(255, 222, 59, ${0.55 * notStated})`, scale: String(1 + 0.06 * Math.sin(Math.min(1, ramp(frame, 150, 170, Easing.linear)) * Math.PI)) }}>
            <TapeLine at={150} l="Why it changed" v="not stated" size={34} weight={800} colour={C.rise} />
          </div>
        </Tape>
      </div>
    </Paper>
  );
};

// ---- The agent loop, from the deck's diagram (1160 x 650, drawn at 3x).
// A camera moves to each part as it's explained; the rest stays dimmed.

type Rect = [number, number, number, number];
type Step = { at: number; reveal: Rect[]; cam: Rect; text: React.ReactNode; overview?: number[] };
const STEPS: Step[] = [
  { at: 8, reveal: [[0, 0, 470, 215]], cam: [0, 0, 480, 230], text: "A guard checks the question, and Scout signs a contract for this bill." },
  { at: 92, reveal: [[470, 0, 690, 252]], cam: [380, 0, 800, 262], text: "The orchestrator, Nemotron Ultra with reasoning on, plans the work." },
  { at: 176, reveal: [[280, 247, 900, 458], [540, 228, 620, 247]], cam: [270, 220, 910, 470], text: "It sends a task to each specialist. Each runs its own tool loop over Zetaris." },
  { at: 272, reveal: [[280, 458, 900, 480], [540, 480, 905, 605]], cam: [270, 440, 910, 612], text: "Code tests every cause they report." },
  { at: 338, reveal: [[60, 430, 540, 605]], cam: [40, 420, 620, 612], text: "Findings go into the case file: Meterless World Model." },
  { at: 404, reveal: [[0, 228, 545, 256], [0, 256, 60, 605], [56, 256, 300, 345], [0, 530, 115, 570]], cam: [0, 220, 620, 612], text: "Markovian review sends the work round again: up to 2 more rounds." },
  { at: 486, reveal: [], cam: [0, 200, 1010, 650], text: "Round by round, until the case is closed.", overview: [2, 3, 4, 5] },
  { at: 566, reveal: [[575, 585, 1000, 645], [935, 290, 1000, 645], [855, 310, 1000, 350], [980, 350, 1160, 465]], cam: [540, 270, 1160, 650], text: "A specialist whose verdict disagrees with code's measurement is sent back." },
  { at: 650, reveal: [[690, 0, 1160, 215]], cam: [650, 0, 1160, 240], text: "Then the writer drafts, code fills in every figure, and the checker can send it back once." },
  { at: 730, reveal: [], cam: [0, 0, 1160, 650], text: "Agents investigate. Code decides every number.", overview: [0, 1, 2, 3, 4, 5, 7, 8] },
];
export const LOOP_FRAMES = 800;

const SPEC_X = [340, 460, 580, 700, 820];
type Pt = [number, number];
const along = (pts: Pt[], p: number): Pt => {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let d = p * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) return [pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * d) / lens[i], pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * d) / lens[i]];
    d -= lens[i];
  }
  return pts[pts.length - 1];
};
const move = (frame: number, a: number, b: number, pts: Pt[]): Pt[] => (frame < a || frame > b ? [] : [along(pts, ramp(frame, a, b, Easing.inOut(Easing.quad)))]);
const fan = (frame: number, a: number, b: number) => (frame < a || frame > b ? [] : SPEC_X.map((x) => along([[580, 236], [x, 300]], ramp(frame, a, b, Easing.inOut(Easing.quad)))));
const gather = (frame: number, a: number, b: number) => (frame < a || frame > b ? [] : SPEC_X.map((x) => along([[x, 448], [x, 466], [580, 466], [580, 530]], ramp(frame, a, b, Easing.inOut(Easing.quad)))));
const UP: Pt[] = [[112, 550], [36, 550], [36, 242], [560, 242]];

// The viewport the diagram is filmed through.
const VIEW = { top: 250, width: 1920, height: 830 };
const camFor = ([x0, y0, x1, y1]: Rect) => ({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, s: Math.min(1760 / ((x1 - x0) * 1.08), 780 / ((y1 - y0) * 1.1), 3) });

export const Loop: React.FC = () => {
  const frame = useCurrentFrame();
  let cur = 0;
  STEPS.forEach((s, k) => frame >= s.at && (cur = k));
  const from = camFor(STEPS[Math.max(0, cur - 1)].cam), to = camFor(STEPS[cur].cam);
  const p = cur ? interpolate(frame, [STEPS[cur].at, STEPS[cur].at + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: INOUT }) : 1;
  const cam = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, s: from.s + (to.s - from.s) * p };

  // Each step's parts: full while it's the step (or in an overview), dimmed after.
  const level = (k: number, at: number) => {
    const s = STEPS[at];
    return at === k || s.overview?.includes(k) ? 1 : 0.38;
  };
  const bright = (k: number) => {
    if (frame < STEPS[k].at + 14) return 0;
    const shown = ramp(frame, STEPS[k].at + 14, STEPS[k].at + 30);
    const before = cur ? level(k, cur - 1) : 1;
    const now = level(k, cur);
    const q = ramp(frame, STEPS[cur].at + 10, STEPS[cur].at + 24, Easing.linear);
    return shown * (before + (now - before) * q);
  };

  const tokens = [
    ...fan(frame, 206, 252),
    ...gather(frame, 296, 330),
    ...move(frame, 360, 392, [[560, 550], [190, 550]]),
    ...move(frame, 428, 478, UP),
    // A full round while the whole loop is in view.
    ...fan(frame, 500, 520),
    ...gather(frame, 520, 536),
    ...move(frame, 536, 546, [[560, 550], [190, 550]]),
    ...move(frame, 546, 562, UP),
    ...move(frame, 592, 636, [[580, 590], [580, 628], [970, 628], [970, 330], [870, 330]]),
  ];
  const step = STEPS[cur];
  return (
    <Paper>
      <div style={{ position: "absolute", left: 128, right: 128, top: 52 }}>
        <p style={{ margin: 0, fontSize: 34, fontWeight: 700, color: C.muted, letterSpacing: 0.2 }}>How the agents work</p>
        <p key={cur} style={{ margin: "14px 0 0", fontSize: 48, fontWeight: 700, lineHeight: 1.2, color: C.navy, opacity: ramp(frame, step.at, step.at + 14), translate: `0px ${(1 - ramp(frame, step.at, step.at + 14)) * 14}px` }}>
          {step.text}
        </p>
      </div>
      <div style={{ position: "absolute", left: 0, top: VIEW.top, width: VIEW.width, height: VIEW.height, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1160, height: 650, transformOrigin: "0 0", transform: `translate(${VIEW.width / 2 - cam.x * cam.s}px, ${VIEW.height / 2 - cam.y * cam.s}px) scale(${cam.s})` }}>
          <Img src={staticFile("img/loop.png")} style={{ position: "absolute", inset: 0, width: 1160, height: 650, opacity: 0.12 }} />
          {STEPS.flatMap((s, k) =>
            s.reveal.map(([x0, y0, x1, y1], j) => (
              <Img key={`${k}-${j}`} src={staticFile("img/loop.png")} style={{ position: "absolute", inset: 0, width: 1160, height: 650, opacity: bright(k), clipPath: `inset(${y0}px ${1160 - x1}px ${650 - y1}px ${x0}px)` }} />
            )),
          )}
          <svg width={1160} height={650} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {tokens.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={20 / cam.s} fill={C.yellow} stroke={C.navy} strokeWidth={5 / cam.s} />
            ))}
          </svg>
        </div>
      </div>
    </Paper>
  );
};

// ---- Zetaris: the sources, then Zetaris, then the evidence, then the rule.

const SOURCES: { icon: React.ElementType; name: string; kind: string }[] = [
  { icon: Receipt, name: "Energy bills", kind: "supplier feed, JSON" },
  { icon: Gauge, name: "Meter readings", kind: "supplier feed" },
  { icon: Droplets, name: "Water bills", kind: "water company feed" },
  { icon: Tag, name: "Water charges", kind: "water company feed" },
  { icon: Zap, name: "Octopus tariffs", kind: "live public API" },
  { icon: CloudSun, name: "Open-Meteo weather", kind: "live public API" },
];
export const ZETARIS_FRAMES = 450;

// Camera over the Zetaris diagram (its own 1664 x 680 space, placed at 128, 50
// in an 1920 x 880 viewport): the sources, then Zetaris, then the evidence and
// the rule, then the whole picture.
const ZSHOTS: { at: number; r: Rect }[] = [
  { at: 0, r: [-20, 40, 560, 690] },
  { at: 112, r: [470, 90, 1100, 600] },
  { at: 192, r: [1120, 20, 1690, 690] },
  { at: 380, r: [-88, 0, 1752, 780] },
];
const zcam = (frame: number) => {
  // The diagram point at a shot's centre lands mid-viewport (960, 440).
  const fit = ([x0, y0, x1, y1]: Rect) => ({ z: Math.min(1840 / (x1 - x0), 860 / (y1 - y0), 1.45), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
  let k = 0;
  ZSHOTS.forEach((sh, i) => frame >= sh.at && (k = i));
  const a = fit(ZSHOTS[Math.max(0, k - 1)].r), b = fit(ZSHOTS[k].r);
  const p = k ? interpolate(frame, [ZSHOTS[k].at, ZSHOTS[k].at + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: INOUT }) : 1;
  const z = a.z + (b.z - a.z) * p, cx = a.cx + (b.cx - a.cx) * p, cy = a.cy + (b.cy - a.cy) * p;
  return `translate(${960 - 128 - cx * z}px, ${440 - 50 - cy * z}px) scale(${z})`;
};

export const Zetaris: React.FC = () => {
  const frame = useCurrentFrame();
  const rowY = (i: number) => 70 + i * 104;
  const sources = attention(frame, [[0, 110], [380, 500]]);
  const box = attention(frame, [[110, 190], [380, 500]]);
  const tape = attention(frame, [[190, 290], [380, 500]]);
  const rule = attention(frame, [[290, 500]]);
  return (
    <Paper section="Zetaris">
      <div style={{ position: "absolute", left: 128, right: 128, top: 64 }}>
        <Rise at={0}>
          <H1 size={76}>Zetaris is the only way the agents see data.</H1>
        </Rise>
      </div>
      <div style={{ position: "absolute", left: 0, top: 200, width: 1920, height: 880, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 128, top: 50, width: 1664, height: 680, transformOrigin: "0 0", transform: zcam(frame) }}>
        <svg width={1664} height={680} style={{ position: "absolute", inset: 0 }}>
          {SOURCES.map((_, i) => {
            const p = ramp(frame, 104 + i * 4, 134 + i * 4, Easing.inOut(Easing.quad));
            const d = `M500 ${rowY(i) + 34} C 600 ${rowY(i) + 34}, 600 340, 700 340`;
            return <path key={i} d={d} fill="none" stroke={C.control} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} opacity={box} />;
          })}
          <path d="M1060 340 L 1150 340" stroke={C.navy} strokeWidth={4} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ramp(frame, 184, 200)} opacity={tape} />
          <path d="M1150 340 l -14 -9 v 18 z" fill={C.navy} opacity={ramp(frame, 196, 200) * tape} />
        </svg>
        {SOURCES.map(({ icon: Icon, name, kind }, i) => (
          <Rise key={name} at={14 + i * 14} style={{ position: "absolute", left: 0, top: rowY(i), width: 500, display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: sources }}>
              <div style={{ width: 68, height: 68, borderRadius: 999, border: `3px solid ${C.navy}`, display: "grid", placeItems: "center", flex: "none" }}>
                <Icon size={34} color={C.navy} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.navy }}>{name}</div>
                <div style={{ fontSize: 26, color: C.muted }}>{kind}</div>
              </div>
            </div>
          </Rise>
        ))}
        <Rise at={126} style={{ position: "absolute", left: 700, top: 120, width: 360, height: 440 }}>
          <div style={{ height: "100%", background: C.navy, color: "#fff", borderRadius: 18, padding: "36px 36px", display: "flex", flexDirection: "column", gap: 18, borderBottom: `8px solid ${C.yellow}`, opacity: box }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Database size={44} color={C.yellow} strokeWidth={2} />
              <span style={{ fontSize: 48, fontWeight: 800 }}>Zetaris</span>
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.35, color: C.letterInk }}>
              <b style={{ color: "#fff" }}>9</b> Lightning REST tables, cached
              <br />
              <b style={{ color: "#fff" }}>4</b> views in one shape:
            </div>
            <div style={{ fontFamily: MONO, fontSize: 26, lineHeight: 1.45 }}>bills · reads<br />tariffs · weather_daily</div>
          </div>
        </Rise>
        <Rise at={200} style={{ position: "absolute", left: 1170, top: 40, width: 494 }}>
          <Tape style={{ padding: "36px 40px", gap: 12, opacity: tape }}>
            <p style={{ margin: "6px 0 2px", fontFamily: FRANKLIN, fontSize: 30, fontWeight: 800 }}>Evidence E4, gas meter readings</p>
            <p style={{ margin: 0, fontSize: 24, lineHeight: 1.45 }}>
              SELECT utility, read_date,
              <br />
              &nbsp;&nbsp;register, unit, source
              <br />
              FROM whybill.reads
              <br />
              WHERE utility = &apos;gas&apos; …
            </p>
            <div style={{ borderTop: `2px solid ${C.navy}` }} />
            <TapeLine at={222} l="Rows" v="3" size={24} />
            <TapeLine at={232} l="SHA-256" v="dfb0848bce14…" size={24} />
            <TapeLine at={242} l="Cause tested" v="C4, estimate" size={24} />
          </Tape>
        </Rise>
        <Rise at={292} style={{ position: "absolute", left: 1170, top: 560, width: 494 }}>
          <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: C.inkSoft, opacity: rule }}>
            Every agent tool is one <Marker at={310}>read-only SELECT</Marker>, checked against the bill&apos;s signed contract.
          </p>
        </Rise>
      </div>
      </div>
    </Paper>
  );
};

// ---- Meterless: one part at a time.

const PARTS: { icon: React.ElementType; name: string; role: string; proof: string }[] = [
  { icon: Network, name: "Nightshift", role: "Gateway for every Nemotron call, each with a receipt", proof: "18 of 18 calls" },
  { icon: ShieldCheck, name: "Scout Intent", role: "Guard, intent routing and a signed, expiring contract per bill. We built it from the spec; Meterless's own harness passes it", proof: "HMAC-SHA256" },
  { icon: FolderOpen, name: "World Model", role: "The case file: every finding and review is a fact with provenance", proof: "7-part split" },
  { icon: Repeat, name: "Markovian", role: "Runs the orchestrator's review rounds, carrying state between them", proof: "2 steps" },
  { icon: NotebookPen, name: "H-MEM", role: "Household notes and feedback, with an audit trail on the page", proof: "note M1 cited" },
];
const PART_AT = (i: number) => 24 + i * 66;
export const METERLESS_FRAMES = 420;

export const Meterless: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Paper section="Meterless">
      <div style={{ position: "absolute", left: 128, right: 128, top: 64 }}>
        <Rise at={0}>
          <H1 size={76}>Meterless at every step.</H1>
        </Rise>
        <div style={{ marginTop: 44, borderTop: `3px solid ${C.ink}` }}>
          {PARTS.map(({ icon: Icon, name, role, proof }, i) => (
            <Rise key={name} at={PART_AT(i)}>
              <div style={{ display: "grid", gridTemplateColumns: "92px 290px 1fr 300px", alignItems: "center", gap: 28, padding: "30px 0", borderBottom: `1px solid ${C.rule}`, opacity: attention(frame, [[PART_AT(i), PART_AT(i + 1)], [PART_AT(PARTS.length), 600]]) }}>
                <div style={{ width: 80, height: 80, borderRadius: 999, background: C.navy, display: "grid", placeItems: "center" }}>
                  <Icon size={40} color="#fff" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 40, fontWeight: 800, color: C.navy }}>{name}</span>
                <span style={{ fontSize: 31, lineHeight: 1.35, color: C.inkSoft }}>{role}</span>
                <span style={{ fontFamily: MONO, fontSize: 30, color: C.navy, textAlign: "right" }}>{proof}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </Paper>
  );
};

// ---- Results: the claim, then each result in turn.

const RESULT_AT = (i: number) => 78 + i * 34;
export const RESULTS_FRAMES = 330;

export const Results: React.FC = () => {
  const frame = useCurrentFrame();
  const left = attention(frame, [[0, 78], [RESULT_AT(6), 500]]);
  const line = (i: number) => attention(frame, [[RESULT_AT(i), RESULT_AT(i + 1)], [RESULT_AT(6), 500]], 0.4);
  return (
    <Paper section="Results">
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 700px" }}>
        <div style={{ padding: "100px 72px 0 128px", display: "flex", flexDirection: "column", gap: 40, opacity: left }}>
          <Rise at={0}>
            <H1 size={84}>Tested against a planted answer key.</H1>
          </Rise>
          <Rise at={24}>
            <p style={{ margin: 0, fontSize: 42, lineHeight: 1.4, color: C.inkSoft }}>
              Causes were planted in 11 SAMPLE bill pairs, plus a control pair where nothing should be found. Nothing was.
            </p>
          </Rise>
        </div>
        <Tape style={{ padding: "90px 64px", justifyContent: "center" }}>
          <div style={{ opacity: line(0) }}>
            <TapeLine at={RESULT_AT(0)} l="Answer key, 2 runs" v={<Marker at={RESULT_AT(0) + 10}>58/58</Marker>} size={34} weight={700} />
          </div>
          <div style={{ opacity: line(1) }}>
            <TapeLine at={RESULT_AT(1)} l="Planted causes found" v="19/19" size={34} />
          </div>
          <div style={{ opacity: line(2) }}>
            <TapeLine at={RESULT_AT(2)} l="Wrongly supported" v="0/34" size={34} />
          </div>
          <div style={{ opacity: line(3) }}>
            <TapeLine at={RESULT_AT(3)} l="Triage questions" v="25/25" size={34} />
          </div>
          <div style={{ opacity: line(4) }}>
            <TapeLine at={RESULT_AT(4)} l="Scout harness" v="passed" size={34} />
          </div>
          <div style={{ borderTop: `2px solid ${C.navy}`, opacity: ramp(frame, RESULT_AT(5) - 6, RESULT_AT(5)) }} />
          <div style={{ opacity: line(5) }}>
            <TapeLine at={RESULT_AT(5)} l="Automated tests" v="174" size={34} weight={700} />
          </div>
        </Tape>
      </div>
    </Paper>
  );
};

// ---- Close

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN, color: "#fff", padding: "0 160px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
      <Rise at={0} style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <Monogram size={96} />
        <span style={{ fontSize: 110, fontWeight: 800, letterSpacing: -3 }}>Why My Bill</span>
      </Rise>
      <Rise at={24}>
        <p style={{ margin: 0, fontSize: 64, fontWeight: 700, lineHeight: 1.25, maxWidth: 1500 }}>
          Every number traced. Every cause tested. Every fallback said out loud.
        </p>
      </Rise>
      <Rise at={96}>
        <p style={{ margin: 0, fontFamily: MONO, fontSize: 38, color: C.yellow }}>github.com/ash19001/SleeperAgents</p>
        <p style={{ margin: "14px 0 0", fontSize: 32, color: C.letterInk }}>Try it with no keys: replay mode serves recorded live answers.</p>
      </Rise>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 12, width: `${ramp(frame, 0, 30) * 100}%`, background: C.yellow }} />
    </AbsoluteFill>
  );
};
