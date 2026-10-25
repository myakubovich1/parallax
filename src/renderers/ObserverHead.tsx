import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { SimClock } from '../lib/clock';
import { fixed } from '../lib/format';
import { claimFlight, fly, leaveFlight, observerParams, type FlightRect } from '../lib/observerFlight';
import { EGG_FAST, onRobotCue, revealEgg } from '../lib/eggs';
import { WAVELENGTH_M, WAVE_NUMBER, classify, phaseOffsetMeters, resultantAmplitude, y1, y2, yTotal, type WaveParams } from '../lib/physics/wave';
import { C, MONO, seeded } from './palette';
import { fillMath } from './WaveRenderer';

/**
 * Entry-screen "observer": a dot-matrix android whose two eyes are the two source
 * waves and whose mouth is their sum. The head is decorative; every trace inside the
 * eyes and mouth is the real wave model, drawn at one shared vertical scale.
 */

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CELL = 3; // dot-matrix pitch in CSS px
export const EYE = { x: 0.325, v: -0.1, hw: 0.285, hh: 0.14, r: 0.05 };
const EYE_SPAN_M = 2 * WAVELENGTH_M;
export const HIGHLIGHT = '#ECFFB8';
const PIXEL = "'VT323', 'IBM Plex Mono', monospace";
/** Probe positions (m) shared by the eyes, the mouth and the swatch columns. */
const PROBES = [1 / 6, 0.5, 5 / 6, 7 / 6, 1.5, 11 / 6];
const ENTRANCE_MS = 250;
const PULSE_MS = 220;
const GLOW_FADE_MS = 200;
const IDLE_FRAME_MS = 1000 / 30;

const STATE_TEXT = { constructive: 'CONSTRUCTIVE', partial: 'PARTIAL', destructive: 'DESTRUCTIVE', cancellation: 'CANCELLED' } as const;

/** Easter-egg timings (ms). All are one-off and skipped (caption only) under reduced motion. */
const EGG_MS = { blink: 280, glance: 1300, ouch: 1600, flicker: 360, dizzy: 1400, shake: 700, resonance: 1800, pleaseStop: 1500, nod: 650, classic: 1700, exhale: 450, hush: 2600 };
const STARE_MS = EGG_FAST ? 1500 : 8000;

interface EggTimes {
  blinkAt: number; glanceDir: number; ouchAt: number; dizzyAt: number; resonanceAt: number;
  nodAt: number; classicAt: number; hushAt: number; exhaleAt: number;
}
const NEVER = -1e9;
const freshEggTimes = (): EggTimes => ({ blinkAt: NEVER, glanceDir: 1, ouchAt: NEVER, dizzyAt: NEVER, resonanceAt: NEVER, nodAt: NEVER, classicAt: NEVER, hushAt: NEVER, exhaleAt: NEVER });

/** What this frame should show, derived from when each egg last fired. */
interface EggPaint {
  blink: number; // 0..1 eyelid closure
  dizzy: number; // seconds into the spiral, or −1
  flicker: boolean;
  stamp: string | null;
  ear: 'amber' | 'flash' | null;
  ripple: number; // 0..1, or −1
  classic: boolean;
  brow: number | null; // expression override
  split: number; // 0..1 stereo separation (Shift)
}
function eggPaint(e: EggTimes, now: number, reduced: boolean, split: number): EggPaint {
  const age = (t: number) => now - t;
  const within = (t: number, ms: number) => age(t) >= 0 && age(t) < ms;
  const resonanceEnd = EGG_MS.resonance;
  return {
    blink: !reduced && within(e.blinkAt, EGG_MS.blink) ? Math.sin((Math.PI * age(e.blinkAt)) / EGG_MS.blink) : 0,
    dizzy: !reduced && within(e.dizzyAt, EGG_MS.dizzy) ? age(e.dizzyAt) / 1000 : -1,
    flicker: !reduced && within(e.ouchAt, EGG_MS.flicker) && Math.floor(age(e.ouchAt) / 60) % 2 === 0,
    stamp: within(e.classicAt, EGG_MS.classic) ? 'CLASSIC.'
      : within(e.ouchAt, EGG_MS.ouch) ? 'OUCH'
      : age(e.resonanceAt) >= resonanceEnd && within(e.resonanceAt, resonanceEnd + EGG_MS.pleaseStop) ? 'PLEASE STOP'
      : within(e.hushAt, EGG_MS.hush) ? 'SHHH…'
      : null,
    ear: within(e.ouchAt, EGG_MS.ouch) ? 'amber' : within(e.exhaleAt, EGG_MS.exhale) ? 'flash' : null,
    ripple: !reduced && within(e.resonanceAt, resonanceEnd) ? age(e.resonanceAt) / resonanceEnd : -1,
    classic: within(e.classicAt, EGG_MS.classic),
    brow: within(e.classicAt, EGG_MS.classic) ? 1.4 : within(e.exhaleAt, EGG_MS.exhale) ? 0.6 : null,
    split,
  };
}
/** Head motion requested by eggs: glance after a blink, dizzy shake, resonance wobble, nod. */
function eggMotion(e: EggTimes, now: number): { yaw: number; pitch: number } {
  let yaw = 0, pitch = 0;
  const g = now - e.blinkAt - EGG_MS.blink;
  if (g >= 0 && g < EGG_MS.glance) yaw += e.glanceDir * 0.75 * Math.sin((Math.PI * g) / EGG_MS.glance);
  const sh = now - e.dizzyAt - EGG_MS.dizzy;
  if (sh >= 0 && sh < EGG_MS.shake) yaw += 0.5 * Math.sin(sh / 18) * (1 - sh / EGG_MS.shake);
  const r = now - e.resonanceAt;
  if (r >= 0 && r < EGG_MS.resonance) {
    const decay = 1 - r / EGG_MS.resonance;
    yaw += 0.45 * Math.sin((2 * Math.PI * 2.2 * r) / 1000) * decay;
    pitch += 0.18 * Math.sin((2 * Math.PI * 4.4 * r) / 1000) * decay;
  }
  const n = now - e.nodAt;
  if (n >= 0 && n < EGG_MS.nod) pitch += 0.7 * Math.sin((Math.PI * n) / EGG_MS.nod);
  return { yaw, pitch };
}
const eggBusy = (e: EggTimes, now: number) =>
  now - e.blinkAt < EGG_MS.blink + EGG_MS.glance || now - e.ouchAt < EGG_MS.ouch || now - e.dizzyAt < EGG_MS.dizzy + EGG_MS.shake ||
  now - e.resonanceAt < EGG_MS.resonance + EGG_MS.pleaseStop || now - e.nodAt < EGG_MS.nod || now - e.classicAt < EGG_MS.classic ||
  now - e.exhaleAt < EGG_MS.exhale || now - e.hushAt < EGG_MS.hush;

interface Props {
  params: WaveParams;
  clock: SimClock;
  focus: string | null;
  effects: boolean;
  reducedMotion: boolean;
  /** Direct manipulation: dragging the wave in the right eye sets φ. */
  onPhase?: (phi: number) => void;
  /** The phase slider, so circuit traces can run from its thumb into the head. */
  sliderRef?: RefObject<HTMLInputElement>;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Geometry {
  W: number;
  H: number;
  S: number;
  cx: number;
  cy: number;
  unit: number; // px per relative amplitude unit, shared by eyes and mouth
  pxPerM: number;
  eyes: [Rect, Rect];
  mouth: Rect;
  mouthV: number;
  mouthHH: number;
  swatches: boolean;
  pad: number;
  parallax: number; // how far raised features shift when the head turns
}

const sdRoundBox = (px: number, py: number, bx: number, by: number, r: number) => {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
};
/** Interleaved gradient noise: cheap, blue-noise-like jitter for the halftone. */
const ign = (x: number, y: number) => {
  const a = 0.06711056 * x + 0.00583715 * y;
  const b = 52.9829189 * (a - Math.floor(a));
  return b - Math.floor(b);
};

function geometry(W: number, H: number, yaw: number, pitch: number): Geometry {
  const narrow = W < 520;
  const S = Math.max(60, Math.min((H - 16) / 1.96, narrow ? (W - 8) / 1.36 : (W - 128) / 1.62));
  const cy = Math.max(14 + 0.96 * S, (H - 1.96 * S) / 2 + 0.96 * S);
  return headGeometry(W, H, S, W / 2, cy, yaw, pitch, { pad: 7, swatches: !narrow && W > 600, parallax: 1 });
}

/** Head region shared by the preview, the flight snapshot and the docked miniature. */
export const HEAD_BOX = { u0: -0.84, u1: 0.84, v0: -0.96, v1: 0.72 };
export const headBox = (g: Geometry): Rect => ({
  x: g.cx + HEAD_BOX.u0 * g.S,
  y: g.cy + HEAD_BOX.v0 * g.S,
  w: (HEAD_BOX.u1 - HEAD_BOX.u0) * g.S,
  h: (HEAD_BOX.v1 - HEAD_BOX.v0) * g.S,
});

export function headGeometry(
  W: number, H: number, S: number, cx: number, cy: number, yaw: number, pitch: number,
  { pad, swatches, parallax }: { pad: number; swatches: boolean; parallax: number },
): Geometry {
  const unit = Math.max(pad > 2 ? 4 : 0.5, (EYE.hh * S - pad) / 1.6);
  const mouthHH = (2.15 * unit + pad) / S; // preview amplitudes are fixed at 1, so |y| ≤ 2
  const mouthV = EYE.v + EYE.hh + 0.1 + mouthHH;
  // Raised features shift further than the skull when the head turns: parallax.
  const shift = (dome: number) => ({ dx: yaw * 0.07 * dome * S * parallax, dy: pitch * 0.05 * dome * S * parallax });
  const eyeShift = shift(0.86);
  const eyes = [-1, 1].map((s) => ({
    x: cx + (s * EYE.x - EYE.hw) * S + eyeShift.dx,
    y: cy + (EYE.v - EYE.hh) * S + eyeShift.dy,
    w: 2 * EYE.hw * S,
    h: 2 * EYE.hh * S,
  })) as [Rect, Rect];
  const mShift = shift(0.62);
  const mouth = { x: cx - 0.36 * S + mShift.dx, y: cy + (mouthV - mouthHH) * S + mShift.dy, w: 0.72 * S, h: 2 * mouthHH * S };
  return { W, H, S, cx, cy, unit, pxPerM: (eyes[0].w - 2 * pad) / EYE_SPAN_M, eyes, mouth, mouthV, mouthHH, swatches, pad, parallax };
}

/**
 * Height field of the head in face units at rest.
 * region: 0 none, 1 shell, 2 eye screen, 3 mouth screen.
 */
export function sampleHead(u: number, v: number, g: Geometry): [number, number] {
  const au = Math.abs(u);
  const rx = v > 0.1 ? 0.74 - (v - 0.1) * 0.5 : 0.74;
  const e = (u / rx) ** 2 + ((v + 0.12) / 0.82) ** 2;
  if (e >= 1) {
    // Ear modules: slatted housings with a window for the LED strip.
    const ear = sdRoundBox(au - 0.765, v - EYE.v, 0.065, 0.17, 0.035);
    if (ear < 0) {
      const led = Math.abs(v - EYE.v) < 0.07 && Math.abs(au - 0.765) < 0.022;
      const slat = !led && Math.floor((v - EYE.v + 0.17) / 0.045) % 2 === 1 ? -0.06 : 0;
      return [0.46 + slat + Math.min(0.12, -ear * 2.5) - (led ? 0.14 : 0), 1];
    }
    // Neck tapers into a collar ring.
    if (v > 0.58 && v < 0.86) {
      const w = 0.21 - (v - 0.58) * 0.12;
      if (au < w) {
        const ring = Math.floor((v - 0.58) / 0.05) % 2 === 1 ? -0.05 : 0;
        return [0.42 * Math.sqrt(1 - (u / w) ** 2) + ring, 1];
      }
    }
    const collar = sdRoundBox(u, v - 0.93, 0.46, 0.075, 0.06);
    if (collar < 0) {
      const bevel = Math.min(0.14, -collar * 2.2);
      const notch = au < 0.05 && v < 0.9 ? -0.08 : 0;
      return [0.28 + bevel + notch - au * 0.12, 1];
    }
    return [0, 0];
  }
  const dome = Math.sqrt(1 - e);
  let h = dome * 0.9;

  // Eye sockets are recessed, deeper below the eye, so the cheek beneath falls into shadow;
  // a raised bezel frames each screen.
  for (const s of [-1, 1]) {
    const d = sdRoundBox(u - s * EYE.x, v - EYE.v, EYE.hw, EYE.hh, EYE.r);
    if (d < 0) return [h, 2];
    const reach = v > EYE.v ? 0.12 : 0.07;
    if (d < reach) h -= 0.12 * (1 - d / reach) ** 1.6;
    if (d < 0.026) h += 0.11 * (1 - d / 0.026);
  }
  const dm = sdRoundBox(u, v - g.mouthV, 0.36, g.mouthHH, 0.05);
  if (dm < 0) return [h, 3];
  if (dm < 0.06) h -= 0.07 * (1 - dm / 0.06) ** 1.6;
  if (dm < 0.026) h += 0.1 * (1 - dm / 0.026);

  // Cheekbones: angled ridges from the outer eye corner toward the mouth.
  const top = EYE.v + EYE.hh;
  for (const s of [-1, 1]) {
    const dl = sdSegment(u, v, s * 0.66, top + 0.04, s * 0.42, top + 0.2);
    h += 0.075 * Math.exp(-((dl / 0.035) ** 2));
  }
  // Chin.
  const chinV = g.mouthV + g.mouthHH + 0.075;
  h += 0.08 * Math.exp(-((u / 0.17) ** 2 + ((v - chinV) / 0.045) ** 2));
  // Forehead plate outline and crown seam: grooves, not ledges.
  if (Math.abs(sdRoundBox(u, v + 0.53, 0.34, 0.13, 0.08)) < 0.009) h -= 0.06;
  if (au < 0.009 && v < -0.72) h -= 0.1;
  // Cheek vents.
  if (au > 0.5 && au < 0.63 && v > top + 0.08 && v < top + 0.3 && Math.floor((v - EYE.v) / 0.038) % 2 === 0) h -= 0.09;
  return [h, 1];
}

export interface Field {
  cols: number;
  rows: number;
  left: number;
  top: number;
  region: Uint8Array;
  dome: Float32Array;
  ao: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  cell: number;
  silhouette: HTMLCanvasElement;
}

/** Surface of the head at rest, computed once per size. Turning only relights and shifts it. */
export function buildField(g: Geometry, dpr: number, cell = CELL): Field {
  const top = Math.max(0, Math.floor((g.cy - 0.96 * g.S) / cell));
  const bottom = Math.min(Math.ceil(g.H / cell), Math.ceil((g.cy + 1.02 * g.S) / cell));
  const left = Math.max(0, Math.floor((g.cx - 0.86 * g.S) / cell));
  const right = Math.min(Math.ceil(g.W / cell), Math.ceil((g.cx + 0.86 * g.S) / cell));
  const cols = right - left;
  const rows = bottom - top;
  const n = cols * rows;
  const f: Field = {
    cols, rows, left, top, cell,
    region: new Uint8Array(n), dome: new Float32Array(n), ao: new Float32Array(n),
    nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
    silhouette: document.createElement('canvas'),
  };
  const sil = f.silhouette;
  sil.width = Math.round(g.W * dpr);
  sil.height = Math.round(g.H * dpr);
  const sctx = sil.getContext('2d')!;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.fillStyle = C.bg;
  const eps = cell / g.S;
  const tilt = 2.4; // exaggerated relief so the halftone carries form, not flat fields
  const eyeBottom = EYE.v + EYE.hh;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const u = ((left + c) * cell - g.cx) / g.S;
      const v = ((top + r) * cell - g.cy) / g.S;
      const region = sampleHead(u, v, g)[1];
      if (!region) continue;
      f.region[i] = region;
      sctx.fillRect((left + c) * cell, (top + r) * cell, cell, cell);
      const rx = v > 0.1 ? 0.74 - (v - 0.1) * 0.5 : 0.74;
      f.dome[i] = Math.sqrt(Math.max(0, 1 - (u / rx) ** 2 - ((v + 0.12) / 0.82) ** 2));
      // Shadow cast by each eye housing onto the cheek below it.
      let ao = 1;
      for (const s of [-1, 1]) {
        const below = v - eyeBottom;
        if (below > 0 && below < 0.14 && Math.abs(u - s * EYE.x) < EYE.hw + 0.02) ao = Math.min(ao, 0.5 + 0.5 * (below / 0.14));
      }
      f.ao[i] = ao;
      if (region > 1) continue;
      const hx = (sampleHead(u + eps, v, g)[0] - sampleHead(u - eps, v, g)[0]) / (2 * eps);
      const hy = (sampleHead(u, v + eps, g)[0] - sampleHead(u, v - eps, g)[0]) / (2 * eps);
      const nx = -hx * tilt, ny = -hy * tilt;
      const nn = Math.hypot(nx, ny, 1);
      f.nx[i] = nx / nn;
      f.ny[i] = ny / nn;
      f.nz[i] = 1 / nn;
    }
  }
  return f;
}

function drawScene(ctx: CanvasRenderingContext2D, g: Geometry, yaw: number, pitch: number) {
  // Perspective tunnel behind the head; its vanishing point drifts against the head.
  const vx = g.cx - yaw * 16;
  const vy = g.cy - 0.18 * g.S - pitch * 12;
  const outer = { x: 10, y: 10, w: g.W - 20, h: g.H - 20 };
  const rects = [1, 0.8, 0.63, 0.49].map((k) => ({
    x: vx + (outer.x - vx) * k,
    y: vy + (outer.y - vy) * k,
    w: outer.w * k,
    h: outer.h * k,
  }));
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.25;
  rects.forEach((r, i) => {
    ctx.strokeStyle = `rgba(195, 248, 107, ${0.14 + i * 0.05})`;
    ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
  });
  const inner = rects[rects.length - 1];
  ctx.strokeStyle = 'rgba(195, 248, 107, 0.18)';
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    for (const [ox, oy, ix, iy] of [
      [outer.x + outer.w * t, outer.y, inner.x + inner.w * t, inner.y],
      [outer.x + outer.w * t, outer.y + outer.h, inner.x + inner.w * t, inner.y + inner.h],
      [outer.x, outer.y + outer.h * t, inner.x, inner.y + inner.h * t],
      [outer.x + outer.w, outer.y + outer.h * t, inner.x + inner.w, inner.y + inner.h * t],
    ]) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ix, iy);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  if (g.swatches) for (const r of swatchRects(g)) {
    ctx.strokeStyle = 'rgba(195, 248, 107, 0.4)';
    ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
  }
}

/**
 * Silhouette plus relit halftone. Dot size follows brightness (up to one cell), jittered by
 * blue-noise so shadows read as gradients rather than specks. The surface comes from the cache.
 */
export function drawHead(ctx: CanvasRenderingContext2D, g: Geometry, f: Field, dpr: number, yaw: number, pitch: number, gain = 1) {
  // Occlude the tunnel behind the head, shifted with the skull.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(f.silhouette, Math.round(yaw * 0.035 * g.S * g.parallax * dpr), Math.round(pitch * 0.025 * g.S * g.parallax * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Key light follows the gaze, plus a cool rim from the right and a specular glint.
  let lx = -0.42 + yaw * 0.6, ly = -0.6 + pitch * 0.5, lz = 0.68;
  const ln = Math.hypot(lx, ly, lz);
  lx /= ln; ly /= ln; lz /= ln;
  let hx = lx, hy = ly, hz = lz + 1;
  const hn = Math.hypot(hx, hy, hz);
  hx /= hn; hy /= hn; hz /= hn;
  const lime: number[] = [];
  const glint: number[] = [];
  const cell = f.cell;
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const i = r * f.cols + c;
      if (f.region[i] !== 1) continue;
      const nx = f.nx[i], ny = f.ny[i], nz = f.nz[i];
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const spec = Math.max(0, nx * hx + ny * hy + nz * hz) ** 48;
      const rim = Math.max(0, nx * 0.8 - ny * 0.1) ** 3 * 0.35;
      const d = f.dome[i];
      const fill = Math.max(0, nz * 0.75 + ny * 0.35) * 0.3; // soft fill from below-front
      const b = gain * f.ao[i] * (0.03 + 0.78 * diffuse ** 1.9 + fill + rim + 0.25 * spec) * (0.45 + 0.55 * Math.min(1, d * 1.8 + 0.2));
      const col = f.left + c, row = f.top + r;
      const size = cell * Math.min(1, b * 1.1 + (ign(col, row) - 0.5) * 0.28);
      if (size < cell * 0.22) continue;
      const o = (cell - size) / 2;
      const px = col * cell + o + yaw * 0.07 * d * g.S * g.parallax;
      const py = row * cell + o + pitch * 0.05 * d * g.S * g.parallax;
      (b > 0.92 ? glint : lime).push(px, py, size);
    }
  }
  ctx.fillStyle = C.lime;
  ctx.globalAlpha = 0.92;
  for (let k = 0; k < lime.length; k += 3) ctx.fillRect(lime[k], lime[k + 1], lime[k + 2], lime[k + 2]);
  ctx.fillStyle = HIGHLIGHT;
  ctx.globalAlpha = 1;
  for (let k = 0; k < glint.length; k += 3) ctx.fillRect(glint[k], glint[k + 1], glint[k + 2], glint[k + 2]);
  ctx.globalAlpha = 1;
}

function buildLayer(layer: HTMLCanvasElement, g: Geometry, f: Field, dpr: number, yaw: number, pitch: number, scene = true) {
  if (layer.width !== Math.round(g.W * dpr) || layer.height !== Math.round(g.H * dpr)) {
    layer.width = Math.round(g.W * dpr);
    layer.height = Math.round(g.H * dpr);
  }
  const ctx = layer.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);
  if (scene) drawScene(ctx, g, yaw, pitch);
  drawHead(ctx, g, f, dpr, yaw, pitch);
}

/** Phosphor bloom: a blurred copy of the layer, built only once the head is at rest. */
function buildBloom(bloom: HTMLCanvasElement, layer: HTMLCanvasElement, dpr: number) {
  bloom.width = layer.width;
  bloom.height = layer.height;
  const ctx = bloom.getContext('2d')!;
  ctx.clearRect(0, 0, bloom.width, bloom.height);
  ctx.filter = `blur(${Math.round(5 * dpr)}px)`;
  ctx.drawImage(layer, 0, 0);
  ctx.filter = 'none';
}

function swatchRects(g: Geometry): Rect[] {
  const size = Math.min(40, (g.H - 150) / 6 - 12);
  const gap = (g.H - 110 - 40 - size * 6) / 5;
  const out: Rect[] = [];
  for (const side of [0, 1]) for (let i = 0; i < 6; i++) {
    out.push({ x: side ? g.W - 24 - size : 24, y: 82 + i * (size + gap), w: size, h: size });
  }
  return out;
}

/** 17 ordered-dither levels per colour and size, rendered once and blitted per frame. */
const tileCache = new Map<string, HTMLCanvasElement>();
function swatchTile(color: string, level: number, size: number, dpr: number) {
  const key = `${color}|${level}|${size}|${dpr}`;
  let tile = tileCache.get(key);
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = Math.round(size * dpr);
  tile.height = Math.round(size * dpr);
  const ctx = tile.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  const cells = Math.floor((size - 2) / 3);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    if (BAYER[(y % 4) * 4 + (x % 4)] < level) ctx.fillRect(1 + x * 3, 1 + y * 3, 2, 2);
  }
  tileCache.set(key, tile);
  return tile;
}

const roundRectPath = (ctx: CanvasRenderingContext2D, r: Rect, rad: number) => {
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
};

interface Particle { x: number; o: number }

/** One screen: stippled displacement columns, luminous particles, exact trace. */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  g: Geometry,
  fn: (x: number) => number,
  color: string,
  particles: Particle[],
  effects: boolean,
  pulse: number,
) {
  const spanM = (r.w - 2 * g.pad) / g.pxPerM;
  const x0 = r.x + g.pad;
  const mid = r.y + r.h / 2;
  const X = (x: number) => x0 + x * g.pxPerM;
  const rad = Math.max(4, EYE.r * g.S);

  ctx.save();
  roundRectPath(ctx, r, rad);
  ctx.fillStyle = '#030605';
  ctx.fill();
  ctx.clip();
  // Screen raster and a λ/4 measurement grid.
  ctx.fillStyle = 'rgba(195, 248, 107, 0.035)';
  for (let y = r.y; y < r.y + r.h; y += 3) ctx.fillRect(r.x, y, r.w, 1);
  ctx.strokeStyle = 'rgba(195, 248, 107, 0.1)';
  ctx.lineWidth = 1;
  for (let q = 0; q <= spanM * 4; q++) {
    const x = Math.round(X(q * 0.25)) + 0.5;
    ctx.globalAlpha = q % 4 === 0 ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(224, 235, 224, 0.25)';
  ctx.beginPath();
  ctx.moveTo(r.x, Math.round(mid) + 0.5);
  ctx.lineTo(r.x + r.w, Math.round(mid) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  const cols = Math.round(spanM * 24);
  ctx.globalAlpha = 0.3;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * spanM;
    const disp = fn(x) * g.unit;
    const n = Math.floor(Math.abs(disp) / 3);
    for (let d = 1; d <= n; d++) ctx.fillRect(X(x) - 0.6, mid - Math.sign(disp) * d * 3 - 0.6, 1.2, 1.2);
  }
  ctx.globalCompositeOperation = effects ? 'lighter' : 'source-over';
  for (const q of particles) {
    if (q.x > spanM) continue;
    ctx.globalAlpha = 0.5 + 0.35 * Math.abs(q.o);
    ctx.fillRect(X(q.x) - 0.9, mid - fn(q.x) * g.unit + q.o * 2.2 - 0.9, 1.8, 1.8);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.75;
  if (effects) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 9;
  }
  ctx.beginPath();
  for (let px = 0; px <= r.w - 2 * g.pad; px += 1.5) {
    const y = mid - fn(px / g.pxPerM) * g.unit;
    px === 0 ? ctx.moveTo(x0 + px, y) : ctx.lineTo(x0 + px, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Bezel; brightens briefly when the phase changes.
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.lineWidth = 1 + 1.5 * pulse;
  if (effects && pulse > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * pulse;
  }
  roundRectPath(ctx, { x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }, rad);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  return { X, mid };
}

/** A polyline with a stroked length, so a pulse can travel along it. */
interface Trace { pts: [number, number][]; len: number }
const makeTrace = (pts: [number, number][]): Trace => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, len };
};
const pointAt = (t: Trace, d: number): [number, number] => {
  for (let i = 1; i < t.pts.length; i++) {
    const [ax, ay] = t.pts[i - 1], [bx, by] = t.pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (d <= seg) return [ax + ((bx - ax) * d) / seg, ay + ((by - ay) * d) / seg];
    d -= seg;
  }
  return t.pts[t.pts.length - 1];
};

interface LiveState {
  t: number;
  now: number;
  focus: string | null;
  effects: boolean;
  pulse: number; // 1 → 0 after a phase change
  pulseTravel: number; // 0 → 1 along the circuit trace, or -1 when idle
  brow: number; // eased expression, −1 calm … 1 delighted
  thumbX: number | null;
  hoverEye: boolean;
  dragging: boolean;
  headOnly: boolean;
  dpr: number;
  egg: EggPaint | null;
}

function paintLive(ctx: CanvasRenderingContext2D, g: Geometry, p: WaveParams, particles: Particle[], s: LiveState) {
  const { t, effects } = s;
  const AR = resultantAmplitude(p);
  const compact = g.W < 520;
  const [L, R] = g.eyes;
  const M = g.mouth;
  const strong = s.focus === 'phi' || s.dragging;

  // Circuit traces: from the phase slider's thumb, up through the collar and neck, to the right eye.
  if (!s.headOnly && s.thumbX !== null) {
    const tx = Math.max(8, Math.min(g.W - 8, s.thumbX));
    const neckX = g.cx + 0.1 * g.S;
    const jawY = g.cy + 0.6 * g.S;
    const cheekX = R.x + R.w * 0.62;
    const trace = makeTrace([
      [tx, g.H],
      [tx, g.H - 12],
      [neckX + (tx > neckX ? 12 : -12), g.H - 12],
      [neckX, g.H - 24],
      [neckX, jawY],
      [cheekX, R.y + R.h + 26],
      [cheekX, R.y + R.h],
    ]);
    ctx.lineJoin = 'round';
    for (const [off, a] of [[-1.5, 0.45], [1.5, 0.22]] as const) {
      ctx.strokeStyle = `rgba(195, 248, 107, ${a + 0.35 * s.pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      trace.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + off, y) : ctx.moveTo(x + off, y)));
      ctx.stroke();
    }
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = 'rgba(195, 248, 107, 0.7)';
    for (const [x, y] of trace.pts.slice(1, -1)) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (s.pulseTravel >= 0) {
      const d = s.pulseTravel * trace.len;
      ctx.fillStyle = HIGHLIGHT;
      if (effects) {
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 12;
      }
      for (let k = 0; k < 6; k++) {
        const [x, y] = pointAt(trace, Math.max(0, d - k * 5));
        ctx.globalAlpha = 1 - k / 6;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  // Probe buses: the left eye feeds the y₁ swatches, the mouth feeds the y swatches.
  const swatches = g.swatches && !s.headOnly ? swatchRects(g) : [];
  if (swatches.length) {
    ctx.lineWidth = 1;
    PROBES.forEach((x, i) => {
      const lx = L.x + g.pad + x * g.pxPerM;
      const sw = swatches[i];
      const busY = L.y + L.h + 7 + i * 3;
      ctx.strokeStyle = 'rgba(195, 248, 107, 0.22)';
      ctx.beginPath();
      ctx.moveTo(lx, L.y + L.h - 3);
      ctx.lineTo(lx, busY);
      ctx.lineTo(sw.x + sw.w + 12 + i * 3, busY);
      ctx.lineTo(sw.x + sw.w + 12 + i * 3, sw.y + sw.h / 2);
      ctx.lineTo(sw.x + sw.w, sw.y + sw.h / 2);
      ctx.stroke();
      const mx = M.x + g.pad + x * g.pxPerM;
      const rs = swatches[6 + i];
      const busY2 = M.y + M.h + 6 + i * 3;
      ctx.strokeStyle = 'rgba(224, 235, 224, 0.18)';
      ctx.beginPath();
      ctx.moveTo(mx, M.y + M.h - 3);
      ctx.lineTo(mx, busY2);
      ctx.lineTo(rs.x - 12 - i * 3, busY2);
      ctx.lineTo(rs.x - 12 - i * 3, rs.y + rs.h / 2);
      ctx.lineTo(rs.x, rs.y + rs.h / 2);
      ctx.stroke();
    });
    swatches.forEach((r, i) => {
      const side = i >= 6 ? 1 : 0;
      const x = PROBES[i % 6];
      const val = side ? yTotal(x, t, p) / 2 : y1(x, t, p);
      const level = Math.round(Math.max(0, Math.min(1, (val + 1) / 2)) * 16);
      ctx.drawImage(swatchTile(side ? C.text : C.lime, level, r.w, s.dpr), r.x, r.y, r.w, r.h);
      ctx.font = `10px ${MONO}`;
      ctx.fillStyle = C.dim;
      ctx.fillText(String((i % 6) + 1), side ? r.x - 10 : r.x + r.w + 3, r.y + 9);
    });
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = C.dim;
    const r0 = swatches[0], r6 = swatches[6];
    ctx.fillText('y₁ probes', r0.x, r0.y - 10);
    const lbl = 'y probes';
    ctx.fillText(lbl, r6.x + r6.w - ctx.measureText(lbl).width, r6.y - 10);
  }

  // Resonance egg: rings ripple outward through the tunnel.
  if (s.egg && s.egg.ripple >= 0) {
    ctx.setLineDash([7, 6]);
    for (let i = 0; i < 3; i++) {
      const k = s.egg.ripple * 1.4 - i * 0.2;
      if (k <= 0 || k >= 1) continue;
      const w = (1.6 + k * 1.4) * g.S, h = (1.9 + k * 1.4) * g.S;
      ctx.strokeStyle = `rgba(195, 248, 107, ${(1 - k) * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(g.cx - w / 2, g.cy - 0.1 * g.S - h / 2, w, h);
    }
    ctx.setLineDash([]);
  }

  // Expression: brows lift and tilt up at the inner ends as the waves reinforce.
  // Each brow is a recessed slot (dark) holding a lit bar, so it reads against the shell.
  const lift = s.brow * 0.026 * g.S;
  const tilt = Math.max(0, s.brow) * 0.04 * g.S; // reinforcing: inner ends rise; cancelling: flat and calm
  const thick = Math.max(5, 0.045 * g.S);
  for (const side of [-1, 1]) {
    const eye = side < 0 ? L : R;
    const x0 = eye.x + eye.w * 0.1;
    const x1 = eye.x + eye.w * 0.9;
    const baseY = eye.y - 0.07 * g.S - lift;
    // y at a given x: inner end (toward the nose) is raised by `tilt`.
    const yAt = (x: number) => {
      const inner = side < 0 ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0);
      return baseY - inner * tilt;
    };
    ctx.fillStyle = 'rgba(4, 7, 6, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x0 - 3, yAt(x0) - 3);
    ctx.lineTo(x1 + 3, yAt(x1) - 3);
    ctx.lineTo(x1 + 3, yAt(x1) + thick + 3);
    ctx.lineTo(x0 - 3, yAt(x0) + thick + 3);
    ctx.closePath();
    ctx.fill();
    for (let x = x0; x <= x1; x += 3) {
      const y = yAt(x);
      const edge = Math.min(x - x0, x1 - x) / ((x1 - x0) / 2); // taper at the ends
      for (let k = 0; k * 3 < thick; k++) {
        const size = Math.max(0.8, (2.7 - k * 0.35) * (0.45 + 0.55 * Math.min(1, edge * 3)));
        ctx.fillStyle = k === 0 ? HIGHLIGHT : C.lime;
        ctx.fillRect(x - size / 2, y + k * 3 + 1.5 - size / 2, size, size);
      }
    }
  }

  // Ear lights pulse with the sum: brightness follows A_R and oscillates at f.
  const earEgg = s.egg?.ear ?? null;
  const level = earEgg ? 1 : (AR / 2) * (0.6 + 0.4 * Math.sin(2 * Math.PI * p.f * t));
  // Ears sit near the silhouette, so they follow the head turn about half as far as the eyes.
  const turnX = (L.x - (g.cx + (-EYE.x - EYE.hw) * g.S)) * 0.5;
  const turnY = (L.y - (g.cy + (EYE.v - EYE.hh) * g.S)) * 0.5;
  for (const side of [-1, 1]) {
    const ex = g.cx + side * 0.765 * g.S + turnX;
    const ey = g.cy + EYE.v * g.S + turnY;
    for (let k = -2; k <= 2; k++) {
      ctx.fillStyle = earEgg === 'amber' ? C.amber : earEgg === 'flash' ? HIGHLIGHT : level > 0.02 ? C.lime : 'rgba(195,248,107,0.18)';
      ctx.globalAlpha = Math.max(0.15, Math.min(1, level * (1 - Math.abs(k) * 0.12)));
      if (effects && level > 0.05) {
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 10 * level;
      }
      ctx.fillRect(ex - 2, ey + k * 0.025 * g.S - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Eyes: the two source waves over the same 2 m window.
  const left = drawScreen(ctx, L, g, (x) => y1(x, t, p), C.lime, particles, effects, s.pulse);
  const right = drawScreen(ctx, R, g, (x) => y2(x, t, p), C.ice, particles, effects, s.pulse);
  const mouth = drawScreen(ctx, M, g, (x) => yTotal(x, t, p), C.text, particles, effects, 0);

  // Probe ticks and readings inside the screens.
  if (swatches.length) {
    PROBES.forEach((x) => {
      ctx.fillStyle = C.lime;
      ctx.fillRect(left.X(x) - 0.5, L.y + L.h - 5, 1, 5);
      ctx.beginPath();
      ctx.arc(left.X(x), left.mid - y1(x, t, p) * g.unit, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.fillRect(mouth.X(x) - 0.5, M.y + M.h - 5, 1, 5);
      ctx.beginPath();
      ctx.arc(mouth.X(x), mouth.mid - yTotal(x, t, p) * g.unit, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Matching crests: wave 1's crest in [1, 2) m, wave 2's lies φ/360·λ before it.
  let x1c = (Math.PI / 2 + 2 * Math.PI * p.f * t) / WAVE_NUMBER;
  x1c = ((((x1c - 1) % WAVELENGTH_M) + WAVELENGTH_M) % WAVELENGTH_M) + 1;
  const off = phaseOffsetMeters(p.phi);
  const x2c = x1c - off;
  ctx.save();
  if (p.A1 > 0) {
    ctx.fillStyle = C.lime;
    ctx.beginPath();
    ctx.arc(left.X(x1c), left.mid - p.A1 * g.unit, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // In the right eye: a ghost of wave 1's crest position, bracketed to wave 2's crest.
  roundRectPath(ctx, R, Math.max(4, EYE.r * g.S));
  ctx.clip();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(195, 248, 107, 0.7)';
  ctx.beginPath();
  ctx.moveTo(Math.round(right.X(x1c)) + 0.5, R.y);
  ctx.lineTo(Math.round(right.X(x1c)) + 0.5, R.y + R.h);
  ctx.stroke();
  ctx.setLineDash([]);
  if (p.A2 > 0) {
    ctx.fillStyle = C.ice;
    ctx.beginPath();
    ctx.arc(right.X(x2c), right.mid - p.A2 * g.unit, strong ? 4.2 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const by = R.y + 9;
  ctx.strokeStyle = C.amber;
  ctx.lineWidth = strong ? 2.5 : 1.75;
  if (effects) {
    ctx.shadowColor = C.amber;
    ctx.shadowBlur = strong ? 12 : 6;
  }
  ctx.beginPath();
  ctx.moveTo(right.X(x2c), by + 5);
  ctx.lineTo(right.X(x2c), by);
  ctx.lineTo(right.X(x1c), by);
  ctx.lineTo(right.X(x1c), by + 5);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (s.hoverEye || s.dragging) {
    // Grab affordance: the wave in this eye can be dragged sideways.
    ctx.fillStyle = 'rgba(234, 203, 141, 0.12)';
    ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.font = `11px ${MONO}`;
    const hint = '⟷ drag to shift φ';
    ctx.fillStyle = 'rgba(3, 6, 5, 0.85)';
    const hw = ctx.measureText(hint).width;
    ctx.fillRect(R.x + R.w / 2 - hw / 2 - 5, R.y + R.h / 2 - 9, hw + 10, 16);
    ctx.fillStyle = C.amber;
    ctx.fillText(hint, R.x + R.w / 2 - hw / 2, R.y + R.h / 2 + 3);
  }
  ctx.restore();

  // Easter-egg overlays on the eye screens: spirals (dizzy), E = mc² (classic), eyelids (blink).
  if (s.egg) {
    const rad = Math.max(4, EYE.r * g.S);
    for (const [eye, color, i] of [[L, C.lime, 0], [R, C.ice, 1]] as const) {
      if (s.egg.dizzy < 0 && !s.egg.classic && s.egg.blink <= 0) break;
      ctx.save();
      roundRectPath(ctx, eye, rad);
      ctx.clip();
      if (s.egg.dizzy >= 0 || s.egg.classic) {
        ctx.fillStyle = '#030605';
        ctx.fillRect(eye.x, eye.y, eye.w, eye.h);
      }
      if (s.egg.dizzy >= 0) {
        const cx = eye.x + eye.w / 2, cy = eye.y + eye.h / 2, R0 = Math.min(eye.w, eye.h) * 0.46;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let th = 0; th < 6 * Math.PI; th += 0.15) {
          const r = (th / (6 * Math.PI)) * R0;
          const a = th + s.egg.dizzy * (i ? -7 : 7);
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          th ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      if (s.egg.classic) {
        // The pixel face has no superscript digits, so the exponent is set by hand.
        const size = Math.round(eye.h * (i ? 0.36 : 0.48));
        const base = i ? 'c² ≈ 9×10' : 'E = mc²';
        const exp = i ? '16' : '';
        ctx.font = `${size}px ${PIXEL}`;
        const bw = ctx.measureText(base).width;
        ctx.font = `${Math.round(size * 0.6)}px ${PIXEL}`;
        const ew = exp ? ctx.measureText(exp).width : 0;
        const x0 = eye.x + eye.w / 2 - (bw + ew) / 2;
        const y0 = eye.y + eye.h / 2 + eye.h * 0.14;
        ctx.fillStyle = color;
        if (effects) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        }
        ctx.font = `${size}px ${PIXEL}`;
        ctx.fillText(base, x0, y0);
        if (exp) {
          ctx.font = `${Math.round(size * 0.6)}px ${PIXEL}`;
          ctx.fillText(exp, x0 + bw + 1, y0 - size * 0.42);
        }
        ctx.shadowBlur = 0;
      }
      if (s.egg.blink > 0) {
        // Upper and lower lids meet in the middle.
        const lid = (eye.h / 2) * s.egg.blink;
        ctx.fillStyle = C.bg;
        ctx.fillRect(eye.x, eye.y, eye.w, lid);
        ctx.fillRect(eye.x, eye.y + eye.h - lid, eye.w, lid);
        ctx.fillStyle = color;
        ctx.fillRect(eye.x, eye.y + lid - 1, eye.w, 1.5);
        ctx.fillRect(eye.x, eye.y + eye.h - lid - 0.5, eye.w, 1.5);
      }
      ctx.restore();
    }
  }

  // Mouth: ghost sources and the ±A_R envelope.
  ctx.save();
  roundRectPath(ctx, M, Math.max(4, EYE.r * g.S));
  ctx.clip();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const [fn, col] of [[(x: number) => y1(x, t, p), 'rgba(195,248,107,0.4)'], [(x: number) => y2(x, t, p), 'rgba(185,225,207,0.4)']] as const) {
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let px = 0; px <= M.w - 2 * g.pad; px += 2) {
      const y = mouth.mid - fn(px / g.pxPerM) * g.unit;
      px === 0 ? ctx.moveTo(M.x + g.pad + px, y) : ctx.lineTo(M.x + g.pad + px, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(224,235,224,0.45)';
  for (const sgn of [-1, 1]) {
    const y = Math.round(mouth.mid - sgn * AR * g.unit) + 0.5;
    ctx.beginPath();
    ctx.moveTo(M.x, y);
    ctx.lineTo(M.x + M.w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Labels inside each screen, on a dark tab so they stay legible over traces.
  const tab = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.font = `${compact ? 11 : 12}px ${MONO}`;
    const w = fillMath(ctx, text, 0, 0, true);
    const lx = align === 'right' ? x - w : x;
    ctx.fillStyle = 'rgba(3, 6, 5, 0.82)';
    ctx.fillRect(lx - 4, y - 11, w + 8, 16);
    ctx.fillStyle = color;
    fillMath(ctx, text, lx, y);
  };
  tab('● y₁', L.x + 8, L.y + L.h - 8, C.lime);
  tab(`A₁ ${fixed(p.A1)}`, L.x + L.w - 8, L.y + L.h - 8, C.dim, 'right');
  tab('■ y₂', R.x + 8, R.y + R.h - 8, C.ice);
  tab(`A₂ ${fixed(p.A2)}`, R.x + R.w - 8, R.y + R.h - 8, C.dim, 'right');
  tab('◎ y = y₁ + y₂', M.x + 8, M.y + 16, C.text);
  tab(`A_R ${fixed(AR)}`, M.x + M.w - 8, M.y + 16, C.dim, 'right');

  // The result, stamped on the mouth's lower bezel in the pixel face.
  const kind = classify(p);
  const stamp = s.egg?.stamp ?? STATE_TEXT[kind];
  ctx.font = `${compact ? 17 : 20}px ${PIXEL}`;
  const sw = ctx.measureText(stamp).width;
  const sy = M.y + M.h;
  ctx.fillStyle = C.bg;
  ctx.fillRect(M.x + M.w / 2 - sw / 2 - 8, sy - 9, sw + 16, 18);
  ctx.strokeStyle = 'rgba(224, 235, 224, 0.6)';
  ctx.strokeRect(Math.round(M.x + M.w / 2 - sw / 2 - 8) + 0.5, Math.round(sy - 9) + 0.5, Math.round(sw + 16), 18);
  ctx.fillStyle = s.egg?.stamp ? C.amber : kind === 'constructive' ? HIGHLIGHT : kind === 'cancellation' ? C.ice : C.text;
  ctx.fillText(stamp, M.x + M.w / 2 - sw / 2, sy + 5);

  // Phase bar across the bridge between the eyes and the mouth.
  const bridgeY = (L.y + L.h + M.y) / 2 + 2;
  const phText = `◆ φ = ${fixed(p.phi, 0)}° · Δx ${fixed(off)} m`;
  ctx.font = `${strong ? 14 : 13}px ${MONO}`;
  const pw = ctx.measureText(phText).width;
  ctx.fillStyle = 'rgba(3, 6, 5, 0.9)';
  ctx.fillRect(g.cx - pw / 2 - 8, bridgeY - 13, pw + 16, 19);
  ctx.strokeStyle = strong ? C.amber : 'rgba(234, 203, 141, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(g.cx - pw / 2 - 8) + 0.5, Math.round(bridgeY - 13) + 0.5, Math.round(pw + 16), 19);
  ctx.fillStyle = C.amber;
  ctx.fillText(phText, g.cx - pw / 2, bridgeY + 1);

  if (s.headOnly || compact) return;

  // Leader-line annotations, contour-poster style: anchor dot, elbow, framed panel.
  const panel = (title: string, sub: string, color: string, px: number, py: number, ax: number, ay: number, alignRight = false) => {
    ctx.font = `17px ${PIXEL}`;
    const tw = ctx.measureText(title).width;
    ctx.font = `11px ${MONO}`;
    const subW = fillMath(ctx, sub, 0, 0, true);
    const w = Math.max(tw, subW) + 16;
    const h = 36;
    const x = alignRight ? px - w : px;
    const elbowX = alignRight ? x : x + w;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(elbowX, py + h / 2);
    ctx.lineTo(elbowX + (alignRight ? -14 : 14), py + h / 2);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8, 13, 11, 0.9)';
    ctx.fillRect(x, py, w, h);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(py) + 0.5, Math.round(w), h);
    ctx.globalAlpha = 1;
    // Registration ticks on the corners.
    ctx.fillStyle = color;
    for (const [cx, cy] of [[x, py], [x + w, py], [x, py + h], [x + w, py + h]]) {
      ctx.fillRect(cx - 3, cy - 0.5, 6, 1);
      ctx.fillRect(cx - 0.5, cy - 3, 1, 6);
    }
    ctx.font = `17px ${PIXEL}`;
    ctx.fillText(title, x + 8, py + 15);
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = C.dim;
    fillMath(ctx, sub, x + 8, py + 29);
  };
  const lx0 = g.swatches ? 80 : 16;
  const rx0 = g.W - (g.swatches ? 80 : 16);
  panel('LEFT EYE', 'y₁ · wave 1', C.lime, lx0, 22, L.x + 10, L.y + 4);
  panel('RIGHT EYE', 'y₂ · drag to shift φ', C.ice, rx0, 22, R.x + R.w - 10, R.y + 4, true);
  panel('MOUTH', 'y = y₁ + y₂', C.text, lx0, g.H - 66, M.x + 4, M.y + M.h * 0.7);
}

export function ObserverHead({ params: p, clock, focus, effects, reducedMotion, onPhase, sliderRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<{ field: Field; W: number; H: number; dpr: number } | null>(null);
  const built = useRef({ yaw: NaN, pitch: NaN, W: 0, H: 0 });
  const bloomState = useRef({ ready: false, since: 0 });
  const moving = useRef(false);
  const look = useRef({ yaw: 0, pitch: 0, ty: 0, tp: 0 });
  const anim = useRef({ start: 0, pulseAt: -1e9, lastInput: 0, lastDraw: 0, brow: 0, phi: p.phi });
  const drag = useRef<{ x: number; phi: number } | null>(null);
  const eggs = useRef({
    times: freshEggTimes(),
    pointer: { x: 0, y: 0, t: 0, stared: true },
    pokes: [] as number[],
    spin: { total: 0, last: NaN, at: 0 },
    silentSince: NaN,
    silenceShown: false,
    split: { value: 0, target: 0, held: false, shownAt: NEVER },
    tint: { build: -1, lime: null as HTMLCanvasElement | null, ice: null as HTMLCanvasElement | null },
  });
  const layerBuild = useRef(0);
  const pRef = useRef(p);
  pRef.current = p;
  const sizeRef = useRef({ w: 0, h: 0 });
  const [hoverEye, setHoverEye] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  sizeRef.current = size;
  const [hidden, setHidden] = useState(false);
  const arriving = useRef<FlightRect | null>(null);

  const particles = useMemo<Particle[]>(() => {
    const rnd = seeded(11);
    return Array.from({ length: 150 }, (_, i) => ({ x: ((i + rnd()) / 150) * 3, o: rnd() * 2 - 1 }));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A phase change pulses the eye bezels and sends a pulse up the circuit trace.
  if (p.phi !== anim.current.phi) {
    anim.current.phi = p.phi;
    if (!reducedMotion) anim.current.pulseAt = performance.now();
    anim.current.lastInput = performance.now();
  }

  const thumbX = () => {
    const input = sliderRef?.current;
    const canvas = canvasRef.current;
    if (!input || !canvas) return null;
    const r = input.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    if (!r.width) return null;
    const thumb = 18;
    return r.left - c.left + thumb / 2 + (p.phi / 360) * (r.width - thumb);
  };

  const draw = (force: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const now = performance.now();
    const a = anim.current;
    if (!a.start) a.start = now;
    const entering = !reducedMotion && now - a.start < ENTRANCE_MS;
    const pulseAge = now - a.pulseAt;
    const E = eggs.current;
    const splitting = Math.abs(E.split.target - E.split.value) > 0.005 || E.split.value > 0.005;
    const busy = entering || pulseAge < 600 || now - a.lastInput < 800 || moving.current || drag.current !== null || eggBusy(E.times, now) || splitting;
    // Nobody interacting: 30 fps is plenty for slow waves and keeps the main thread free.
    if (!force && !busy && now - a.lastDraw < IDLE_FRAME_MS) return;
    a.lastDraw = now;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const em = reducedMotion ? { yaw: 0, pitch: 0 } : eggMotion(E.times, now);
    const yaw = Math.max(-1.3, Math.min(1.3, look.current.yaw + em.yaw));
    const pitch = Math.max(-1.3, Math.min(1.3, look.current.pitch + em.pitch));
    const g = geometry(size.w, size.h, yaw, pitch);
    E.split.value = reducedMotion ? E.split.target : E.split.value + (E.split.target - E.split.value) * 0.2;
    if (!layerRef.current) layerRef.current = document.createElement('canvas');
    if (!bloomRef.current) bloomRef.current = document.createElement('canvas');
    const fc = fieldRef.current;
    if (!fc || fc.W !== size.w || fc.H !== size.h || fc.dpr !== dpr) {
      fieldRef.current = { field: buildField(geometry(size.w, size.h, 0, 0), dpr), W: size.w, H: size.h, dpr };
      built.current.W = 0;
    }
    const b = built.current;
    if (b.W !== size.w || b.H !== size.h || Math.abs(b.yaw - yaw) > 0.004 || Math.abs(b.pitch - pitch) > 0.004) {
      buildLayer(layerRef.current, g, fieldRef.current!.field, dpr, yaw, pitch);
      built.current = { yaw, pitch, W: size.w, H: size.h };
      layerBuild.current++;
      bloomState.current.ready = false;
    }
    // Bloom only at rest, faded in rather than popped.
    const bs = bloomState.current;
    if (effects && !moving.current && !bs.ready) {
      buildBloom(bloomRef.current, layerRef.current, dpr);
      bs.ready = true;
      bs.since = now;
    }

    // Expression eases toward the physics: reinforcing waves lift the brows.
    const AR = resultantAmplitude(p);
    const target = p.A1 + p.A2 > 0 ? (AR / (p.A1 + p.A2)) * 2 - 1 : 0;
    a.brow = reducedMotion ? target : a.brow + (target - a.brow) * 0.15;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (entering) {
      // CRT warm-up: the picture is revealed top to bottom behind a bright scan line.
      const k = (now - a.start) / ENTRANCE_MS;
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height * k);
      ctx.clip();
    }
    if (E.split.value > 0.01) {
      // Parallax egg: the scene seen from two viewpoints, tinted lime (left) and ice (right).
      const tint = E.tint;
      if (tint.build !== layerBuild.current) {
        const make = (color: string) => {
          const c = document.createElement('canvas');
          c.width = layerRef.current!.width;
          c.height = layerRef.current!.height;
          const x = c.getContext('2d')!;
          x.drawImage(layerRef.current!, 0, 0);
          // Multiply tints only what is lit: the dark silhouette stays dark.
          x.globalCompositeOperation = 'multiply';
          x.fillStyle = color;
          x.fillRect(0, 0, c.width, c.height);
          x.globalCompositeOperation = 'destination-in';
          x.drawImage(layerRef.current!, 0, 0);
          return c;
        };
        tint.lime = make(C.lime);
        tint.ice = make(C.ice);
        tint.build = layerBuild.current;
      }
      const d = E.split.value * 12 * dpr;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(tint.lime!, -d, 0);
      ctx.drawImage(tint.ice!, d, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else ctx.drawImage(layerRef.current, 0, 0);
    if (effects && bs.ready) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.38 * Math.min(1, (now - bs.since) / GLOW_FADE_MS);
      ctx.drawImage(bloomRef.current, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const ep = eggPaint(E.times, now, reducedMotion, E.split.value);
    if (ep.flicker) {
      ctx.fillStyle = 'rgba(8, 13, 11, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLive(ctx, g, p, particles, {
      egg: ep,
      t: clock.t,
      now,
      focus,
      effects,
      pulse: reducedMotion ? 0 : Math.max(0, 1 - pulseAge / PULSE_MS),
      pulseTravel: reducedMotion || pulseAge > 450 ? -1 : pulseAge / 450,
      brow: ep.brow ?? a.brow,
      thumbX: thumbX(),
      hoverEye,
      dragging,
      headOnly: false,
      dpr,
    });
    ctx.restore();
    if (entering) {
      const y = size.h * ((now - a.start) / ENTRANCE_MS);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = HIGHLIGHT;
      ctx.globalAlpha = 0.85;
      if (effects) {
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 16;
      }
      ctx.fillRect(0, y - 1, size.w, 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  };

  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => clock.subscribe(() => drawRef.current(false)), [clock]);
  useEffect(() => drawRef.current(true), [size, p.A1, p.A2, p.f, p.phi, focus, effects, hoverEye, dragging]);

  // Animations that must run even while playback is paused: entrance, pulses, expression.
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const tick = () => {
      const a = anim.current;
      const now = performance.now();
      const E = eggs.current;
      const active = now - a.start < ENTRANCE_MS || now - a.pulseAt < 600 || now - a.lastInput < 800 || now - bloomState.current.since < GLOW_FADE_MS
        || eggBusy(E.times, now) || Math.abs(E.split.target - E.split.value) > 0.005;
      if (active) drawRef.current(true);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // The head turns toward the pointer, then settles. Off under reduced motion.
  useEffect(() => {
    if (reducedMotion) {
      look.current = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      drawRef.current(true);
      return;
    }
    let raf = 0;
    const tick = () => {
      const l = look.current;
      l.yaw += (l.ty - l.yaw) * 0.12;
      l.pitch += (l.tp - l.pitch) * 0.12;
      const settling = Math.abs(l.ty - l.yaw) + Math.abs(l.tp - l.pitch) > 0.002;
      moving.current = settling;
      drawRef.current(true);
      raf = settling ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el || e.pointerType === 'touch' || drag.current) return;
      const r = el.getBoundingClientRect();
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      look.current.ty = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9));
      look.current.tp = clamp((e.clientY - (r.top + r.height * 0.42)) / (r.height * 0.9));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => {
      look.current.ty = 0;
      look.current.tp = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [reducedMotion]);

  // ── Easter eggs ──────────────────────────────────────────────────────────────
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  /** Head centre in viewport coordinates, and its scale. */
  const headCentre = () => {
    const c = canvasRef.current?.getBoundingClientRect();
    const sz = sizeRef.current;
    if (!c || !sz.w) return null;
    const g = geometry(sz.w, sz.h, 0, 0);
    return { x: c.left + g.cx, y: c.top + g.cy, S: g.S, box: headBox(g), left: c.left, top: c.top };
  };

  // Cues from elsewhere in the app: a nod ("parallax" typed), resonance, E = mc².
  useEffect(() => onRobotCue((cue) => {
    const now = performance.now();
    const T = eggs.current.times;
    if (cue === 'nod') T.nodAt = now;
    if (cue === 'resonance') {
      T.resonanceAt = now;
      revealEgg('resonance', 'Driven back and forth at the same rhythm, the observer resonates. Please stop.');
    }
    if (cue === 'classic') T.classicAt = now;
  }), []);

  // Stare contest and dizzy circles both read the pointer.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const E = eggs.current;
      E.pointer = { x: e.clientX, y: e.clientY, t: performance.now(), stared: false };
      if (e.pointerType === 'touch') return;
      const h = headCentre();
      if (!h) return;
      const dx = e.clientX - h.x, dy = e.clientY - h.y;
      const r = Math.hypot(dx, dy) / h.S;
      const now = performance.now();
      const sp = E.spin;
      if (r < 0.25 || r > 1.9 || now - sp.at > 1200) {
        sp.total = 0;
        sp.last = NaN;
      }
      sp.at = now;
      const ang = Math.atan2(dy, dx);
      if (!Number.isNaN(sp.last)) {
        let d = ang - sp.last;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        sp.total += d;
      }
      sp.last = ang;
      if (Math.abs(sp.total) >= 6 * Math.PI) {
        sp.total = 0;
        E.times.dizzyAt = now;
        revealEgg('dizzy', 'Three laps around its head. The observer needs a moment.');
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    // Stare and silence are timing conditions; a light poll is enough.
    const poll = window.setInterval(() => {
      const E = eggs.current;
      const now = performance.now();
      const h = headCentre();
      const ptr = E.pointer;
      if (h && !ptr.stared && ptr.t && now - ptr.t > STARE_MS) {
        const lx = ptr.x - h.left, ly = ptr.y - h.top;
        const b = h.box;
        if (lx > b.x && lx < b.x + b.w && ly > b.y && ly < b.y + b.h) {
          ptr.stared = true;
          E.times.blinkAt = now;
          E.times.glanceDir = Math.random() < 0.5 ? -1 : 1;
          revealEgg('stare', 'You win the staring contest. Robots blink too.');
        }
      }
      // Under reduced motion nothing animates, but stamps and captions still need a frame.
      if (reducedRef.current && eggBusy(E.times, now)) drawRef.current(true);
      const q = pRef.current;
      const silent = classify(q) === 'cancellation' && Math.abs(q.phi - 180) < 1e-9 && !drag.current;
      if (silent) {
        if (Number.isNaN(E.silentSince)) E.silentSince = now;
        if (!E.silenceShown && now - E.silentSince > 600) {
          E.silenceShown = true;
          E.times.hushAt = now;
          revealEgg('silence', 'Total destructive interference. Shhh.');
        }
      } else {
        if (E.silenceShown) E.times.exhaleAt = now;
        E.silentSince = NaN;
        E.silenceShown = false;
      }
    }, 200);
    return () => {
      window.removeEventListener('pointermove', move);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parallax, literally: hold Shift and move the mouse to see the head from two viewpoints.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !typing(e.target)) eggs.current.split.held = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        eggs.current.split.held = false;
        eggs.current.split.target = 0;
      }
    };
    const move = (e: PointerEvent) => {
      const sp = eggs.current.split;
      if (!sp.held || !e.shiftKey || sp.target === 1) return;
      sp.target = 1;
      const now = performance.now();
      if (now - sp.shownAt > 10000) {
        sp.shownAt = now;
        revealEgg('parallax', 'Parallax: one object, two viewpoints. Release Shift to converge.');
      }
    };
    const blur = () => {
      eggs.current.split.held = false;
      eggs.current.split.target = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', blur);
    };
  }, []);

  /** Five quick clicks on the forehead plate. */
  const pokeForehead = (e: React.PointerEvent) => {
    const h = headCentre();
    if (!h) return false;
    const u = (e.clientX - h.x) / h.S, v = (e.clientY - h.y) / h.S;
    if (Math.abs(u) > 0.36 || v < -0.68 || v > -0.38) return false;
    const E = eggs.current;
    const now = performance.now();
    E.pokes = [...E.pokes.filter((t) => now - t < 1500), now];
    if (E.pokes.length >= 5) {
      E.pokes = [];
      E.times.ouchAt = now;
      revealEgg('poke', 'Ouch. That is its forehead plate, not a button.');
    }
    return true;
  };

  // Direct manipulation: drag the wave in the right eye to shift its phase.
  const inRightEye = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return false;
    const c = canvas.getBoundingClientRect();
    const { yaw, pitch } = look.current;
    const R = geometry(size.w, size.h, yaw, pitch).eyes[1];
    const x = e.clientX - c.left, y = e.clientY - c.top;
    return x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pokeForehead(e)) {
      drawRef.current(true);
      return;
    }
    if (!onPhase || !inRightEye(e)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, phi: p.phi };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current && onPhase) {
      const g = geometry(size.w, size.h, 0, 0);
      // Moving the wave right moves its crest right, which reduces how far it trails wave 1.
      const dPhi = -((e.clientX - drag.current.x) / g.pxPerM / WAVELENGTH_M) * 360;
      const raw = (((drag.current.phi + dPhi) % 360) + 360) % 360;
      onPhase(Math.round(raw / 5) * 5);
      anim.current.lastInput = performance.now();
      return;
    }
    const over = !!onPhase && inRightEye(e);
    if (over !== hoverEye) setHoverEye(over);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  // The docked miniature keeps showing whatever phase the learner left here.
  useEffect(() => {
    Object.assign(observerParams, p);
  }, [p]);

  /** Head only (no tunnel, probes or panels), cropped to HEAD_BOX, in viewport coordinates. */
  const snapshot = (): { image: HTMLCanvasElement; rect: FlightRect } | null => {
    const el = wrapRef.current;
    const fc = fieldRef.current;
    if (!el || !fc) return null;
    const { yaw, pitch } = look.current;
    const g = geometry(fc.W, fc.H, yaw, pitch);
    const layer = document.createElement('canvas');
    buildLayer(layer, g, fc.field, fc.dpr, yaw, pitch, false);
    const lctx = layer.getContext('2d')!;
    lctx.setTransform(fc.dpr, 0, 0, fc.dpr, 0, 0);
    paintLive(lctx, g, p, particles, {
      t: clock.t, now: performance.now(), focus: null, effects, pulse: 0, pulseTravel: -1,
      brow: anim.current.brow, thumbX: null, hoverEye: false, dragging: false, headOnly: true, dpr: fc.dpr, egg: null,
    });
    const box = headBox(geometry(fc.W, fc.H, 0, 0));
    const out = document.createElement('canvas');
    out.width = Math.round(box.w * fc.dpr);
    out.height = Math.round(box.h * fc.dpr);
    out.getContext('2d')!.drawImage(layer, box.x * fc.dpr, box.y * fc.dpr, box.w * fc.dpr, box.h * fc.dpr, 0, 0, out.width, out.height);
    const r = el.getBoundingClientRect();
    return { image: out, rect: { x: r.left + box.x, y: r.top + box.y, w: box.w, h: box.h } };
  };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  // Leaving the entry screen: hand the head to the top bar. Returning: wait for it to land.
  useLayoutEffect(() => {
    if (!reducedMotion) {
      const back = claimFlight('undock');
      if (back) {
        arriving.current = back.from;
        anim.current.start = -1e9; // the flight replaces the entrance
        setHidden(true);
      }
    }
    return () => {
      if (reducedMotionRef.current) return;
      const shot = snapshotRef.current();
      if (shot) leaveFlight('dock', shot.rect, shot.image);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const from = arriving.current;
    if (!from || !size.w || !fieldRef.current) return;
    arriving.current = null;
    const shot = snapshotRef.current();
    if (!shot) return setHidden(false);
    void fly(shot.image, from, shot.rect).then(() => setHidden(false));
  }, [size]);

  const AR = resultantAmplitude(p);
  const label = `Live wave model drawn as a dot-matrix robot face. Left eye: wave 1, amplitude ${fixed(p.A1)}. Right eye: wave 2, amplitude ${fixed(p.A2)}, shifted by ${fixed(p.phi, 0)} degrees; drag it sideways to change the shift. Mouth: their sum, amplitude ${fixed(AR)}.`;
  return (
    <div className={`stage-canvas observer${hidden ? ' awaiting' : ''}`} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        style={{ width: size.w, height: size.h, cursor: dragging ? 'grabbing' : hoverEye ? 'grab' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !drag.current && setHoverEye(false)}
      />
    </div>
  );
}
