import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePageVisible } from '../lib/clock';
import { claimFlight, fly, leaveFlight, observerParams } from '../lib/observerFlight';
import { y1, y2, yTotal } from '../lib/physics/wave';
import { useSettings } from '../lib/settings';
import { HEAD_BOX, buildField, drawHead, headGeometry, type Field, type Geometry, type Rect } from './ObserverHead';
import { C } from './palette';

const SIZE = 34; // CSS px; square because HEAD_BOX is square
const CELL = 1.5;
const S = SIZE / (HEAD_BOX.u1 - HEAD_BOX.u0);
const CX = -HEAD_BOX.u0 * S;
const CY = -HEAD_BOX.v0 * S;
const PARALLAX = 3.4; // exaggerated so a 34 px head visibly turns toward the cursor
const FRAME_MS = 1000 / 30;

const geom = (yaw: number, pitch: number): Geometry => headGeometry(SIZE, SIZE, S, CX, CY, yaw, pitch, { pad: 1, swatches: false, parallax: PARALLAX });

function screen(ctx: CanvasRenderingContext2D, r: Rect, g: Geometry, fn: (x: number) => number, color: string) {
  const rad = Math.max(1, r.h * 0.3);
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = '#020403';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  const mid = r.y + r.h / 2;
  for (let px = 0; px <= r.w; px += 0.75) {
    const y = mid - fn((px - g.pad) / g.pxPerM) * g.unit;
    px === 0 ? ctx.moveTo(r.x + px, y) : ctx.lineTo(r.x + px, y);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The observer head, docked beside the wordmark. Follows the cursor anywhere on the page. */
export function MiniObserver() {
  const ref = useRef<HTMLCanvasElement>(null);
  const field = useRef<{ f: Field; dpr: number } | null>(null);
  const look = useRef({ yaw: 0, pitch: 0, ty: 0.25, tp: 0.35 });
  const { reducedMotion, effects } = useSettings();
  const visible = usePageVisible();
  const [landing, setLanding] = useState(false);

  const draw = (t: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    if (!field.current || field.current.dpr !== dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
      field.current = { f: buildField(geom(0, 0), dpr, CELL), dpr };
    }
    const ctx = canvas.getContext('2d')!;
    const { yaw, pitch } = look.current;
    const g = geom(yaw, pitch);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Brighter, cell-filling dots: at 34 px a sparse dither reads as a dark blob.
    drawHead(ctx, g, field.current.f, dpr, yaw, pitch, CELL, 1.75);
    const p = observerParams;
    screen(ctx, g.eyes[0], g, (x) => y1(x, t, p), C.lime);
    screen(ctx, g.eyes[1], g, (x) => y2(x, t, p), C.ice);
    screen(ctx, g.mouth, g, (x) => yTotal(x, t, p), C.text);
  };

  // Arriving from the entry screen: hold still until the flying head lands here.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    draw(0);
    const arrival = reducedMotion ? null : claimFlight('dock');
    if (arrival?.image) {
      setLanding(true);
      const r = canvas.getBoundingClientRect();
      void fly(arrival.image, arrival.from, { x: r.left, y: r.top, w: r.width, h: r.height }).then(() => setLanding(false));
    }
    return () => {
      if (reducedMotionRef.current) return;
      const r = canvas.getBoundingClientRect();
      if (r.width) leaveFlight('undock', { x: r.left, y: r.top, w: r.width, h: r.height });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    if (reducedMotion) {
      look.current = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
      draw(0);
      return;
    }
    if (!visible) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      const l = look.current;
      l.yaw += (l.ty - l.yaw) * 0.18;
      l.pitch += (l.tp - l.pitch) * 0.18;
      draw(now / 1000);
    };
    const move = (e: PointerEvent) => {
      const canvas = ref.current;
      if (!canvas || e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      // Seen from the top-left corner most of the page is down and to the right; scale so
      // the far corner of the window is a full turn.
      look.current.ty = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.55));
      look.current.tp = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.6));
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, visible]);

  return (
    <canvas
      ref={ref}
      className={`mini-observer${landing ? ' landing' : ''}${effects ? ' glow' : ''}`}
      style={{ width: SIZE, height: SIZE }}
      aria-hidden="true"
    />
  );
}
