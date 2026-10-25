import { useEffect, useMemo, useState } from 'react';
import { revealEgg } from '../lib/eggs';
import { useClockDraw } from '../lib/clock';
import { fixed, signed } from '../lib/format';
import { DISPLAY_BOUND, MINIMUM_W, loss, nextW, slope } from '../lib/physics/gradient';
import { C, MONO } from './palette';
import type { RendererProps } from './types';

const VW = 1000;
const VH = 470;
const X0 = 72, X1 = 976, Y0 = 34, Y1 = 350;
const W_MIN = MINIMUM_W - DISPLAY_BOUND, W_MAX = MINIMUM_W + DISPLAY_BOUND;
const L_MAX = 40;
const TRACK_Y = 412;
const X = (w: number) => X0 + ((w - W_MIN) / (W_MAX - W_MIN)) * (X1 - X0);
const Yraw = (L: number) => Y1 - (L / L_MAX) * (Y1 - Y0);
const Y = (L: number) => Yraw(Math.min(L, L_MAX));
const HIGH = '#ECFFB8';
const ease = (h: number) => (h < 0.5 ? 2 * h * h : 1 - (-2 * h + 2) ** 2 / 2);
const inView = (w: number) => w >= W_MIN && w <= W_MAX;

export default function GradientRenderer({ lesson, params, clock, step, focusedTerm: focus, highlight, effects, reducedMotion }: RendererProps) {
  const { eta, w0 } = params;
  const [t, setT] = useState(clock.t);
  useClockDraw(clock, () => setT(clock.t), []);
  // Rollercoaster egg: at η = 1 the factor 1 − 2η is −1, so the point bounces between mirror
  // positions forever. That is real behaviour; the cart just makes it memorable.
  const coaster = Math.abs(eta - 1) < 1e-9 && w0 !== MINIMUM_W;
  useEffect(() => {
    if (coaster && step >= 2) revealEgg('coaster', 'At η = 1 every step lands exactly as far on the other side. Wheee.');
  }, [coaster, step >= 2]);

  const ws = useMemo(() => {
    const out = [w0];
    for (let i = 0; i < step + 1; i++) out.push(nextW(out[out.length - 1], eta));
    return out;
  }, [w0, eta, step]);
  const wn = ws[step];
  const wNext = ws[step + 1];

  // Glide between iterates: hop during the first 60% of the step interval, then rest.
  const frac = Math.max(0, Math.min(1, t * (lesson.stepRate ?? 1) - step));
  const h = reducedMotion ? 0 : ease(Math.min(1, frac / 0.6));
  const visibleNext = inView(wNext);
  const pw = visibleNext ? wn + (wNext - wn) * h : wn;
  const pL = visibleNext ? loss(wn) + (loss(wNext) - loss(wn)) * h : loss(wn);
  const lift = visibleNext ? Math.sin(Math.PI * h) * Math.min(60, Math.abs(X(wNext) - X(wn)) * 0.25) : 0;
  const px = X(pw), py = Y(pL) - lift;

  const curve = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const w = W_MIN + ((W_MAX - W_MIN) * i) / 240;
      d += `${i ? 'L' : 'M'}${X(w).toFixed(1)} ${Math.max(-200, Yraw(loss(w))).toFixed(1)}`;
    }
    return d;
  }, []);

  const s = slope(wn);
  const tanDx = 1.6;
  const tangentStrong = highlight === 'tangent' || focus === 'grad';
  const stepStrong = highlight === 'step' || focus === 'eta' || focus === 'wnext';
  const minStrong = highlight === 'minimum' || focus === 'min';
  const glow = effects ? 'url(#g-glow)' : undefined;
  const clipped = loss(wn) > L_MAX;

  return (
    <div className="stage-svg">
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Loss curve L of w equals w minus 3 squared. Step ${step}: w = ${fixed(wn, 3)}, loss ${fixed(loss(wn), 3)}, slope ${fixed(s, 3)}. Learning rate ${fixed(eta)}.`}>
        <defs>
          <clipPath id="plot"><rect x={X0} y={Y0 - 4} width={X1 - X0} height={Y1 - Y0 + 4} /></clipPath>
          <pattern id="g-stip" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="1.2" height="1.2" fill={C.violet} fillOpacity="0.5" /></pattern>
          <filter id="g-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <marker id="g-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={C.violet} /></marker>
        </defs>

        {/* Axes and grid */}
        {[0, 10, 20, 30, 40].map((L) => (
          <g key={L}>
            <line x1={X0} x2={X1} y1={Y(L)} y2={Y(L)} stroke={C.violet} strokeOpacity={L === 0 ? 0.4 : 0.1} />
            <text x={X0 - 10} y={Y(L) + 4} fill={C.dim} fontFamily={MONO} fontSize={12} textAnchor="end">{L}</text>
          </g>
        ))}
        {Array.from({ length: 9 }, (_, i) => W_MIN + i * 3).map((w) => (
          <line key={w} x1={X(w)} x2={X(w)} y1={Y0} y2={Y1} stroke={C.violet} strokeOpacity={0.08} />
        ))}
        <text x={X0 - 10} y={Y0 - 14} fill={focus === 'L' ? C.text : C.dim} fontFamily={MONO} fontSize={12} textAnchor="end">◎ L(w)</text>

        {/* Loss curve with stippled area */}
        <g clipPath="url(#plot)">
          <path d={`${curve}L${X1} ${Y1}L${X0} ${Y1}Z`} fill="url(#g-stip)" opacity={0.5} />
          <path d={curve} fill="none" stroke={C.text} strokeWidth={focus === 'L' ? 2.5 : 1.75} filter={glow} />
        </g>

        {/* Minimum */}
        <g opacity={minStrong ? 1 : 0.7}>
          <line x1={X(MINIMUM_W)} x2={X(MINIMUM_W)} y1={Y1 - 18} y2={TRACK_Y + 8} stroke={C.text} strokeDasharray="2 3" />
          <path d={`M${X(MINIMUM_W) - 8} ${Y1}h16M${X(MINIMUM_W)} ${Y1 - 8}v16`} stroke={C.text} strokeWidth={minStrong ? 2 : 1} />
          <text x={X(MINIMUM_W)} y={TRACK_Y + 42} fill={C.text} fontFamily={MONO} fontSize={minStrong ? 14 : 12} textAnchor="middle">↑ minimum · L = 0 at w = 3</text>
        </g>

        {/* Trail of previous iterates */}
        <g clipPath="url(#plot)">
          {ws.slice(0, step + 1).map((w, i) => i > 0 && inView(w) && inView(ws[i - 1]) && (
            <path key={`h${i}`} d={`M${X(ws[i - 1])} ${Y(loss(ws[i - 1]))}Q${(X(ws[i - 1]) + X(w)) / 2} ${Math.min(Y(loss(ws[i - 1])), Y(loss(w))) - 40} ${X(w)} ${Y(loss(w))}`}
              fill="none" stroke={C.violet} strokeOpacity={0.35} strokeDasharray="3 3" />
          ))}
          {ws.slice(0, step + 1).map((w, i) => inView(w) && (
            <circle key={`d${i}`} cx={X(w)} cy={Y(loss(w))} r={i === 0 ? 4 : 2.5} fill={i === 0 ? 'none' : C.lime} stroke={i === 0 ? C.lime : 'none'} opacity={0.35 + 0.65 * ((i + 1) / (step + 1))} />
          ))}
        </g>
        {inView(w0) && <text x={X(w0)} y={Y(loss(w0)) - 12} fill={focus === 'w0' ? C.lime : C.dim} fontFamily={MONO} fontSize={12} textAnchor="middle">w₀</text>}

        {/* Tangent: the slope that sets the next step */}
        {inView(wn) && !clipped && (
          <g clipPath="url(#plot)" opacity={tangentStrong ? 1 : 0.7}>
            <line x1={X(wn - tanDx)} y1={Y(loss(wn) - tanDx * s)} x2={X(wn + tanDx)} y2={Y(loss(wn) + tanDx * s)} stroke={C.ice} strokeWidth={tangentStrong ? 2.5 : 1.5} filter={tangentStrong ? glow : undefined} />
          </g>
        )}
        {inView(wn) && !clipped && (
          <text x={X(wn + (s >= 0 ? tanDx : -tanDx)) + (s >= 0 ? 8 : -8)} y={Math.max(Y0 + 12, Yraw(loss(wn) + tanDx * Math.abs(s)) - 6)} fill={C.ice} fontFamily={MONO} fontSize={tangentStrong ? 14 : 12} textAnchor={s >= 0 ? 'start' : 'end'}>■ slope {signed(s, 2)}</text>
        )}

        {/* Current point */}
        {inView(pw) && !coaster && (
          <g filter={glow}>
            <circle cx={px} cy={Math.max(Y0, py)} r={focus === 'w' ? 9 : 7} fill={C.lime} />
            <circle cx={px} cy={Math.max(Y0, py)} r={14} fill="none" stroke={C.lime} strokeOpacity={0.4} />
          </g>
        )}
        {inView(pw) && coaster && (
          // Pixel cart riding the point; the rider's dot is still exactly at (w, L(w)).
          <g transform={`translate(${px} ${Math.max(Y0, py)})`} filter={glow} shapeRendering="crispEdges">
            <rect x={-14} y={-14} width={28} height={10} fill={C.bg} stroke={C.lime} strokeWidth={2} />
            <rect x={-10} y={-20} width={4} height={6} fill={C.lime} />
            <rect x={5} y={-24} width={6} height={6} fill={C.ice} />
            <rect x={-12} y={-4} width={6} height={6} fill={C.lime} />
            <rect x={6} y={-4} width={6} height={6} fill={C.lime} />
            <circle r={3} fill={HIGH} />
            <text x={18} y={-22} fill={C.amber} fontFamily="'VT323', monospace" fontSize={20}>wheee!</text>
          </g>
        )}
        {!inView(wn) && (
          <text x={wn < W_MIN ? X0 + 4 : X1 - 4} y={Y0 + 16} fill={C.lime} fontFamily={MONO} fontSize={13} textAnchor={wn < W_MIN ? 'start' : 'end'}>
            {wn < W_MIN ? '← ' : ''}w = {fixed(wn, 2)} is off the chart{wn > W_MAX ? ' →' : ''}
          </text>
        )}
        {clipped && inView(wn) &&<text x={X(wn)} y={Y0 + 16} fill={C.lime} fontFamily={MONO} fontSize={12} textAnchor="middle">↑ L = {fixed(loss(wn), 1)} (above chart)</text>}

        {/* w track: where each step lands */}
        <line x1={X0} x2={X1} y1={TRACK_Y} y2={TRACK_Y} stroke={C.violet} strokeOpacity={0.4} />
        {Array.from({ length: 9 }, (_, i) => W_MIN + i * 3).map((w) => (
          <g key={w}>
            <line x1={X(w)} x2={X(w)} y1={TRACK_Y - 4} y2={TRACK_Y + 4} stroke={C.violet} strokeOpacity={0.5} />
            <text x={X(w)} y={TRACK_Y + 22} fill={C.dim} fontFamily={MONO} fontSize={12} textAnchor="middle">{w}</text>
          </g>
        ))}
        <text x={X1} y={TRACK_Y + 42} fill={C.dim} fontFamily={MONO} fontSize={12} textAnchor="end">w · chart edge = display bound |w − 3| ≤ {DISPLAY_BOUND}</text>
        {ws.slice(0, step + 1).map((w, i) => inView(w) && <rect key={`t${i}`} x={X(w) - 1} y={TRACK_Y - 10} width={2} height={10} fill={C.lime} opacity={0.3 + 0.7 * ((i + 1) / (step + 1))} />)}
        {inView(wn) && (
          <g opacity={stepStrong ? 1 : 0.8}>
            <line x1={X(wn)} x2={X(Math.max(W_MIN, Math.min(W_MAX, wNext)))} y1={TRACK_Y - 18} y2={TRACK_Y - 18} stroke={C.violet} strokeWidth={stepStrong ? 2.5 : 1.5} markerEnd={Math.abs(wNext - wn) > 0.05 ? 'url(#g-head)' : undefined} filter={stepStrong ? glow : undefined} />
            <text x={(X(wn) + X(Math.max(W_MIN, Math.min(W_MAX, wNext)))) / 2} y={TRACK_Y - 28} fill={C.violet} fontFamily={MONO} fontSize={stepStrong ? 14 : 12} textAnchor="middle">▲ step −η·slope = {signed(wNext - wn, 2)}</text>
          </g>
        )}
        {focus === 'wnext' && inView(wNext) && <circle cx={X(wNext)} cy={Y(loss(wNext))} r={8} fill="none" stroke={C.violet} strokeDasharray="2 2" strokeWidth={1.5} />}
      </svg>
    </div>
  );
}
