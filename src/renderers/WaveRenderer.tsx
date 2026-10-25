import { useEffect, useMemo, useRef, useState } from 'react';
import { useClockDraw } from '../lib/clock';
import { fixed } from '../lib/format';
import {
  WAVELENGTH_M,
  WAVE_NUMBER,
  X_SPAN_M,
  phaseOffsetMeters,
  resultantAmplitude,
  y1,
  y2,
  yTotal,
  type WaveParams,
} from '../lib/physics/wave';
import { C, MONO, seeded } from './palette';
import type { RendererProps } from './types';

const PARTICLES = 180;
const COLUMNS = 72; // stippled displacement columns, every λ/24

interface Particle { x: number; o: number }

function useCanvasSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export default function WaveRenderer(props: RendererProps) {
  const { params, clock, focusedTerm, highlight, effects, compact } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(wrapRef);
  const p = params as unknown as WaveParams;

  const particles = useMemo<Particle[]>(() => {
    const rnd = seeded(7);
    return Array.from({ length: PARTICLES }, (_, i) => ({ x: ((i + rnd()) / PARTICLES) * X_SPAN_M, o: rnd() * 2 - 1 }));
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, size.w, size.h, p, clock.t, particles, focusedTerm, highlight, effects, !!compact);
  };
  useClockDraw(clock, draw, [size, p.A1, p.A2, p.f, p.phi, focusedTerm, highlight, effects, compact]);

  const AR = resultantAmplitude(p);
  const label = `Wave interference model. Wave 1 amplitude ${fixed(p.A1)}, wave 2 amplitude ${fixed(p.A2)}, phase difference ${fixed(p.phi, 0)} degrees, frequency ${fixed(p.f)} hertz. The sum has amplitude ${fixed(AR)}.`;

  return (
    <div className="stage-canvas" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: size.w, height: size.h }} />
    </div>
  );
}

/** Draws text with _X subscripts (e.g. A_R) as real subscripts. Returns the width. */
export function fillMath(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, measureOnly = false): number {
  const size = parseFloat(ctx.font) || 12;
  const base = ctx.font;
  let w = 0;
  for (const part of text.split(/(_[A-Za-z0-9])/)) {
    if (!part) continue;
    const isSub = part.startsWith('_');
    const str = isSub ? part.slice(1) : part;
    if (isSub) ctx.font = base.replace(/^\d+(\.\d+)?px/, `${Math.round(size * 0.72)}px`);
    if (!measureOnly) ctx.fillText(str, x + w, y + (isSub ? size * 0.28 : 0));
    w += ctx.measureText(str).width;
    ctx.font = base;
  }
  return w;
}

function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: WaveParams,
  t: number,
  particles: Particle[],
  focus: string | null,
  highlight: string | null,
  effects: boolean,
  compact: boolean,
) {
  ctx.clearRect(0, 0, W, H);
  const padL = compact ? 66 : 76;
  const padR = 16;
  const padT = compact ? 22 : 26;
  const padB = 28;
  const gap = compact ? 16 : 22;
  const plotW = W - padL - padR;
  const u = Math.max(4, (H - padT - padB - 2 * gap) / 12.6);
  const c1 = padT + 1.6 * u;
  const c2 = c1 + 3.2 * u + gap;
  const c3 = c2 + 1.6 * u + gap + 3.1 * u;
  const X = (x: number) => padL + (x / X_SPAN_M) * plotW;
  const AR = resultantAmplitude(p);

  const laneFocus = (lane: 1 | 2 | 3) => {
    if (!focus) return 1;
    const owners: Record<string, number[]> = { y1: [1], A1: [1], y2: [2], A2: [2], y: [3], phi: [1, 2, 3], f: [1, 2, 3], k: [1, 2, 3], x: [1, 2, 3], t: [1, 2, 3] };
    const o = owners[focus];
    return !o || o.includes(lane) ? 1 : 0.35;
  };

  // Measurement grid: λ/4 minor, λ major.
  ctx.lineWidth = 1;
  for (let i = 0; i <= X_SPAN_M * 4; i++) {
    const x = Math.round(X(i * 0.25 * WAVELENGTH_M)) + 0.5;
    const major = i % 4 === 0;
    ctx.strokeStyle = major ? 'rgba(198,190,255,0.22)' : 'rgba(198,190,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, padT - 6);
    ctx.lineTo(x, H - padB + (major ? 6 : 0));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = focus === 'x' || focus === 'k' ? C.text : C.dim;
      ctx.font = `12px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? '0' : `${i / 4} m`, x, H - padB + 20);
    }
  }
  ctx.textAlign = 'left';

  const lanes: { c: number; half: number; fn: (x: number) => number; color: string; glyph: string; sym: string; sub: string; lane: 1 | 2 | 3 }[] = [
    { c: c1, half: 1.6 * u, fn: (x) => y1(x, t, p), color: C.lime, glyph: '●', sym: 'y₁', sub: `A₁ ${fixed(p.A1)}`, lane: 1 },
    { c: c2, half: 1.6 * u, fn: (x) => y2(x, t, p), color: C.ice, glyph: '■', sym: 'y₂', sub: `A₂ ${fixed(p.A2)}`, lane: 2 },
    { c: c3, half: 3.1 * u, fn: (x) => yTotal(x, t, p), color: C.text, glyph: '◎', sym: 'y', sub: `A_R ${fixed(AR)}`, lane: 3 },
  ];

  for (const L of lanes) {
    const alpha = laneFocus(L.lane);
    ctx.globalAlpha = alpha;

    // Lane rules and equilibrium line.
    ctx.strokeStyle = 'rgba(198,190,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(L.c - L.half) + 0.5);
    ctx.lineTo(W - padR, Math.round(L.c - L.half) + 0.5);
    ctx.moveTo(padL, Math.round(L.c + L.half) + 0.5);
    ctx.lineTo(W - padR, Math.round(L.c + L.half) + 0.5);
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(173,180,199,0.35)';
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(L.c) + 0.5);
    ctx.lineTo(W - padR, Math.round(L.c) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label column.
    ctx.fillStyle = L.color;
    ctx.font = `${compact ? 12 : 13}px ${MONO}`;
    ctx.fillText(`${L.glyph} ${L.sym}`, 10, L.c - 2);
    ctx.fillStyle = C.dim;
    ctx.font = `12px ${MONO}`;
    fillMath(ctx, L.sub, 10, L.c + 14);

    // Sum lane: ghost sources and amplitude envelope.
    if (L.lane === 3) {
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (const [fn, col] of [[(x: number) => y1(x, t, p), 'rgba(203,255,105,0.45)'], [(x: number) => y2(x, t, p), 'rgba(169,231,255,0.45)']] as const) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        for (let px = 0; px <= plotW; px += 2) {
          const x = (px / plotW) * X_SPAN_M;
          const yy = L.c - fn(x) * u;
          px === 0 ? ctx.moveTo(padL + px, yy) : ctx.lineTo(padL + px, yy);
        }
        ctx.stroke();
      }
      const env = highlight === 'resultant' || focus === 'y';
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = env ? C.text : 'rgba(238,240,250,0.35)';
      ctx.lineWidth = env ? 1.5 : 1;
      for (const s of [-1, 1]) {
        const yy = Math.round(L.c - s * AR * u) + 0.5;
        ctx.beginPath();
        ctx.moveTo(padL, yy);
        ctx.lineTo(W - padR, yy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      if (env || !compact) {
        ctx.font = `12px ${MONO}`;
        ctx.fillStyle = env ? C.text : C.dim;
        const tag = AR < 1e-6 ? 'A_R = 0  · complete cancellation' : `±A_R = ±${fixed(AR)}`;
        const tw = fillMath(ctx, tag, 0, 0, true);
        const ty = AR < 1e-6 ? L.c - 10 : L.c - AR * u - 6;
        ctx.fillStyle = 'rgba(8,10,13,0.8)';
        ctx.fillRect(W - padR - tw - 10, ty - 13, tw + 8, 19);
        ctx.fillStyle = env ? C.text : C.dim;
        fillMath(ctx, tag, W - padR - tw - 6, ty);
      }
    }

    // Stippled displacement columns: dot count is proportional to displacement.
    ctx.fillStyle = L.color;
    for (let i = 0; i <= COLUMNS; i++) {
      const x = (i / COLUMNS) * X_SPAN_M;
      const disp = L.fn(x) * u;
      const n = Math.floor(Math.abs(disp) / 3);
      const px = X(x);
      ctx.globalAlpha = alpha * 0.32;
      for (let d = 1; d <= n; d++) ctx.fillRect(px - 0.6, L.c - Math.sign(disp) * d * 3 - 0.6, 1.2, 1.2);
    }

    // Luminous particle ribbon: each dot is a point of the medium at its displaced height.
    ctx.globalCompositeOperation = effects ? 'lighter' : 'source-over';
    for (const q of particles) {
      const yy = L.c - L.fn(q.x) * u + q.o * (L.lane === 3 ? 3 : 2.2);
      ctx.globalAlpha = alpha * (0.45 + 0.35 * Math.abs(q.o));
      ctx.fillRect(X(q.x) - 0.9, yy - 0.9, 1.8, 1.8);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Exact trace.
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = L.color;
    ctx.lineWidth = L.lane === 3 ? 2.2 : 1.5;
    if (effects) {
      ctx.shadowColor = L.color;
      ctx.shadowBlur = L.lane === 3 ? 12 : 8;
    }
    ctx.beginPath();
    for (let px = 0; px <= plotW; px += 1.5) {
      const x = (px / plotW) * X_SPAN_M;
      const yy = L.c - L.fn(x) * u;
      px === 0 ? ctx.moveTo(padL + px, yy) : ctx.lineTo(padL + px, yy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;

  // Phase markers: a crest of y1 and the matching crest of y2.
  const omegaT = 2 * Math.PI * p.f * t;
  let x1c = (Math.PI / 2 + omegaT) / WAVE_NUMBER;
  x1c = ((((x1c - 1) % WAVELENGTH_M) + WAVELENGTH_M) % WAVELENGTH_M) + 1; // keep in [1, 2) m
  const off = phaseOffsetMeters(p.phi);
  const x2c = x1c - off;
  const strong = highlight === 'phase' || focus === 'phi';
  ctx.globalAlpha = strong ? 1 : 0.6;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = strong ? 1.5 : 1;
  if (p.A1 > 0) {
    ctx.strokeStyle = C.lime;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(x1c)) + 0.5, c1 - p.A1 * u);
    ctx.lineTo(Math.round(X(x1c)) + 0.5, c2 + 1.6 * u);
    ctx.stroke();
  }
  if (p.A2 > 0) {
    ctx.strokeStyle = C.ice;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(x2c)) + 0.5, c1 - 1.6 * u);
    ctx.lineTo(Math.round(X(x2c)) + 0.5, c2 - p.A2 * u);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crest dots.
  for (const [x, y, col] of [[x1c, c1 - p.A1 * u, C.lime], [x2c, c2 - p.A2 * u, C.ice]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(X(x), y, strong ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bracket between crests, in the gap between lanes 1 and 2.
  const by = c1 + 1.6 * u + gap / 2;
  ctx.strokeStyle = C.amber;
  ctx.fillStyle = C.amber;
  ctx.lineWidth = strong ? 2 : 1.25;
  if (effects && strong) {
    ctx.shadowColor = C.amber;
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.moveTo(X(x2c), by - 4);
  ctx.lineTo(X(x2c), by);
  ctx.lineTo(X(x1c), by);
  ctx.lineTo(X(x1c), by + 4);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = `${strong ? 13 : 12}px ${MONO}`;
  const phTag = `◆ φ = ${fixed(p.phi, 0)}° · ${fixed(off)} m`;
  const tw = ctx.measureText(phTag).width;
  const tx = Math.min(W - padR - tw - 4, Math.max(padL + 4, X(x1c) + 8));
  ctx.fillStyle = 'rgba(8,10,13,0.85)';
  ctx.fillRect(tx - 4, by - 9, tw + 8, 17);
  ctx.fillStyle = C.amber;
  ctx.fillText(phTag, tx, by + 4);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  // Term-focused annotations.
  ctx.font = `12px ${MONO}`;
  const ampBracket = (x: number, c: number, A: number, col: string, text: string) => {
    const px = X(x) - 14;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(px + 4, c);
    ctx.lineTo(px, c);
    ctx.lineTo(px, c - A * u);
    ctx.lineTo(px + 4, c - A * u);
    ctx.stroke();
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(8,10,13,0.85)';
    ctx.fillRect(px - w - 10, c - (A * u) / 2 - 9, w + 6, 16);
    ctx.fillStyle = col;
    ctx.fillText(text, px - w - 7, c - (A * u) / 2 + 3);
  };
  if (focus === 'A1' || focus === 'y1') ampBracket(x1c, c1, p.A1, C.lime, `A₁ = ${fixed(p.A1)}`);
  if (focus === 'A2' || focus === 'y2') ampBracket(x2c, c2, p.A2, C.ice, `A₂ = ${fixed(p.A2)}`);
  if (focus === 'k' || focus === 'x') {
    const xa = x1c, xb = x1c + WAVELENGTH_M <= X_SPAN_M ? x1c + WAVELENGTH_M : x1c - WAVELENGTH_M;
    const yy = c1 - 1.6 * u + 6;
    ctx.strokeStyle = C.text;
    ctx.beginPath();
    ctx.moveTo(X(xa), yy + 4);
    ctx.lineTo(X(xa), yy);
    ctx.lineTo(X(xb), yy);
    ctx.lineTo(X(xb), yy + 4);
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.fillText(`λ = ${fixed(WAVELENGTH_M)} m · k = ${fixed(WAVE_NUMBER)} rad/m`, Math.min(X(xa), X(xb)) + 6, yy + 16);
  }
  if (focus === 'f') {
    // Probe: one point of the medium, rising and falling f times per second.
    const xp = 0.25;
    const yy = c3 - yTotal(xp, t, p) * u;
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(xp), yy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = C.violet;
    ctx.fillText(`▲ f = ${fixed(p.f)} Hz: this point completes ${fixed(p.f)} cycles/s`, X(xp) + 14, Math.max(padT + 10, yy - 10));
  }

  // Simulated time.
  ctx.font = `12px ${MONO}`;
  ctx.fillStyle = focus === 't' ? C.text : C.dim;
  const tt = `t = ${fixed(t, 2)} s`;
  ctx.fillText(tt, W - padR - ctx.measureText(tt).width, 14);
}
