import { useEffect, useMemo, useState } from 'react';
import { evaluateLesson } from '../../server/lesson-engine.mjs';
import type { ExperimentLesson, Params } from '../lib/lessons/types';

export const quantity = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 'Outside domain';
  if (value === 0) return '0';
  return Math.abs(value) < 0.001 || Math.abs(value) >= 1e6
    ? value.toExponential(Math.min(digits, 4))
    : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
};

export function ExperimentStage({
  lesson,
  params,
  reference,
  focused,
  graph,
}: {
  lesson: ExperimentLesson;
  params: Params;
  reference: Params;
  focused: string | null;
  graph: boolean;
}) {
  // Compact and wide layouts are different elements, so observe whichever one is mounted.
  // The 40 px dead zone stops the two layouts (which differ in height) from flipping back and
  // forth when a scrollbar or sibling change nudges the width across a single threshold.
  const [node, ref] = useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCompact((c) => (c ? w < 540 : w < 500));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  const input = lesson.params.find((p) => p.id === lesson.renderer.inputId)!;
  const output = lesson.outputs.find((o) => o.id === lesson.renderer.outputId)!;
  const current = evaluateLesson(lesson, params)[output.id];
  const previous = evaluateLesson(lesson, reference)[output.id];
  const base = reference[input.id];
  const value = params[input.id];
  const points = useMemo(() => {
    const largest = Math.max(value, base, input.default);
    const end = Math.min(input.max, largest + Math.max(Math.abs(largest - input.min) * 0.5, input.step * 10));
    return Array.from({ length: 65 }, (_, i) => {
      const x = input.min + ((end - input.min) * i) / 64;
      try {
        return {
          x,
          y: evaluateLesson(lesson, { ...params, [input.id]: x })[output.id].value,
          referenceY: evaluateLesson(lesson, { ...reference, [input.id]: x })[output.id].value,
        };
      } catch {
        return { x, y: NaN, referenceY: NaN };
      }
    });
  }, [lesson, params, reference, input, output.id, value, base]);
  const ys = points.flatMap((p) => [p.y, p.referenceY]).filter(Number.isFinite);
  const minY = Math.min(0, ...ys),
    maxY = Math.max(0, ...ys);
  const span = maxY - minY || 1;
  const right = compact ? 330 : 550;
  const bottom = compact ? 260 : 280;
  const px = (x: number) => 70 + ((x - points[0].x) / (points.at(-1)!.x - points[0].x || 1)) * (right - 70);
  const py = (y: number) => bottom - ((y - minY) / span) * (bottom - 70);
  const scale = Math.max(Math.abs(current.value), Math.abs(previous.value), 1e-30);
  const active = (id: string) =>
    !focused || focused === id ? 'stage-quantity' : 'stage-quantity muted-quantity';
  const forceLength = Math.min(
    120,
    (120 * Math.abs(current.value)) / (Math.max(Math.abs(minY), Math.abs(maxY)) || 1),
  );
  const massX = 315 + ((value - input.min) / (input.max - input.min)) * 100;

  if (compact && !graph)
    return (
      <div ref={ref} className="experiment-visual compact-visual">
        <div className={active(input.id)}>
          <span className="instrument-label">You change</span>
          <strong>{input.label}</strong>
          <span className="compact-value">
            {quantity(value, input.digits)} {input.unit}
          </span>
        </div>
        {lesson.renderer.kind === 'spring' ? (
          <svg
            viewBox="0 0 360 130"
            role="img"
            aria-label="Schematic spring; arrow shows restoring force direction and magnitude"
          >
            <path d="M35 15V95" stroke="var(--text-2)" strokeWidth="4" />
            <path
              d={Array.from(
                { length: 22 },
                (_, i) =>
                  `${i ? 'L' : 'M'}${35 + (i * (170 + ((value - input.min) / (input.max - input.min)) * 80)) / 21},${i === 0 || i === 21 ? 55 : 55 + (i % 2 ? 14 : -14)}`,
              ).join(' ')}
              fill="none"
              stroke="var(--lime)"
              strokeWidth="3"
            />
            {current.si !== 0 && (
              <path
                d={`M240 105h${(current.si < 0 ? -1 : 1) * forceLength * 0.65}`}
                stroke="var(--ice)"
                strokeWidth="3"
                markerEnd="url(#compact-force-arrow)"
              />
            )}
            <defs>
              <marker
                id="compact-force-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 0L10 5L0 10" fill="var(--ice)" />
              </marker>
            </defs>
          </svg>
        ) : (
          <div className="compact-pixels" aria-hidden="true">
            {Array.from(
              {
                length:
                  value === 0
                    ? 0
                    : Math.min(40, Math.max(1, Math.round(8 + Math.abs(value / (base || 1)) * 8))),
              },
              (_, i) => (
                <i key={i} />
              ),
            )}
          </div>
        )}
        <div className={active(output.id)}>
          <span className="instrument-label">You observe</span>
          <strong>{output.label}</strong>
          <span className="compact-value">
            {quantity(current.value, output.digits)} {current.unit}
          </span>
          <div className="compact-meter" aria-hidden="true">
            <i style={{ width: `${(100 * Math.abs(current.value)) / scale}%` }} />
          </div>
          <div className="compact-meter reference-meter" aria-hidden="true">
            <i style={{ width: `${(100 * Math.abs(previous.value)) / scale}%` }} />
          </div>
          <span className="small">
            Reference: {quantity(previous.value, output.digits)} {previous.unit}
          </span>
        </div>
        <p className="muted small">Symbolic quantities; meters show magnitude.</p>
      </div>
    );

  return (
    <div ref={ref} className="experiment-visual">
      <svg
        viewBox={`0 0 ${compact ? 360 : 640} ${compact ? 340 : 360}`}
        role="img"
        aria-label={`${lesson.renderer.caption} ${input.label}: ${quantity(value)} ${input.unit}. ${output.label}: ${quantity(current.value, output.digits)} ${current.unit}.`}
      >
        <defs>
          <pattern id="experiment-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="2" height="2" fill="currentColor" opacity=".1" />
          </pattern>
          <marker
            id="force-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10" fill="var(--ice)" />
          </marker>
        </defs>
        <rect width={compact ? 360 : 640} height="360" fill="url(#experiment-dots)" />
        {graph ? (
          <g>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <path d={`M70 ${py(minY + span * t)}H${right}`} stroke="var(--rule)" />
                <text x="58" y={py(minY + span * t) + 5} textAnchor="end" fontSize="14">
                  {quantity(minY + span * t, 1)}
                </text>
              </g>
            ))}
            <path d={`M70 55V${bottom}H${right + 15}`} fill="none" stroke="var(--text-2)" />
            <path
              d={points
                .map((p, i) =>
                  Number.isFinite(p.referenceY)
                    ? `${i && Number.isFinite(points[i - 1].referenceY) ? 'L' : 'M'}${px(p.x)},${py(p.referenceY)}`
                    : '',
                )
                .join(' ')}
              fill="none"
              stroke="var(--amber)"
              strokeDasharray="5 4"
              strokeWidth="2"
            />
            <path
              d={points
                .map((p, i) =>
                  Number.isFinite(p.y)
                    ? `${i && Number.isFinite(points[i - 1].y) ? 'L' : 'M'}${px(p.x)},${py(p.y)}`
                    : '',
                )
                .join(' ')}
              fill="none"
              stroke="var(--ice)"
              strokeWidth="3"
              className={active(output.id)}
            />
            <circle
              cx={px(base)}
              cy={py(previous.value)}
              r="6"
              fill="none"
              stroke="var(--amber)"
              strokeWidth="2"
            />
            <circle cx={px(value)} cy={py(current.value)} r="7" fill="var(--lime)" />
            <text x="70" y={bottom + 24} fontSize="14">
              {quantity(points[0].x)}
            </text>
            <text x={right} y={bottom + 24} textAnchor="end" fontSize="14">
              {quantity(points.at(-1)!.x)}
            </text>
            <text x={compact ? 200 : 310} y={compact ? 320 : 337} textAnchor="middle" fontSize="16">
              {input.label.length > 20 ? input.symbol : input.label} ({input.unit || 'relative'})
            </text>
            <text x="70" y="32" fontSize="16">
              {output.label} ({current.unit || 'relative'})
            </text>
          </g>
        ) : lesson.renderer.kind === 'spring' ? (
          <g>
            <path d="M75 95V235 M75 160H95" stroke="var(--text-2)" strokeWidth="5" />
            <path
              d={Array.from(
                { length: 22 },
                (_, i) =>
                  `${i ? 'L' : 'M'}${95 + (i * (220 + ((value - input.min) / (input.max - input.min)) * 100)) / 21},${i === 0 || i === 21 ? 160 : 160 + (i % 2 ? 20 : -20)}`,
              ).join(' ')}
              fill="none"
              stroke="var(--lime)"
              strokeWidth="3"
              className={active(input.id)}
            />
            <rect
              x={315 + ((value - input.min) / (input.max - input.min)) * 100}
              y="130"
              width="60"
              height="60"
              fill="var(--lime-dim)"
              stroke="var(--lime)"
              className={active(input.id)}
            />
            {current.si !== 0 && (
              <path
                d={`M${massX + 30} 225h${current.si < 0 ? -forceLength : forceLength}`}
                stroke="var(--ice)"
                strokeWidth="4"
                markerEnd="url(#force-arrow)"
                className={active(output.id)}
              />
            )}
            <text x="320" y="55" textAnchor="middle" fontSize="19">
              {input.label}: {quantity(value)} {input.unit}
            </text>
            <text x="320" y="285" textAnchor="middle" fontSize="19" fill="var(--ice)">
              {output.label}: {quantity(current.value, output.digits)} {current.unit}
            </text>
            <text x="320" y="325" textAnchor="middle" fontSize="14">
              Schematic · displacement and force are scaled for visibility
            </text>
          </g>
        ) : (
          <g>
            <g className={active(input.id)}>
              <text x="65" y="68" fontSize="15">
                YOU CHANGE
              </text>
              <text x="65" y="102" fontSize="22" fill="var(--lime)">
                {input.label.length > 20 ? input.symbol : input.label}
              </text>
              <rect x="65" y="126" width="150" height="116" fill="var(--lime-dim)" stroke="var(--lime)" />
              {Array.from(
                {
                  length:
                    value === 0
                      ? 0
                      : Math.min(
                          40,
                          Math.max(1, Math.round(8 + Math.abs(value / (base || input.default || 1)) * 8)),
                        ),
                },
                (_, i) => (
                  <rect
                    key={i}
                    x={80 + (i % 8) * 15}
                    y={142 + Math.floor(i / 8) * 17}
                    width="8"
                    height="8"
                    fill="var(--lime)"
                    opacity=".8"
                  />
                ),
              )}
              <text x="140" y="278" textAnchor="middle" fontSize="23">
                {quantity(value, input.digits)} {input.unit}
              </text>
            </g>
            <path d="M245 181H298m-12-10 12 10-12 10" stroke="var(--text-2)" fill="none" strokeWidth="2" />
            <g className={active(output.id)}>
              <text x="330" y="68" fontSize="15">
                YOU OBSERVE
              </text>
              <text x="330" y="102" fontSize="22" fill="var(--ice)">
                {output.label.length > 20 ? output.symbol : output.label}
              </text>
              <rect x="330" y="132" width="240" height="28" fill="var(--raised)" />
              <rect
                x="330"
                y="132"
                width={(240 * Math.abs(current.value)) / scale}
                height="28"
                fill="var(--ice)"
              />
              <rect
                x="330"
                y="185"
                width={(240 * Math.abs(previous.value)) / scale}
                height="16"
                fill="none"
                stroke="var(--amber)"
                strokeDasharray="4 3"
              />
              <text x="330" y="230" fontSize="14" fill="var(--amber)">
                Reference: {quantity(previous.value, output.digits)} {previous.unit}
              </text>
              <text x="330" y="278" fontSize="23" fill="var(--ice)">
                {quantity(current.value, output.digits)} {current.unit}
              </text>
            </g>
            <text x="320" y="329" textAnchor="middle" fontSize="13">
              Symbolic quantities · bars show magnitude · outline is your reference
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
