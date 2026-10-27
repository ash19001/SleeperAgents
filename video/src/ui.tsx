import { loadFont } from "@remotion/google-fonts/LibreFranklin";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FOOTAGE } from "./footage";

// The product's own world: navy letterhead, yellow highlighter, Libre Franklin.
export const { fontFamily: FRANKLIN } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
export const C = {
  navy: "#13224a",
  yellow: "#ffde3b",
  wash: "#fff3b0",
  ink: "#0b1530",
  inkSoft: "#3c4760",
  muted: "#59647a",
  paperTint: "#f5f7fa",
  rule: "#dce1ea",
  control: "#8792a6",
  letterInk: "#c3cbe0",
  rise: "#b42318",
};

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

// 0 → 1 between two frames, clamped.
export const ramp = (frame: number, from: number, to: number, easing = EASE) =>
  interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

// Fades and lifts in at a frame.
export const Rise: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; distance?: number }> = ({ at, children, style, distance = 24 }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 18);
  return <div style={{ opacity: p, translate: `0px ${(1 - p) * distance}px`, ...style }}>{children}</div>;
};

export const Monogram: React.FC<{ size?: number; sweep?: number }> = ({ size = 44, sweep = 1 }) => (
  <svg width={(size * 34) / 44} height={size} viewBox="0 0 34 44">
    <rect x="1" y="1" width="32" height="42" rx="3" fill="#ffffff" />
    <rect x="7" y="11" width="20" height="3" fill={C.letterInk} />
    <rect x="5" y="20" width={24 * sweep} height="7" rx="1" fill={C.yellow} />
    <rect x="7" y="32" width="14" height="3" fill={C.letterInk} />
  </svg>
);

export const Letterhead: React.FC<{ section: string }> = ({ section }) => (
  <div style={{ height: 110, background: C.navy, borderBottom: `6px solid ${C.yellow}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 128px", flex: "none" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <Monogram size={44} />
      <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5, color: "#fff" }}>Why My Bill</span>
    </div>
    <span style={{ fontSize: 26, color: C.letterInk }}>{section}</span>
  </div>
);

export const Paper: React.FC<{ section?: string; children: React.ReactNode }> = ({ section, children }) => (
  <AbsoluteFill style={{ background: "#fff", color: C.ink, fontFamily: FRANKLIN, fontVariantNumeric: "tabular-nums", display: "flex", flexDirection: "column" }}>
    {section ? <Letterhead section={section} /> : null}
    <div style={{ flex: 1, position: "relative" }}>{children}</div>
  </AbsoluteFill>
);

// The yellow highlighter, swept across from a frame.
export const Marker: React.FC<{ at: number; children: React.ReactNode; dur?: number }> = ({ at, children, dur = 14 }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + dur, INOUT);
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${C.yellow}, ${C.yellow})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${p * 100}% 100%`,
        padding: "0 10px",
        margin: "0 -4px",
        borderRadius: 3,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
};

// A receipt tape: the deck's "proof" panel.
export const Tape: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: C.paperTint, borderLeft: `1px solid ${C.rule}`, padding: "64px 56px", display: "flex", flexDirection: "column", gap: 14, fontFamily: MONO, color: C.navy, ...style }}>
    <div style={{ borderTop: "3px dashed #a3adc0" }} />
    {children}
    <div style={{ borderTop: "3px dashed #a3adc0" }} />
  </div>
);

export const TapeLine: React.FC<{ at: number; l: React.ReactNode; v: React.ReactNode; size?: number; weight?: number; colour?: string }> = ({ at, l, v, size = 30, weight = 400, colour }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 6, Easing.linear);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: size, fontWeight: weight, opacity: p, color: colour }}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
};

// ---- Footage: recorded browser clips, played back in a window with camera moves.

export type Segment = { from: number; to: number; speed: number }; // clip seconds
export type Shot = { t: number; x: number; y: number; z: number }; // output seconds; focus in clip px
export type Line = { from: number; to: number; text: React.ReactNode }; // output seconds

export const segmentsSeconds = (segments: Segment[]) => segments.reduce((s, g) => s + (g.to - g.from) / g.speed, 0);

const clipTime = (segments: Segment[], t: number) => {
  let start = 0;
  for (const g of segments) {
    const len = (g.to - g.from) / g.speed;
    if (t < start + len) return g.from + (t - start) * g.speed;
    start += len;
  }
  return segments[segments.length - 1].to;
};

const frameAt = (times: number[], t: number) => {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

const camera = (shots: Shot[], t: number) => {
  if (!shots.length) return { x: 960, y: 540, z: 1 };
  if (t <= shots[0].t) return shots[0];
  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i], b = shots[i + 1];
    if (t <= b.t) {
      const p = interpolate(t, [a.t, b.t], [0, 1], { easing: INOUT });
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p };
    }
  }
  return shots[shots.length - 1];
};

const WIN = { left: 160, top: 34, width: 1600, height: 900 };

export const FootageScene: React.FC<{ clip: string; segments: Segment[]; shots?: Shot[]; lines: Line[]; badge?: { from: number; to: number; text: string } }> = ({ clip, segments, shots = [], lines, badge }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const c = FOOTAGE[clip];
  const i = frameAt(c.times, clipTime(segments, t));
  const cam = camera(shots, t);
  const z = cam.z;
  const x = Math.min(Math.max(cam.x, 960 / z), 1920 - 960 / z);
  const y = Math.min(Math.max(cam.y, 540 / z), 1080 - 540 / z);
  const line = lines.find((l) => t >= l.from && t < l.to);
  const lineIn = line ? ramp(frame, line.from * fps, line.from * fps + 12) : 0;
  const lineOut = line ? 1 - ramp(frame, line.to * fps - 8, line.to * fps, Easing.linear) : 0;
  const badgeOn = badge && t >= badge.from && t < badge.to ? ramp(frame, badge.from * fps, badge.from * fps + 10) * (1 - ramp(frame, badge.to * fps - 8, badge.to * fps, Easing.linear)) : 0;

  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN }}>
      <div style={{ position: "absolute", ...WIN, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.14)", background: "#fff" }}>
        <div style={{ width: 1920, height: 1080, scale: String(WIN.width / 1920), transformOrigin: "0 0" }}>
          <div style={{ width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${960 - x * z}px, ${540 - y * z}px) scale(${z})` }}>
            <Img src={staticFile(`footage/${clip}/${String(i).padStart(5, "0")}.jpg`)} style={{ width: 1920, height: 1080, display: "block" }} />
          </div>
        </div>
        {badge ? (
          <div style={{ position: "absolute", right: 24, top: 24, opacity: badgeOn, background: C.yellow, color: C.navy, fontSize: 28, fontWeight: 800, padding: "8px 18px", borderRadius: 999, boxShadow: "0 6px 20px rgba(11,21,48,0.25)" }}>
            {badge.text}
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: WIN.top + WIN.height, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {line ? (
          <p style={{ margin: 0, fontSize: 44, fontWeight: 600, color: "#fff", textAlign: "center", lineHeight: 1.2, opacity: lineIn * lineOut, translate: `0px ${(1 - lineIn) * 16}px` }}>{line.text}</p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Yellow emphasis inside a caption on navy.
export const Hi: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: C.yellow, color: C.navy, padding: "0 10px", borderRadius: 3, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{children}</span>
);
