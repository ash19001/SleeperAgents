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

// ---- Footage: recorded browser clips, played back in a window. Each beat
// shows one thing: the camera moves to it and the rest is dimmed.

export type Rect = [number, number, number, number]; // x0, y0, x1, y1 in clip pixels (1920 x 1080)
export type Beat = {
  from: number; // clip seconds
  to: number;
  speed?: number;
  focus?: Rect; // none: the whole window
  text?: React.ReactNode | null; // a new caption; undefined keeps the last one, null clears it
  badge?: string;
  spot?: boolean; // dim around the focus (default true)
};

export const beatsSeconds = (beats: Beat[]) => beats.reduce((s, b) => s + (b.to - b.from) / (b.speed ?? 1), 0);

const frameAt = (times: number[], t: number) => {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

const ZMAX = 2.3;
const target = (r?: Rect) => {
  if (!r) return { x: 960, y: 540, z: 1 };
  const w = (r[2] - r[0]) * 1.12, h = (r[3] - r[1]) * 1.12;
  const z = Math.max(1, Math.min(ZMAX, 1920 / w, 1080 / h));
  const x = Math.min(Math.max((r[0] + r[2]) / 2, 960 / z), 1920 - 960 / z);
  const y = Math.min(Math.max((r[1] + r[3]) / 2, 540 / z), 1080 - 540 / z);
  return { x, y, z };
};

const CAM = 0.8; // seconds for the camera to move to the next focus
const WIN = { left: 160, top: 34, width: 1600, height: 900 };

export const FootageScene: React.FC<{ clip: string; beats: Beat[] }> = ({ clip, beats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const c = FOOTAGE[clip];

  // Where each beat starts in the scene, and its caption and badge spans.
  const starts: number[] = [];
  let acc = 0;
  for (const b of beats) {
    starts.push(acc);
    acc += (b.to - b.from) / (b.speed ?? 1);
  }
  const ends = beats.map((b, i) => starts[i] + (b.to - b.from) / (b.speed ?? 1));
  let i = beats.findIndex((_, k) => t < ends[k]);
  if (i < 0) i = beats.length - 1;
  const b = beats[i];
  const clipT = Math.min(b.to, b.from + (t - starts[i]) * (b.speed ?? 1));
  const img = frameAt(c.times, clipT);

  // Camera: ease from the last beat's focus to this one's.
  const prev = target(i ? beats[i - 1].focus : undefined), next = target(b.focus);
  const p = interpolate(t, [starts[i], starts[i] + CAM], [i ? 0 : 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: INOUT });
  const cam = { x: prev.x + (next.x - prev.x) * p, y: prev.y + (next.y - prev.y) * p, z: prev.z + (next.z - prev.z) * p };

  // Spotlight on the focus once the camera has arrived.
  const same = (a?: Rect, z?: Rect) => !!a && !!z && a.every((v, k) => v === z[k]);
  const keepsAfter = same(beats[i + 1]?.focus, b.focus) && beats[i + 1]?.spot !== false;
  const keptBefore = i > 0 && same(beats[i - 1].focus, b.focus) && beats[i - 1].spot !== false;
  const spotOn = b.focus && b.spot !== false
    ? (keptBefore ? 1 : interpolate(t, [starts[i] + CAM * 0.6, starts[i] + CAM + 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) *
      (keepsAfter ? 1 : interpolate(t, [ends[i] - 0.25, ends[i]], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
    : 0;

  // Caption: the latest beat at or before this one that set one.
  let g = i;
  while (g > 0 && beats[g].text === undefined) g--;
  const text = beats[g].text ?? null;
  let gEnd = i;
  while (gEnd + 1 < beats.length && beats[gEnd + 1].text === undefined) gEnd++;
  const lineIn = ramp(frame, starts[g] * fps, starts[g] * fps + 12);
  const lineOut = 1 - ramp(frame, ends[gEnd] * fps - 8, ends[gEnd] * fps, Easing.linear);

  let a0 = i, a1 = i;
  while (a0 > 0 && beats[a0 - 1].badge === b.badge) a0--;
  while (a1 + 1 < beats.length && beats[a1 + 1].badge === b.badge) a1++;
  const badgeOn = b.badge ? ramp(frame, starts[a0] * fps, starts[a0] * fps + 10) * (1 - ramp(frame, ends[a1] * fps - 8, ends[a1] * fps, Easing.linear)) : 0;

  const r = b.focus;
  const pad = 14;
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: FRANKLIN }}>
      <div style={{ position: "absolute", ...WIN, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.14)", background: "#fff" }}>
        <div style={{ width: 1920, height: 1080, scale: String(WIN.width / 1920), transformOrigin: "0 0" }}>
          <div style={{ width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${960 - cam.x * cam.z}px, ${540 - cam.y * cam.z}px) scale(${cam.z})` }}>
            <Img src={staticFile(`footage/${clip}/${String(img).padStart(5, "0")}.jpg`)} style={{ width: 1920, height: 1080, display: "block" }} />
            {r && spotOn > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: r[0] - pad,
                  top: r[1] - pad,
                  width: r[2] - r[0] + pad * 2,
                  height: r[3] - r[1] + pad * 2,
                  borderRadius: 14,
                  boxShadow: `0 0 0 4000px rgba(11, 21, 48, ${0.5 * spotOn}), 0 0 0 4px rgba(255, 222, 59, ${spotOn})`,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: WIN.top + WIN.height, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {b.badge ? (
          <div style={{ position: "absolute", top: 12, opacity: badgeOn, background: C.yellow, color: C.navy, fontSize: 26, fontWeight: 800, padding: "3px 16px", borderRadius: 999 }}>{b.badge}</div>
        ) : null}
        {text ? (
          <p style={{ margin: b.badge ? "34px 0 0" : 0, fontSize: 44, fontWeight: 600, color: "#fff", textAlign: "center", lineHeight: 1.2, opacity: lineIn * lineOut, translate: `0px ${(1 - lineIn) * 16}px` }}>{text}</p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Yellow emphasis inside a caption on navy.
export const Hi: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: C.yellow, color: C.navy, padding: "0 10px", borderRadius: 3, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{children}</span>
);
