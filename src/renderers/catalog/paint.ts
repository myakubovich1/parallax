import type { Params } from '../../lib/lessons/types';
import { symbol } from '../../lib/catalog/display';
import { formatValue, type Formula } from '../../lib/catalog/formulas';
import { C, MONO } from '../palette';
export const W = 1000,
  H = 500;
export type Paint = ReturnType<typeof painter>;
export function painter(ctx: CanvasRenderingContext2D, effects: boolean) {
  function line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = C.dim,
    width = 1,
    dash: number[] = [],
  ) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function path(points: [number, number][], color: string = C.lime, width = 2, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }
  function circle(
    x: number,
    y: number,
    r: number,
    color: string = C.lime,
    fill = false,
    alpha = 1,
  ) {
    if (r <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
  function glow(x: number, y: number, r: number, color: string = C.lime) {
    if (!effects) return;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color + '19');
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function body(x: number, y: number, r: number, color: string = C.lime) {
    glow(x, y, r * 3, color);
    for (let yy = -r; yy <= r; yy += 4)
      for (let xx = -r; xx <= r; xx += 4)
        if (xx * xx + yy * yy < r * r) {
          const lighting = 0.25 + 0.7 * (1 - (xx + yy + 2 * r) / (4 * r));
          ctx.globalAlpha = lighting;
          ctx.fillStyle = color;
          ctx.fillRect(x + xx, y + yy, 1.5, 1.5);
        }
    ctx.globalAlpha = 1;
    circle(x, y, r, color);
    circle(x, y, r + 4, color, false, 0.15);
    circle(x, y, 2, color, true);
  }
  function rect(x: number, y: number, w: number, h: number, color: string = C.lime, fill = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    if (fill) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    for (let yy = y + 4; yy < y + h; yy += 5)
      for (let xx = x + 4; xx < x + w; xx += 5) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(xx, yy, 1, 1);
      }
    ctx.globalAlpha = 1;
  }
  function arrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = C.text,
    width = 2,
  ) {
    if (Math.hypot(x2 - x1, y2 - y1) < 1) return;
    line(x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1);
    path(
      [
        [x2 - 10 * Math.cos(a - 0.42), y2 - 10 * Math.sin(a - 0.42)],
        [x2, y2],
        [x2 - 10 * Math.cos(a + 0.42), y2 - 10 * Math.sin(a + 0.42)],
      ],
      color,
      width,
    );
  }
  function text(
    x: number,
    y: number,
    value: string,
    color: string = C.dim,
    size = 15,
    align: CanvasTextAlign = 'left',
  ) {
    ctx.font = `${size}px ${MONO}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }
  function dimension(x1: number, y: number, x2: number, label: string) {
    line(x1, y - 8, x1, y + 8, C.amber);
    line(x2, y - 8, x2, y + 8, C.amber);
    line(x1, y, x2, y, C.amber);
    text((x1 + x2) / 2, y + 26, label, C.amber, 15, 'center');
  }
  function field(x: number, y: number, radii: number[], color: string = C.violet) {
    radii.forEach((r, i) => circle(x, y, r, color, false, 0.08 + i * 0.035));
  }
  function spring(x1: number, x2: number, y: number, coils = 18) {
    const pts: [[number, number], ...[number, number][]] = [[x1, y]];
    for (let i = 0; i <= coils * 2; i++)
      pts.push([x1 + 8 + ((x2 - x1 - 16) * i) / (coils * 2), y + (i % 2 ? 12 : -12)]);
    pts.push([x2, y]);
    path(pts, C.lime, 2);
  }
  return { ctx, line, path, circle, glow, body, rect, arrow, text, dimension, field, spring };
}
export interface SceneState {
  f: Formula;
  p: Params;
  t: number;
  reference: Params | null;
  focused: string | null;
}
export function background(g: Paint, f: Formula, p: Params, t: number) {
  const { ctx, line, text } = g;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const gradient = ctx.createRadialGradient(500, 270, 20, 500, 270, 500);
  gradient.addColorStop(0, '#24382b55');
  gradient.addColorStop(1, '#080d0b00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  for (let x = 60; x <= 940; x += 55) line(x, 100, x, 440, C.rule, 0.5);
  for (let y = 110; y <= 440; y += 55) line(60, y, 940, y, C.rule, 0.35);
  line(38, 82, 962, 82, C.rule);
  line(38, 467, 962, 467, C.rule);
  f.params.slice(0, 4).forEach((d, i) => {
    text(55 + i * 235, 30, d.label.toUpperCase(), C.dim, 11);
    text(
      55 + i * 235,
      59,
      `${symbol(d.symbol)} = ${formatValue(p[d.id])} ${d.unit}`,
      [C.lime, C.ice, C.amber, C.violet][i],
      `${symbol(d.symbol)} = ${formatValue(p[d.id])} ${d.unit}`.length > 20 ? 14 : 18,
    );
  });
  text(950, 106, `playback ${t.toFixed(1)} s`, C.dim, 11, 'right');
}
export const sample = (n: number, fn: (k: number) => [number, number]) =>
  Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const number = (v: number) => formatValue(v);
export const TAU = 2 * Math.PI;
