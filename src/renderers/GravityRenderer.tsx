import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { fixed, sci } from '../lib/format';
import { G, force, minSeparation, sphereRadius, type GravityParams } from '../lib/physics/gravity';
import { C, MONO } from './palette';
import type { RendererProps } from './types';

const VW = 1000;
const VH = 420;
const SPAN_M = 6; // world width in metres
const PAD = 40;
const PX_PER_M = (VW - 2 * PAD) / SPAN_M;
const CY = 190;
const MIN_BODY_PX = 5;
/** Arrow length is logarithmic in force: 10⁻¹² N → 14 px, 10⁻² N → 240 px. */
const LOG_F_MIN = -12;
const LOG_F_MAX = -2;
const arrowLen = (F: number) => 14 + ((Math.min(LOG_F_MAX, Math.max(LOG_F_MIN, Math.log10(F))) - LOG_F_MIN) / (LOG_F_MAX - LOG_F_MIN)) * 226;
const toPx = (m: number) => PAD + m * PX_PER_M;

/** Marching squares over the combined potential Φ = −G m1/d1 − G m2/d2. */
function equipotentials(x1: number, x2: number, m1: number, m2: number): string[] {
  const nx = 96, ny = 40;
  const ymin = -(CY - 20) / PX_PER_M, ymax = (VH - 60 - CY) / PX_PER_M;
  const grid: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    const y = ymin + ((ymax - ymin) * j) / ny;
    for (let i = 0; i <= nx; i++) {
      const x = (SPAN_M * i) / nx;
      const d1 = Math.max(0.05, Math.hypot(x - x1, y));
      const d2 = Math.max(0.05, Math.hypot(x - x2, y));
      row.push(Math.log10(G * m1 / d1 + G * m2 / d2)); // log |Φ|
    }
    grid.push(row);
  }
  const flat = grid.flat();
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const levels = Array.from({ length: 9 }, (_, k) => lo + ((hi - lo) * (k + 1)) / 11);
  const sx = (i: number) => toPx((SPAN_M * i) / nx);
  const sy = (j: number) => CY + (ymin + ((ymax - ymin) * j) / ny) * PX_PER_M;
  return levels.map((lv) => {
    let d = '';
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], e = grid[j + 1][i];
      const pts: [number, number][] = [];
      const edge = (va: number, vb: number, xa: number, ya: number, xb: number, yb: number) => {
        if ((va < lv) !== (vb < lv)) {
          const k = (lv - va) / (vb - va);
          pts.push([xa + (xb - xa) * k, ya + (yb - ya) * k]);
        }
      };
      edge(a, b, sx(i), sy(j), sx(i + 1), sy(j));
      edge(b, c, sx(i + 1), sy(j), sx(i + 1), sy(j + 1));
      edge(c, e, sx(i + 1), sy(j + 1), sx(i), sy(j + 1));
      edge(e, a, sx(i), sy(j + 1), sx(i), sy(j));
      for (let k = 0; k + 1 < pts.length; k += 2) d += `M${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)}L${pts[k + 1][0].toFixed(1)} ${pts[k + 1][1].toFixed(1)}`;
    }
    return d;
  });
}

export default function GravityRenderer({ params, setParams, focusedTerm: focus, highlight, reference, onFocusTerm, effects }: RendererProps) {
  const p = params as unknown as GravityParams;
  const svgRef = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState(SPAN_M / 2);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);

  // Keep both bodies inside the world.
  const half = p.r / 2;
  const cx = Math.min(SPAN_M - 0.3 - half, Math.max(0.3 + half, center));
  const x1 = cx - half, x2 = cx + half;
  const R1 = Math.max(MIN_BODY_PX, sphereRadius(p.m1) * PX_PER_M);
  const R2 = Math.max(MIN_BODY_PX, sphereRadius(p.m2) * PX_PER_M);
  const F = force(p);
  const L = arrowLen(F);
  const Lref = reference ? arrowLen(force(reference as unknown as GravityParams)) : null;
  const contours = useMemo(() => equipotentials(x1, x2, p.m1, p.m2), [x1, x2, p.m1, p.m2]);

  const minR = minSeparation(p.m1, p.m2);
  const moveBody = (which: 1 | 2, xm: number) => {
    const clamped = Math.min(SPAN_M - 0.3, Math.max(0.3, xm));
    const other = which === 1 ? x2 : x1;
    let r = Math.abs(other - clamped);
    r = Math.min(5, Math.max(minR, r));
    const nx = which === 1 ? Math.min(clamped, other - r) : Math.max(clamped, other + r);
    setCenter((nx + other) / 2);
    setParams({ r: Math.round(r * 100) / 100 });
  };

  const svgX = (e: PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return (loc.x - PAD) / PX_PER_M;
  };
  const onDown = (which: 1 | 2) => (e: PointerEvent<SVGGElement>) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(which);
    onFocusTerm('r');
  };
  const onMove = (which: 1 | 2) => (e: PointerEvent<SVGGElement>) => {
    if (dragging === which) moveBody(which, svgX(e));
  };
  const onUp = () => setDragging(null);
  const onKey = (which: 1 | 2) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    const pos = which === 1 ? x1 : x2;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    moveBody(which, pos + dir * step);
  };

  const sepStrong = focus === 'r' || highlight === 'separation';
  const arrowStrong = focus === 'F' || highlight === 'arrows';
  const glow = effects ? 'url(#glow)' : undefined;
  const Ftext = `${sci(F)} N`;
  const bodyLabel = (n: 1 | 2) => `Sphere ${n}, ${fixed(n === 1 ? p.m1 : p.m2, 0)} kilograms. Separation ${fixed(p.r)} metres. Use arrow keys to move.`;

  return (
    <div className="stage-svg">
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`Two spheres ${fixed(p.r)} m apart. Each feels a force of ${Ftext}.`}>
        <defs>
          <pattern id="stip-lime" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill={C.lime} /></pattern>
          <pattern id="stip-ice" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill={C.ice} /></pattern>
          <radialGradient id="shade" cx="35%" cy="35%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0.15" /></radialGradient>
          <mask id="shade-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#shade)" /></mask>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={C.text} /></marker>
        </defs>

        {/* Metre grid */}
        {Array.from({ length: SPAN_M + 1 }, (_, i) => (
          <g key={i}>
            <line x1={toPx(i)} x2={toPx(i)} y1={20} y2={VH - 60} stroke={C.violet} strokeOpacity={0.12} />
            <text x={toPx(i)} y={VH - 40} fill={C.dim} fontFamily={MONO} fontSize={12} textAnchor="middle">{i} m</text>
          </g>
        ))}

        {/* Equipotential contours of the combined field */}
        <g fill="none" stroke={C.violet} strokeWidth={1} aria-hidden="true">
          {contours.map((d, i) => <path key={i} d={d} strokeOpacity={0.12 + i * 0.035} />)}
        </g>

        {/* Separation */}
        <g className={sepStrong ? 'ann strong' : 'ann'} aria-hidden="true">
          <line x1={toPx(x1)} x2={toPx(x1)} y1={CY + Math.max(R1, R2, 10) + 34} y2={CY + 96} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={sepStrong ? 1 : 0.6} />
          <line x1={toPx(x2)} x2={toPx(x2)} y1={CY + Math.max(R1, R2, 10) + 34} y2={CY + 96} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={sepStrong ? 1 : 0.6} />
          <line x1={toPx(x1)} x2={toPx(x2)} y1={CY + 90} y2={CY + 90} stroke={C.amber} strokeWidth={sepStrong ? 2 : 1.25} filter={sepStrong ? glow : undefined} />
          <rect x={(toPx(x1) + toPx(x2)) / 2 - 64} y={CY + 99} width={128} height={20} fill={C.bg} />
          <text x={(toPx(x1) + toPx(x2)) / 2} y={CY + 114} fill={C.amber} fontFamily={MONO} fontSize={sepStrong ? 15 : 13} textAnchor="middle">◆ r = {fixed(p.r)} m</text>
        </g>

        {/* Bodies */}
        {([1, 2] as const).map((n) => {
          const x = toPx(n === 1 ? x1 : x2);
          const R = n === 1 ? R1 : R2;
          const col = n === 1 ? C.lime : C.ice;
          const strong = focus === (n === 1 ? 'm1' : 'm2');
          return (
            <g
              key={n}
              className={`body${dragging === n ? ' dragging' : ''}`}
              tabIndex={0}
              role="slider"
              aria-label={bodyLabel(n)}
              aria-valuemin={0}
              aria-valuemax={SPAN_M}
              aria-valuenow={Number((n === 1 ? x1 : x2).toFixed(2))}
              aria-valuetext={`at ${fixed(n === 1 ? x1 : x2)} m, separation ${fixed(p.r)} m`}
              onPointerDown={onDown(n)}
              onPointerMove={onMove(n)}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onKey(n)}
              onFocus={() => onFocusTerm(n === 1 ? 'm1' : 'm2')}
              onBlur={() => onFocusTerm(null)}
            >
              <circle cx={x} cy={CY} r={Math.max(R + 14, 22)} fill="transparent" />
              <circle cx={x} cy={CY} r={R} fill={`url(#stip-${n === 1 ? 'lime' : 'ice'})`} mask="url(#shade-mask)" />
              <circle cx={x} cy={CY} r={R} fill="none" stroke={col} strokeWidth={strong ? 2.5 : 1.5} filter={effects ? 'url(#glow)' : undefined} />
              <circle cx={x} cy={CY} r={2} fill={col} />
              <circle className="focus-ring" cx={x} cy={CY} r={R + 7} fill="none" />
              <text x={x} y={CY + Math.max(R, 10) + 24} fill={col} fontFamily={MONO} fontSize={13} textAnchor="middle">
                {n === 1 ? '●' : '■'} m{n === 1 ? '₁' : '₂'} = {fixed(n === 1 ? p.m1 : p.m2, 0)} kg
              </text>
            </g>
          );
        })}

        {/* Force arrows: equal and opposite, each from its body's centre on its own row */}
        <g aria-hidden="true" pointerEvents="none">
          <g filter={arrowStrong ? glow : undefined}>
            <line x1={toPx(x1)} x2={toPx(x1) + L} y1={CY - 9} y2={CY - 9} stroke={C.text} strokeWidth={arrowStrong ? 3 : 2} markerEnd="url(#head)" />
            <line x1={toPx(x2)} x2={toPx(x2) - L} y1={CY + 9} y2={CY + 9} stroke={C.text} strokeWidth={arrowStrong ? 3 : 2} markerEnd="url(#head)" />
          </g>
          {Lref !== null && (
            <g stroke={C.dim} strokeWidth={1.5}>
              <line x1={toPx(x1) + Lref} x2={toPx(x1) + Lref} y1={CY - 17} y2={CY - 1} />
              <line x1={toPx(x2) - Lref} x2={toPx(x2) - Lref} y1={CY + 1} y2={CY + 17} />
            </g>
          )}
        </g>
        <text x={toPx(x1)} y={CY - Math.max(R1, 20) - 40} fill={C.text} fontFamily={MONO} fontSize={13} textAnchor="middle">◎ F on m₁ = {Ftext} →</text>
        <text x={toPx(x2)} y={CY - Math.max(R2, 20) - 18} fill={C.text} fontFamily={MONO} fontSize={13} textAnchor="middle">← F on m₂ = {Ftext}</text>
        {Lref !== null && <text x={VW - PAD} y={34} fill={C.dim} fontFamily={MONO} fontSize={12} textAnchor="end">| tick = pinned reference force</text>}

        {/* Scale note */}
        <text x={PAD} y={VH - 12} fill={C.dim} fontFamily={MONO} fontSize={12}>Spheres to scale · arrows on a log scale · drag a sphere or use arrow keys</text>
      </svg>
    </div>
  );
}
