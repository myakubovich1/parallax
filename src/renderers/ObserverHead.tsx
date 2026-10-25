import { useEffect, useMemo, useRef, useState } from 'react';
import { useClockDraw, type SimClock } from '../lib/clock';
import { fixed } from '../lib/format';
import { WAVELENGTH_M, WAVE_NUMBER, phaseOffsetMeters, resultantAmplitude, y1, y2, yTotal, type WaveParams } from '../lib/physics/wave';
import { C, MONO, seeded } from './palette';
import { fillMath } from './WaveRenderer';

/**
 * Entry-screen "observer": a dot-matrix android whose two eyes are the two source
 * waves and whose mouth is their sum. The head is decorative; every trace inside the
 * eyes and mouth is the real wave model, drawn at one shared vertical scale.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CELL = 3; // dot-matrix pitch in CSS px
const EYE = { x: 0.325, v: -0.1, hw: 0.285, hh: 0.14, r: 0.05 };
const EYE_SPAN_M = 2 * WAVELENGTH_M;
const HIGHLIGHT = '#ECFFB8';
const PIXEL = "'VT323', 'IBM Plex Mono', monospace";

interface Props {
  params: WaveParams;
  clock: SimClock;
  focus: string | null;
  effects: boolean;
  reducedMotion: boolean;
}

interface Rect { x: number; y: number; w: number; h: number }
interface Geometry {
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
}

const sdRoundBox = (px: number, py: number, bx: number, by: number, r: number) => {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

function geometry(W: number, H: number, yaw: number, pitch: number): Geometry {
  const narrow = W < 520;
  const S = Math.max(60, Math.min((H - 20) / 1.74, narrow ? (W - 8) / 1.36 : (W - 128) / 1.62));
  const cx = W / 2;
  const cy = Math.max(20 + 0.92 * S, (H - 1.74 * S) / 2 + 0.92 * S);
  const unit = Math.max(4, (EYE.hh * S - 7) / 1.6);
  const mouthHH = (2.15 * unit + 7) / S; // preview amplitudes are fixed at 1, so |y| ≤ 2
  const mouthV = EYE.v + EYE.hh + 0.1 + mouthHH;
  // Raised features shift further than the skull when the head turns: parallax.
  const shift = (dome: number) => ({ dx: yaw * 0.07 * dome * S, dy: pitch * 0.05 * dome * S });
  const eyeShift = shift(0.86);
  const eyes = [-1, 1].map((s) => ({
    x: cx + (s * EYE.x - EYE.hw) * S + eyeShift.dx,
    y: cy + (EYE.v - EYE.hh) * S + eyeShift.dy,
    w: 2 * EYE.hw * S,
    h: 2 * EYE.hh * S,
  })) as [Rect, Rect];
  const mShift = shift(0.62);
  const mouth = { x: cx - 0.36 * S + mShift.dx, y: cy + (mouthV - mouthHH) * S + mShift.dy, w: 0.72 * S, h: 2 * mouthHH * S };
  return { W, H, S, cx, cy, unit, pxPerM: (eyes[0].w - 12) / EYE_SPAN_M, eyes, mouth, mouthV, mouthHH, swatches: !narrow && W > 600 };
}

/** Height field of the head in face units. region: 0 none, 1 shell, 2 eye screen, 3 mouth screen. */
function sampleHead(u: number, v: number, yaw: number, pitch: number, g: Geometry): [number, number] {
  const rx = v > 0.1 ? 0.74 - (v - 0.1) * 0.45 : 0.74;
  const e = (u / rx) ** 2 + ((v + 0.12) / 0.82) ** 2;
  if (e >= 1) {
    const au = Math.abs(u);
    const ear = sdRoundBox(au - 0.76, v - EYE.v, 0.06, 0.16, 0.03);
    if (ear < 0) {
      const slat = Math.floor((v - EYE.v + 0.16) / 0.05) % 2 === 0 ? 0 : -0.05;
      return [0.5 + slat + Math.min(0.12, -ear * 2.5), 1];
    }
    if (v > 0.55 && v < 1.0 && au < 0.27) {
      const ring = Math.floor((v - 0.55) / 0.065) % 2 === 0 ? 0 : -0.07;
      return [0.5 * Math.sqrt(1 - (u / 0.27) ** 2) + ring, 1];
    }
    return [0, 0];
  }
  const dome = Math.sqrt(1 - e);
  const fu = u - yaw * 0.07 * dome;
  const fv = v - pitch * 0.05 * dome;
  let h = dome * 0.9;

  for (const s of [-1, 1]) {
    const d = sdRoundBox(fu - s * EYE.x, fv - EYE.v, EYE.hw, EYE.hh, EYE.r);
    if (d < 0) return [h, 2];
    if (d < 0.028) h += 0.1 * (1 - d / 0.028);
    else if (d < 0.055) h -= 0.05;
  }
  const dm = sdRoundBox(fu, fv - g.mouthV, 0.36, g.mouthHH, 0.05);
  if (dm < 0) return [h, 3];
  if (dm < 0.028) h += 0.1 * (1 - dm / 0.028);
  else if (dm < 0.055) h -= 0.05;

  // Brow ridge, panel seams and cheek vents give the shell its machined surface.
  h += 0.08 * Math.exp(-(((fv - (EYE.v - EYE.hh - 0.07)) / 0.03) ** 2)) * (Math.abs(fu) < 0.66 ? 1 : 0);
  if (Math.abs(fu) < 0.009 && fv < -0.7) h -= 0.1;
  if (Math.abs(fv - (EYE.v - EYE.hh - 0.17)) < 0.008 && Math.abs(fu) < 0.42) h -= 0.07;
  if (Math.abs(fu) > 0.48 && Math.abs(fu) < 0.62 && fv > EYE.v + EYE.hh + 0.06 && fv < EYE.v + EYE.hh + 0.3) {
    if (Math.floor((fv - EYE.v) / 0.038) % 2 === 0) h -= 0.09;
  }
  return [h, 1];
}

interface Field {
  cols: number;
  rows: number;
  left: number;
  top: number;
  region: Uint8Array;
  dome: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  silhouette: HTMLCanvasElement;
}

/** Surface of the head at rest, computed once per size. Turning only relights and shifts it. */
function buildField(g: Geometry, dpr: number): Field {
  const top = Math.max(0, Math.floor((g.cy - 0.96 * g.S) / CELL));
  const bottom = Math.min(Math.ceil(g.H / CELL), Math.ceil((g.cy + 1.02 * g.S) / CELL));
  const left = Math.max(0, Math.floor((g.cx - 0.86 * g.S) / CELL));
  const right = Math.min(Math.ceil(g.W / CELL), Math.ceil((g.cx + 0.86 * g.S) / CELL));
  const cols = right - left;
  const rows = bottom - top;
  const n = cols * rows;
  const f: Field = {
    cols, rows, left, top,
    region: new Uint8Array(n), dome: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
    silhouette: document.createElement('canvas'),
  };
  const sil = f.silhouette;
  sil.width = Math.round(g.W * dpr);
  sil.height = Math.round(g.H * dpr);
  const sctx = sil.getContext('2d')!;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.fillStyle = C.bg;
  const eps = CELL / g.S;
  const tilt = 2.4; // exaggerated relief so the dither carries form, not flat fields
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const u = ((left + c) * CELL - g.cx) / g.S;
      const v = ((top + r) * CELL - g.cy) / g.S;
      const region = sampleHead(u, v, 0, 0, g)[1];
      if (!region) continue;
      f.region[i] = region;
      sctx.fillRect((left + c) * CELL, (top + r) * CELL, CELL, CELL);
      const rx = v > 0.1 ? 0.74 - (v - 0.1) * 0.45 : 0.74;
      f.dome[i] = Math.sqrt(Math.max(0, 1 - (u / rx) ** 2 - ((v + 0.12) / 0.82) ** 2));
      if (region > 1) continue;
      const hx = (sampleHead(u + eps, v, 0, 0, g)[0] - sampleHead(u - eps, v, 0, 0, g)[0]) / (2 * eps);
      const hy = (sampleHead(u, v + eps, 0, 0, g)[0] - sampleHead(u, v - eps, 0, 0, g)[0]) / (2 * eps);
      const nx = -hx * tilt, ny = -hy * tilt;
      const nn = Math.hypot(nx, ny, 1);
      f.nx[i] = nx / nn;
      f.ny[i] = ny / nn;
      f.nz[i] = 1 / nn;
    }
  }
  return f;
}

function buildLayer(layer: HTMLCanvasElement, g: Geometry, f: Field, dpr: number, yaw: number, pitch: number, bloom: boolean) {
  if (layer.width !== Math.round(g.W * dpr) || layer.height !== Math.round(g.H * dpr)) {
    layer.width = Math.round(g.W * dpr);
    layer.height = Math.round(g.H * dpr);
  }
  const ctx = layer.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.W, g.H);

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
    ctx.strokeStyle = `rgba(195, 248, 107, ${0.16 + i * 0.06})`;
    ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
  });
  const inner = rects[rects.length - 1];
  ctx.strokeStyle = 'rgba(195, 248, 107, 0.22)';
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

  // Occlude the tunnel behind the head, shifted with the skull.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(f.silhouette, Math.round(yaw * 0.035 * g.S * dpr), Math.round(pitch * 0.025 * g.S * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Relight: key light follows the gaze, plus a cool rim from the right and a specular glint.
  let lx = -0.42 + yaw * 0.6, ly = -0.6 + pitch * 0.5, lz = 0.68;
  const ln = Math.hypot(lx, ly, lz);
  lx /= ln; ly /= ln; lz /= ln;
  let hx = lx, hy = ly, hz = lz + 1;
  const hn = Math.hypot(hx, hy, hz);
  hx /= hn; hy /= hn; hz /= hn;
  const lime: number[] = [];
  const glint: number[] = [];
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const i = r * f.cols + c;
      if (f.region[i] !== 1) continue;
      const nx = f.nx[i], ny = f.ny[i], nz = f.nz[i];
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const spec = Math.max(0, nx * hx + ny * hy + nz * hz) ** 24;
      const rim = Math.max(0, nx * 0.8 - ny * 0.1) ** 3 * 0.35;
      const d = f.dome[i];
      const fill = Math.max(0, nz * 0.75 + ny * 0.35) * 0.3; // soft fill from below-front
      const b = (0.03 + 0.82 * diffuse ** 1.9 + fill + rim + 0.55 * spec) * (0.45 + 0.55 * Math.min(1, d * 1.8 + 0.2));
      const col = f.left + c, row = f.top + r;
      if ((BAYER[(row % 4) * 4 + (col % 4)] + 0.5) / 16 >= b) continue;
      const px = col * CELL + yaw * 0.07 * d * g.S;
      const py = row * CELL + pitch * 0.05 * d * g.S;
      (b > 0.85 ? glint : lime).push(px, py);
    }
  }
  ctx.fillStyle = C.lime;
  ctx.globalAlpha = 0.9;
  for (let k = 0; k < lime.length; k += 2) ctx.fillRect(lime[k], lime[k + 1], 2, 2);
  ctx.fillStyle = HIGHLIGHT;
  ctx.globalAlpha = 1;
  for (let k = 0; k < glint.length; k += 2) ctx.fillRect(glint[k], glint[k + 1], 2, 2);

  if (bloom) {
    // Phosphor bloom: one blurred additive copy, built only once the head is at rest.
    const copy = document.createElement('canvas');
    copy.width = layer.width;
    copy.height = layer.height;
    copy.getContext('2d')!.drawImage(layer, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.38;
    ctx.filter = `blur(${Math.round(5 * dpr)}px)`;
    ctx.drawImage(copy, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
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
) {
  const spanM = (r.w - 12) / g.pxPerM;
  const x0 = r.x + 6;
  const mid = r.y + r.h / 2;
  const X = (x: number) => x0 + x * g.pxPerM;

  ctx.save();
  roundRectPath(ctx, r, Math.max(4, EYE.r * g.S));
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
    ctx.globalAlpha = q % 4 === 0 ? 1.6 : 0.7;
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
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * spanM;
    const disp = fn(x) * g.unit;
    const n = Math.floor(Math.abs(disp) / 3);
    ctx.globalAlpha = 0.3;
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
  for (let px = 0; px <= r.w - 12; px += 1.5) {
    const y = mid - fn(px / g.pxPerM) * g.unit;
    px === 0 ? ctx.moveTo(x0 + px, y) : ctx.lineTo(x0 + px, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Bezel with registration corners.
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  roundRectPath(ctx, { x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }, Math.max(4, EYE.r * g.S));
  ctx.stroke();
  ctx.globalAlpha = 1;
  return { X, mid };
}

export function ObserverHead({ params: p, clock, focus, effects, reducedMotion }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<{ field: Field; W: number; H: number; dpr: number } | null>(null);
  const built = useRef({ yaw: NaN, pitch: NaN, W: 0, H: 0, bloom: false });
  const moving = useRef(false);
  const look = useRef({ yaw: 0, pitch: 0, ty: 0, tp: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { yaw, pitch } = look.current;
    const g = geometry(size.w, size.h, yaw, pitch);
    const b = built.current;
    if (!layerRef.current) layerRef.current = document.createElement('canvas');
    const fc = fieldRef.current;
    if (!fc || fc.W !== size.w || fc.H !== size.h || fc.dpr !== dpr) {
      fieldRef.current = { field: buildField(geometry(size.w, size.h, 0, 0), dpr), W: size.w, H: size.h, dpr };
      built.current.W = 0;
    }
    const bloom = effects && !moving.current;
    if (b.W !== size.w || b.H !== size.h || b.bloom !== bloom || Math.abs(b.yaw - yaw) > 0.004 || Math.abs(b.pitch - pitch) > 0.004) {
      buildLayer(layerRef.current, g, fieldRef.current!.field, dpr, yaw, pitch, bloom);
      built.current = { yaw, pitch, W: size.w, H: size.h, bloom };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layerRef.current, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLive(ctx, g, p, clock.t, particles, focus, effects);
  };
  useClockDraw(clock, draw, [size, p.A1, p.A2, p.f, p.phi, focus, effects]);

  // The head turns toward the pointer, then settles. Off under reduced motion.
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    if (reducedMotion) {
      look.current = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      drawRef.current();
      return;
    }
    let raf = 0;
    const tick = () => {
      const l = look.current;
      l.yaw += (l.ty - l.yaw) * 0.12;
      l.pitch += (l.tp - l.pitch) * 0.12;
      const settling = Math.abs(l.ty - l.yaw) + Math.abs(l.tp - l.pitch) > 0.002;
      moving.current = settling;
      drawRef.current();
      raf = settling ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el || e.pointerType === 'touch') return;
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

  const AR = resultantAmplitude(p);
  const label = `Live wave model drawn as a dot-matrix robot face. Left eye: wave 1, amplitude ${fixed(p.A1)}. Right eye: wave 2, amplitude ${fixed(p.A2)}, shifted by ${fixed(p.phi, 0)} degrees. Mouth: their sum, amplitude ${fixed(AR)}.`;
  return (
    <div className="stage-canvas observer" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: size.w, height: size.h }} />
    </div>
  );
}

function paintLive(ctx: CanvasRenderingContext2D, g: Geometry, p: WaveParams, t: number, particles: Particle[], focus: string | null, effects: boolean) {
  const AR = resultantAmplitude(p);
  const compact = g.W < 520;
  const [L, R] = g.eyes;

  // Eyes: the two source waves over the same 2 m window.
  const left = drawScreen(ctx, L, g, (x) => y1(x, t, p), C.lime, particles, effects);
  const right = drawScreen(ctx, R, g, (x) => y2(x, t, p), C.ice, particles, effects);

  // Matching crests: wave 1's crest in [1, 2) m, wave 2's lies φ/360·λ before it.
  let x1c = (Math.PI / 2 + 2 * Math.PI * p.f * t) / WAVE_NUMBER;
  x1c = ((((x1c - 1) % WAVELENGTH_M) + WAVELENGTH_M) % WAVELENGTH_M) + 1;
  const off = phaseOffsetMeters(p.phi);
  const x2c = x1c - off;
  const strong = focus === 'phi';
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
    ctx.arc(right.X(x2c), right.mid - p.A2 * g.unit, 3.2, 0, Math.PI * 2);
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
  ctx.restore();

  // Mouth: the sum, with ghost sources and the ±A_R envelope.
  const M = g.mouth;
  const mouth = drawScreen(ctx, M, g, (x) => yTotal(x, t, p), C.text, particles, effects);
  ctx.save();
  roundRectPath(ctx, M, Math.max(4, EYE.r * g.S));
  ctx.clip();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  for (const [fn, col] of [[(x: number) => y1(x, t, p), 'rgba(195,248,107,0.4)'], [(x: number) => y2(x, t, p), 'rgba(185,225,207,0.4)']] as const) {
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let px = 0; px <= M.w - 12; px += 2) {
      const y = mouth.mid - fn(px / g.pxPerM) * g.unit;
      px === 0 ? ctx.moveTo(M.x + 6 + px, y) : ctx.lineTo(M.x + 6 + px, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(224,235,224,0.45)';
  for (const s of [-1, 1]) {
    const y = Math.round(mouth.mid - s * AR * g.unit) + 0.5;
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
  tab(compact ? '● y₁' : '● y₁ wave 1', L.x + 8, L.y + L.h - 7, C.lime);
  tab(`A₁ ${fixed(p.A1)}`, L.x + L.w - 8, L.y + L.h - 7, C.dim, 'right');
  tab(compact ? '■ y₂' : '■ y₂ wave 2', R.x + 8, R.y + R.h - 7, C.ice);
  tab(`A₂ ${fixed(p.A2)}`, R.x + R.w - 8, R.y + R.h - 7, C.dim, 'right');
  tab('◎ y = y₁ + y₂', M.x + 8, M.y + 16, C.text);
  tab(AR < 1e-6 ? 'A_R 0 · cancelled' : `A_R ${fixed(AR)}`, M.x + M.w - 8, M.y + 16, AR < 1e-6 ? C.lime : C.dim, 'right');

  // Phase bar across the bridge between the eyes and the mouth.
  const bridgeY = (L.y + L.h + M.y) / 2 + 4;
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

  // Serial header reads the live parameters, dossier-style.
  ctx.fillStyle = C.lime;
  ctx.font = `${compact ? 18 : 22}px ${PIXEL}`;
  ctx.fillText('SERIAL:', 24, 34);
  ctx.fillText(`/λ${fixed(WAVELENGTH_M)} /f${fixed(p.f)} /φ${fixed(p.phi, 0)}`, 24, compact ? 52 : 56);
  if (!compact) {
    const unitText = 'OBSERVER OU-01';
    ctx.fillText(unitText, g.W - 24 - ctx.measureText(unitText).width, 34);
    ctx.font = `12px ${MONO}`;
    ctx.fillStyle = C.dim;
    const t2 = `t = ${fixed(t, 2)} s`;
    ctx.fillText(t2, g.W - 24 - ctx.measureText(t2).width, 54);
  }

  // Probe swatches: dither density = displacement at fixed points (left y₁, right y).
  if (g.swatches) {
    const rects = swatchRects(g);
    rects.forEach((r, i) => {
      const side = i >= 6 ? 1 : 0;
      const x = 0.25 + (i % 6) * 0.5;
      const val = side ? yTotal(x, t, p) / 3.0 : y1(x, t, p) / 1.5;
      const density = Math.max(0, Math.min(1, (val + 1) / 2));
      ctx.fillStyle = side ? C.text : C.lime;
      const cells = Math.floor(r.w / 3);
      for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
        if ((BAYER[(cy % 4) * 4 + (cx % 4)] + 0.5) / 16 < density) {
          ctx.globalAlpha = 0.75;
          ctx.fillRect(r.x + 1 + cx * 3, r.y + 1 + cy * 3, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    });
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = C.dim;
    const r5 = rects[5], r11 = rects[11];
    ctx.fillText('y₁ probe', r5.x, r5.y + r5.h + 18);
    const lbl = 'y probe';
    ctx.fillText(lbl, r11.x + r11.w - ctx.measureText(lbl).width, r11.y + r11.h + 18);
  }
}
