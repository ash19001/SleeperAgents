import { CloudSun, Database, Droplets, FolderOpen, Gauge, Network, NotebookPen, Receipt, Repeat, ShieldCheck, Tag, Zap } from "lucide-react";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FRANKLIN, MONO, Marker, Monogram, Paper, Rise, Tape, TapeLine, ramp } from "../ui";

const H1: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 96, style }) => (
  <h1 style={{ margin: 0, fontSize: size, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, color: C.navy, ...style }}>{children}</h1>
);

// ---- Opening

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN, color: "#fff", padding: "0 160px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
      <Rise at={4} style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <Monogram size={150} sweep={ramp(frame, 14, 34)} />
        <span style={{ fontSize: 168, fontWeight: 800, letterSpacing: -4 }}>Why My Bill</span>
      </Rise>
      <Rise at={30}>
        <p style={{ margin: 0, fontSize: 52, lineHeight: 1.3, color: C.letterInk, maxWidth: 1380 }}>
          Ask why a household bill changed. A team of <span style={{ color: "#fff", fontWeight: 700 }}>NVIDIA Nemotron</span> agents works it out from the household&apos;s data, and shows its evidence.
        </p>
      </Rise>
      <Rise at={52}>
        <p style={{ margin: 0, fontSize: 32, color: C.letterInk }}>GenAI Works Open Agent Hackathon 2026 · Track 02 · Zetaris · Meterless</p>
      </Rise>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 12, width: `${ramp(frame, 10, 40) * 100}%`, background: C.yellow }} />
    </AbsoluteFill>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  return (
  <Paper section="The problem">
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 700px" }}>
      <div style={{ padding: "90px 72px 0 128px", display: "flex", flexDirection: "column", gap: 44 }}>
        <Rise at={4}>
          <H1 size={86}>A bill says what you owe.</H1>
        </Rise>
        <Rise at={34}>
          <H1 size={86}>
            Never <Marker at={52}>why</Marker> it changed.
          </H1>
        </Rise>
        <Rise at={90}>
          <p style={{ margin: 0, fontSize: 44, lineHeight: 1.4, color: C.inkSoft }}>
            Colder weather? More days? A price change, an estimated reading, a new heat pump, a leak? Each needs a different response, and a guess can cost money.
          </p>
        </Rise>
      </div>
      <Tape style={{ padding: "72px 60px" }}>
        <Rise at={10}>
          <p style={{ margin: "8px 0 6px", fontFamily: FRANKLIN, fontSize: 34, fontWeight: 800 }}>Your gas bill, January 2026</p>
        </Rise>
        <TapeLine at={22} l="Period" v="29 Dec to 1 Feb" />
        <TapeLine at={30} l="Days" v="35" />
        <TapeLine at={38} l="Gas used" v="1,879 kWh" />
        <TapeLine at={46} l="Energy" v="£111.38" />
        <TapeLine at={54} l="Standing charge" v="£11.84" />
        <div style={{ borderTop: `2px solid ${C.navy}`, opacity: ramp(frame, 60, 66) }} />
        <TapeLine at={64} l="Total" v="£123.22" size={34} weight={700} />
        <TapeLine at={74} l="Last bill" v="£91.04" />
        <TapeLine at={118} l="Why it changed" v="not stated" size={34} weight={700} colour={C.rise} />
      </Tape>
    </div>
  </Paper>
  );
};

// ---- The agent loop, drawn from the deck's diagram (1160 x 650).

type Rect = [number, number, number, number];
const STEPS: { at: number; rects: Rect[]; text: React.ReactNode }[] = [
  { at: 18, rects: [[0, 0, 470, 215], [470, 0, 690, 252]], text: "A guard checks the question and Scout signs a contract. The orchestrator, Nemotron Ultra with reasoning on, opens the case file." },
  { at: 110, rects: [[280, 247, 900, 458], [540, 228, 620, 247]], text: "It sends tasks to the specialists. Each runs its own tool loop over Zetaris." },
  { at: 190, rects: [[280, 458, 900, 480], [540, 480, 905, 605]], text: "Code tests every cause they report." },
  { at: 245, rects: [[60, 430, 540, 605]], text: "Findings go into the case file: Meterless World Model." },
  { at: 300, rects: [[0, 228, 545, 256], [0, 256, 60, 605], [56, 256, 300, 345], [0, 530, 115, 570]], text: "Markovian review sends the work round again, up to 2 more rounds." },
  { at: 410, rects: [[575, 585, 1000, 645], [935, 290, 1000, 645], [855, 310, 1000, 350], [980, 350, 1160, 465]], text: "A specialist whose verdict disagrees with code's measurement is sent back." },
  { at: 470, rects: [[690, 0, 1160, 215]], text: "Then the writer drafts with placeholders, code fills in every figure, and the checker can send it back once." },
];

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

// One trip round the loop, from frame a to b: out to every specialist, back
// to Measure, into the case file, and up the left side to the orchestrator.
const trip = (frame: number, a: number, b: number): Pt[] => {
  if (frame < a || frame > b) return [];
  const p = (frame - a) / (b - a);
  const q = (from: number, to: number) => interpolate(p, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  if (p < 0.3) return SPEC_X.map((x) => along([[580, 236], [x, 300]], q(0, 0.3)));
  if (p < 0.55) return SPEC_X.map((x) => along([[x, 448], [x, 466], [580, 466], [580, 530]], q(0.3, 0.55)));
  if (p < 0.72) return [along([[560, 550], [190, 550]], q(0.55, 0.72))];
  return [along([[112, 550], [36, 550], [36, 242], [560, 242]], q(0.72, 1))];
};

export const Loop: React.FC = () => {
  const frame = useCurrentFrame();
  const K = 1.24;
  const step = [...STEPS].reverse().find((s) => frame >= s.at);
  const tokens = [...trip(frame, 112, 300), ...trip(frame, 300, 372), ...trip(frame, 372, 430)];
  const sent = frame >= 412 && frame <= 452 ? [along([[580, 590], [580, 628], [970, 628], [970, 330], [870, 330]], ramp(frame, 412, 452, Easing.inOut(Easing.quad)))] : [];
  return (
    <Paper>
      <div style={{ position: "absolute", left: 128, right: 128, top: 56 }}>
        <Rise at={0}>
          <H1 size={68}>Agents investigate. Code decides every number.</H1>
        </Rise>
        <p key={step?.at} style={{ margin: "22px 0 0", fontSize: 38, lineHeight: 1.3, color: C.inkSoft, minHeight: 100, opacity: step ? ramp(frame, step.at, step.at + 12) : 0 }}>
          {step?.text}
        </p>
      </div>
      <div style={{ position: "absolute", left: (1920 - 1160 * K) / 2, top: 262, width: 1160, height: 650, scale: String(K), transformOrigin: "0 0" }}>
        <Img src={staticFile("img/loop.png")} style={{ position: "absolute", inset: 0, width: 1160, height: 650, opacity: 0.13 * ramp(frame, 0, 14) }} />
        {STEPS.flatMap((s, i) =>
          s.rects.map(([x0, y0, x1, y1], j) => (
            <Img
              key={`${i}-${j}`}
              src={staticFile("img/loop.png")}
              style={{ position: "absolute", inset: 0, width: 1160, height: 650, opacity: ramp(frame, s.at, s.at + 16), clipPath: `inset(${y0}px ${1160 - x1}px ${650 - y1}px ${x0}px)` }}
            />
          )),
        )}
        <svg width={1160} height={650} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {[...tokens, ...sent].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={11} fill={C.yellow} stroke={C.navy} strokeWidth={3} />
          ))}
        </svg>
      </div>
    </Paper>
  );
};

// ---- Zetaris

const SOURCES: { icon: React.ElementType; name: string; kind: string }[] = [
  { icon: Receipt, name: "Energy bills", kind: "supplier feed, JSON" },
  { icon: Gauge, name: "Meter readings", kind: "supplier feed" },
  { icon: Droplets, name: "Water bills", kind: "water company feed" },
  { icon: Tag, name: "Water charges", kind: "water company feed" },
  { icon: Zap, name: "Octopus tariffs", kind: "live public API" },
  { icon: CloudSun, name: "Open-Meteo weather", kind: "live public API" },
];

export const Zetaris: React.FC = () => {
  const frame = useCurrentFrame();
  const rowY = (i: number) => 70 + i * 104;
  return (
    <Paper section="Zetaris">
      <div style={{ position: "absolute", left: 128, right: 128, top: 64 }}>
        <Rise at={0}>
          <H1 size={76}>Zetaris is the only way the agents see data.</H1>
        </Rise>
      </div>
      <div style={{ position: "absolute", left: 128, top: 250, width: 1664, height: 680 }}>
        <svg width={1664} height={680} style={{ position: "absolute", inset: 0 }}>
          {SOURCES.map((_, i) => {
            const p = ramp(frame, 40 + i * 6, 70 + i * 6, Easing.inOut(Easing.quad));
            const d = `M500 ${rowY(i) + 34} C 600 ${rowY(i) + 34}, 600 340, 700 340`;
            return <path key={i} d={d} fill="none" stroke={C.control} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />;
          })}
          <path d="M1060 340 L 1150 340" stroke={C.navy} strokeWidth={4} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - ramp(frame, 120, 140)} />
          <path d="M1150 340 l -14 -9 v 18 z" fill={C.navy} opacity={ramp(frame, 136, 140)} />
        </svg>
        {SOURCES.map(({ icon: Icon, name, kind }, i) => (
          <Rise key={name} at={8 + i * 6} style={{ position: "absolute", left: 0, top: rowY(i), width: 500, display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 68, height: 68, borderRadius: 999, border: `3px solid ${C.navy}`, display: "grid", placeItems: "center", flex: "none" }}>
              <Icon size={34} color={C.navy} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.navy }}>{name}</div>
              <div style={{ fontSize: 26, color: C.muted }}>{kind}</div>
            </div>
          </Rise>
        ))}
        <Rise at={80} style={{ position: "absolute", left: 700, top: 120, width: 360, height: 440, background: C.navy, color: "#fff", borderRadius: 18, padding: "36px 36px", display: "flex", flexDirection: "column", gap: 18, borderBottom: `8px solid ${C.yellow}` }}>
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
        </Rise>
        <Rise at={140} style={{ position: "absolute", left: 1170, top: 40, width: 494 }}>
          <Tape style={{ padding: "36px 40px", gap: 12 }}>
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
            <TapeLine at={160} l="Rows" v="3" size={24} />
            <TapeLine at={166} l="SHA-256" v="dfb0848bce14…" size={24} />
            <TapeLine at={172} l="Cause tested" v="C4, estimate" size={24} />
          </Tape>
        </Rise>
        <Rise at={190} style={{ position: "absolute", left: 1170, top: 560, width: 494 }}>
          <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: C.inkSoft }}>
            Every agent tool is one <Marker at={206}>read-only SELECT</Marker>, checked against the bill&apos;s signed contract.
          </p>
        </Rise>
      </div>
    </Paper>
  );
};

// ---- Meterless

const PARTS: { icon: React.ElementType; name: string; role: string; proof: string }[] = [
  { icon: Network, name: "Nightshift", role: "Gateway for every Nemotron call, each with a receipt", proof: "18 of 18 calls" },
  { icon: ShieldCheck, name: "Scout Intent", role: "Guard, intent routing and a signed, expiring contract per bill. We built it from the spec; Meterless's own harness passes it", proof: "HMAC-SHA256" },
  { icon: FolderOpen, name: "World Model", role: "The case file: every finding and review is a fact with provenance", proof: "7-part split" },
  { icon: Repeat, name: "Markovian", role: "Runs the orchestrator's review rounds, carrying state between them", proof: "2 steps" },
  { icon: NotebookPen, name: "H-MEM", role: "Household notes and feedback, with an audit trail on the page", proof: "note M1 cited" },
];

export const Meterless: React.FC = () => (
  <Paper section="Meterless">
    <div style={{ position: "absolute", left: 128, right: 128, top: 64 }}>
      <Rise at={0}>
        <H1 size={76}>Meterless at every step.</H1>
      </Rise>
      <div style={{ marginTop: 44, borderTop: `3px solid ${C.ink}` }}>
        {PARTS.map(({ icon: Icon, name, role, proof }, i) => (
          <Rise key={name} at={16 + i * 22} style={{ display: "grid", gridTemplateColumns: "92px 290px 1fr 300px", alignItems: "center", gap: 28, padding: "30px 0", borderBottom: `1px solid ${C.rule}` }}>
            <div style={{ width: 80, height: 80, borderRadius: 999, background: C.navy, display: "grid", placeItems: "center" }}>
              <Icon size={40} color="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 40, fontWeight: 800, color: C.navy }}>{name}</span>
            <span style={{ fontSize: 31, lineHeight: 1.35, color: C.inkSoft }}>{role}</span>
            <span style={{ fontFamily: MONO, fontSize: 30, color: C.navy, textAlign: "right" }}>{proof}</span>
          </Rise>
        ))}
      </div>
    </div>
  </Paper>
);

// ---- Results

export const Results: React.FC = () => (
  <Paper section="Results">
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 700px" }}>
      <div style={{ padding: "100px 72px 0 128px", display: "flex", flexDirection: "column", gap: 40 }}>
        <Rise at={0}>
          <H1 size={84}>Tested against a planted answer key.</H1>
        </Rise>
        <Rise at={20}>
          <p style={{ margin: 0, fontSize: 42, lineHeight: 1.4, color: C.inkSoft }}>
            Causes were planted in 11 SAMPLE bill pairs, plus a control pair where nothing should be found. Nothing was.
          </p>
        </Rise>
      </div>
      <Tape style={{ padding: "90px 64px", justifyContent: "center" }}>
        <TapeLine at={20} l="Answer key, 2 runs" v={<Marker at={110}>58/58</Marker>} size={34} weight={700} />
        <TapeLine at={34} l="Planted causes found" v="19/19" size={34} />
        <TapeLine at={46} l="Wrongly supported" v="0/34" size={34} />
        <TapeLine at={58} l="Triage questions" v="25/25" size={34} />
        <TapeLine at={70} l="Scout harness" v="passed" size={34} />
        <div style={{ borderTop: `2px solid ${C.navy}` }} />
        <TapeLine at={82} l="Automated tests" v="174" size={34} weight={700} />
      </Tape>
    </div>
  </Paper>
);

// ---- Close

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN, color: "#fff", padding: "0 160px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 46 }}>
      <Rise at={0} style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <Monogram size={96} />
        <span style={{ fontSize: 110, fontWeight: 800, letterSpacing: -3 }}>Why My Bill</span>
      </Rise>
      <Rise at={14}>
        <p style={{ margin: 0, fontSize: 64, fontWeight: 700, lineHeight: 1.25, maxWidth: 1500 }}>
          Every number traced. Every cause tested. Every fallback said out loud.
        </p>
      </Rise>
      <Rise at={34}>
        <p style={{ margin: 0, fontFamily: MONO, fontSize: 38, color: C.yellow }}>github.com/ash19001/SleeperAgents</p>
        <p style={{ margin: "14px 0 0", fontSize: 32, color: C.letterInk }}>Try it with no keys: replay mode serves recorded live answers.</p>
      </Rise>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 12, width: `${ramp(frame, 0, 30) * 100}%`, background: C.yellow }} />
    </AbsoluteFill>
  );
};
