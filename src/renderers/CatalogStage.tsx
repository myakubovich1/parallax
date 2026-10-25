import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { useSettings } from '../lib/settings';
import { useSimClock, useClockDraw, useOnScreen, usePageVisible } from '../lib/clock';
import { formatValue, type Formula } from '../lib/catalog/formulas';
import type { Params } from '../lib/lessons/types';
import { drawScene, ANIMATED } from './catalog/draw';
import { W, H } from './catalog/paint';

interface Props {
  formula: Formula;
  params: Params;
  reference?: Params | null;
  focused?: string | null;
  onParam?: (id: string, value: number) => void;
  interactionVersion?: number;
}
export function CatalogStage({
  formula: f,
  params: p,
  reference = null,
  focused = null,
  onParam,
  interactionVersion = 0,
}: Props) {
  const { reducedMotion, effects } = useSettings(),
    [playing, setPlaying] = useState(
      !reducedMotion && !['harmonic', 'rc', 'cooling'].includes(f.id),
    ),
    [speed, setSpeed] = useState(1),
    [graph, setGraph] = useState(false);
  const wrap = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ x: number; value: number } | null>(null);
  const animated = ANIMATED.has(f.id);
  const active = useOnScreen(wrap),
    visible = usePageVisible();
  const clock = useSimClock(playing && !reducedMotion && animated, speed, active);
  const previousInteraction = useRef(interactionVersion);
  useLayoutEffect(() => {
    if (previousInteraction.current === interactionVersion) return;
    previousInteraction.current = interactionVersion;
    setPlaying(false);
    clock.set(0);
  }, [interactionVersion, clock]);
  const first = f.params[0],
    value = f.calculate(p);
  const paramsRef = useRef(p);
  paramsRef.current = p;
  useEffect(() => {
    if (
      !['harmonic', 'rc', 'cooling'].includes(f.id) ||
      !playing ||
      reducedMotion ||
      !active ||
      !visible ||
      !onParam
    )
      return;
    const timer = setInterval(() => {
      const value = paramsRef.current[first.id] + 0.04 * speed;
      onParam(first.id, value > first.max ? first.min : value);
    }, 40);
    return () => clearInterval(timer);
  }, [
    f.id,
    playing,
    reducedMotion,
    onParam,
    first.id,
    first.min,
    first.max,
    speed,
    active,
    visible,
  ]);
  useEffect(() => {
    clock.set(0);
  }, [f.id, clock]);
  useClockDraw(clock, () => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== W * dpr || el.height !== H * dpr) {
      el.width = W * dpr;
      el.height = H * dpr;
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, { f, p, t: clock.t, reference, focused }, effects);
  }, [f, p, reference, focused, effects, graph]);
  const change = (n: number) =>
    onParam?.(
      first.id,
      Math.max(
        first.min,
        Math.min(first.max, Math.round((n - first.min) / first.step) * first.step + first.min),
      ),
    );
  const points = Array.from({ length: 201 }, (_, i) => {
      const x = first.min + ((first.max - first.min) * i) / 200;
      return { x, y: f.calculate({ ...p, [first.id]: x }) };
    }),
    ys = points.map((p) => p.y).filter(Number.isFinite);
  let lo = Math.min(0, ...ys),
    hi = Math.max(0, ...ys);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;
  const py = (v: number) => 415 - ((v - lo) / (hi - lo)) * 255;
  function curve(values: Params) {
    let d = '',
      pen = false;
    for (const pt of points) {
      const y = f.calculate({ ...values, [first.id]: pt.x });
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${130 + ((pt.x - first.min) / (first.max - first.min)) * 740},${py(y)} `;
      pen = true;
    }
    return d;
  }
  return (
    <InstrumentFrame
      className="catalog-stage catalog-stage-premium"
      title={
        <>
          <span className={`live-dot ${animated && playing && !reducedMotion ? 'on' : ''}`} />
          {f.title}
        </>
      }
      meta="Live demonstration"
      actions={
        <button className="btn small" aria-pressed={graph} onClick={() => setGraph((v) => !v)}>
          {graph ? 'Show demonstration' : 'Show response graph'}
        </button>
      }
    >
      <div ref={wrap} className={`catalog-visual stage-body ${graph ? 'is-graph' : ''}`}>
        <canvas
          ref={canvas}
          className="catalog-canvas"
          role="slider"
          aria-label={`Adjust ${first.label} in the demonstration`}
          tabIndex={0}
          aria-valuemin={first.min}
          aria-valuemax={first.max}
          aria-valuenow={p[first.id]}
          aria-valuetext={`${formatValue(p[first.id])} ${first.unit}`}
          style={{ display: graph ? 'none' : 'block', cursor: onParam ? 'ew-resize' : 'default' }}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              setPlaying(false);
              clock.set(0);
              change(
                e.key === 'Home'
                  ? first.min
                  : e.key === 'End'
                    ? first.max
                    : p[first.id] + (e.key === 'ArrowRight' ? 1 : -1) * first.step,
              );
            }
          }}
          onPointerDown={(e) => {
            if (!onParam) return;
            setPlaying(false);
            clock.set(0);
            drag.current = { x: e.clientX, value: p[first.id] };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            change(
              drag.current.value +
                ((e.clientX - drag.current.x) / Math.max(300, e.currentTarget.clientWidth)) *
                  (first.max - first.min),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        />
        <svg
          viewBox="0 0 1000 500"
          role="img"
          aria-label={`${f.title}: ${f.output} ${formatValue(value)} ${f.unit}`}
          style={{ display: graph ? 'block' : 'none' }}
        >
          <rect width="1000" height="500" fill="#080d0b" />
          <text x="70" y="80" className="catalog-svg-label">
            {f.output} / {f.unit || 'units'}
          </text>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                x1="130"
                x2="870"
                y1={160 + i * 63.75}
                y2={160 + i * 63.75}
                stroke="var(--rule)"
              />
              <text x="115" y={165 + i * 63.75} textAnchor="end" className="catalog-svg-label">
                {Number((hi - ((hi - lo) * i) / 4).toPrecision(3)).toString()}
              </text>
            </g>
          ))}
          <defs>
            <clipPath id="catalog-graph-clip">
              <rect x="130" y="150" width="740" height="265" />
            </clipPath>
          </defs>
          <path d="M130 150V415H880" fill="none" stroke="var(--text-2)" />
          <g clipPath="url(#catalog-graph-clip)">
            {reference && (
              <path d={curve(reference)} fill="none" stroke="var(--amber)" strokeDasharray="5 6" />
            )}
            <path d={curve(p)} fill="none" stroke="var(--lime)" strokeWidth="2.5" />
            {Number.isFinite(value) && (
              <circle
                cx={130 + ((p[first.id] - first.min) / (first.max - first.min)) * 740}
                cy={py(value)}
                r="6"
                fill="var(--ice)"
              />
            )}
          </g>
          <text x="130" y="445" className="catalog-svg-label">
            {formatValue(first.min)}
          </text>
          <text x="870" y="445" textAnchor="end" className="catalog-svg-label">
            {formatValue(first.max)}
          </text>
          <text x="500" y="495" textAnchor="middle" className="catalog-svg-label">
            {first.label} / {first.unit || 'units'}
          </text>
        </svg>
      </div>
      <div className="catalog-readout">
        <div>
          <span className="instrument-label">{f.output}</span>
          <strong>
            {formatValue(value)} <small>{f.unit}</small>
          </strong>
        </div>
        {reference && (
          <div>
            <span className="instrument-label">Pinned reference</span>
            <strong className="reference-number">
              {formatValue(f.calculate(reference))} <small>{f.unit}</small>
            </strong>
          </div>
        )}
        {f.id === 'quadratic-roots' && (
          <div>
            <span className="instrument-label">Negative-branch root</span>
            <strong>{formatValue((-p.b - Math.sqrt(p.b ** 2 - 4 * p.a * p.c)) / (2 * p.a))}</strong>
          </div>
        )}
      </div>
      <div className="stage-controls">
        {animated && (
          <>
            <button
              className="btn"
              disabled={reducedMotion}
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing && !reducedMotion ? 'Pause animation' : 'Play animation'}
            >
              <Icon name={playing && !reducedMotion ? 'pause' : 'play'} />
              {playing && !reducedMotion ? 'Pause' : 'Play'}
            </button>
            <button
              className="btn"
              onClick={() => {
                clock.set(0);
                setPlaying(false);
                if (['harmonic', 'rc', 'cooling'].includes(f.id)) onParam?.(first.id, first.min);
              }}
            >
              Reset animation
            </button>
            <label className="catalog-speed">
              Speed
              <select
                aria-label="Animation speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.25, 0.5, 1, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <span className="instrument-label">
          {animated && !playing ? 'Press Play to watch your settings' : 'Drag a slider to explore'}{' '}
          · drag the diagram or use arrow keys
        </span>
      </div>
    </InstrumentFrame>
  );
}
