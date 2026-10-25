import { useEffect, useId, useState } from 'react';
import { Icon } from '../components/Icon';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { useSettings } from '../lib/settings';
import { formatValue, type Formula } from '../lib/catalog/formulas';
import type { Params } from '../lib/lessons/types';

export function CatalogStage({ formula: f, params: p }: { formula: Formula; params: Params }) {
  const animated =
    !['field', 'geometry', 'graph'].includes(f.scene) &&
    !(f.scene === 'spring' && f.id !== 'pendulum');
  const { reducedMotion } = useSettings();
  const [playing, setPlaying] = useState(!reducedMotion);
  const [phase, setPhase] = useState(0);
  const uid = useId().replace(/:/g, '');
  useEffect(() => {
    if (!playing || reducedMotion || !animated) return;
    let raf = 0,
      previous = 0;
    const frame = (now: number) => {
      if (previous)
        setPhase(
          (t) =>
            (t +
              ((now - previous) / 6000) *
                (f.scene === 'motion' && p.v !== undefined
                  ? Math.max(0.1, Math.abs(p.v) / 4)
                  : 1)) %
            1,
        );
      previous = now;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, reducedMotion, f.scene, p.v, animated]);
  const x = f.params[0],
    value = f.calculate(p),
    normalized = (p[x.id] - x.min) / (x.max - x.min),
    amplitude = f.id === 'harmonic' ? p.A / 3 : 1,
    cycles =
      f.id === 'photon'
        ? 1400 / p.lambda
        : f.id === 'doppler'
          ? (2 * 343) / (343 - p.vs)
          : f.id === 'wave-speed'
            ? 2 / p.lambda
            : f.id === 'period'
              ? p.f / 2
              : f.id === 'harmonic'
                ? p.omega
                : 2,
    wave = Array.from(
      { length: 121 },
      (_, i) =>
        `${i ? 'L' : 'M'}${80 + i * 3.6},${255 - 65 * Math.sin((i / 120) * Math.PI * 2 * cycles - phase * Math.PI * 2) * amplitude}`,
    ).join(' ');
  const points = Array.from({ length: 121 }, (_, i) => ({
    x: x.min + ((x.max - x.min) * i) / 120,
    y: f.calculate({ ...p, [x.id]: x.min + ((x.max - x.min) * i) / 120 }),
  }));
  const ys = points.map((pt) => pt.y).filter(Number.isFinite);
  let lo = Math.min(0, ...ys),
    hi = Math.max(0, ...ys);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const py = (y: number) => 375 - ((y - lo) / (hi - lo)) * 260;
  let chart = '',
    pen = false;
  for (const pt of points) {
    if (!Number.isFinite(pt.y)) {
      pen = false;
      continue;
    }
    chart += `${pen ? 'L' : 'M'}${640 + ((pt.x - x.min) / (x.max - x.min)) * 260},${py(pt.y)} `;
    pen = true;
  }
  const rings = (cx: number, cy: number) =>
    [35, 60, 90, 125, 165].map((r) => (
      <circle
        key={r}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--violet)"
        opacity={0.21 - r / 1400}
      />
    ));
  const volume = p.V ?? p.V2 ?? (f.id === 'charles' ? value : 15),
    piston = 350 - Math.min(1, volume / 30) * 180;
  const particles = Array.from({ length: 24 }, (_, i) => {
    const a = i * 2.39996 + phase * Math.PI * 2;
    return (
      <circle
        key={i}
        cx={290 + Math.cos(a) * Math.sqrt(i + 1) * 22}
        cy={
          (piston + 370) / 2 +
          Math.sin(a) * Math.sqrt((i + 1) / 24) * Math.max(2, (370 - piston) / 2 - 12)
        }
        r={2.5}
        fill={i % 2 ? 'var(--lime)' : 'var(--ice)'}
      />
    );
  });
  const arrow = (x1: number, y1: number, x2: number, y2: number, tone = 'var(--text)') => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={tone}
      strokeWidth="3"
      markerEnd={`url(#${uid}arrow)`}
    />
  );
  const projectileRange = f.id === 'projectile' ? f.calculate(p) : 0,
    projectileHeight =
      f.id === 'projectile'
        ? (p.v ** 2 * Math.sin((p.theta * Math.PI) / 180) ** 2) / (2 * 9.81)
        : 0;
  const massX = f.scene === 'spring' ? 252 + (p.x || 0) * 55 : 130 + phase * 300;
  return (
    <InstrumentFrame
      className="catalog-stage"
      title={
        <>
          <span className={`live-dot ${playing && !reducedMotion && animated ? 'on' : ''}`} />
          {f.title}
        </>
      }
      meta={`${f.category} · authored model`}
    >
      <div
        className="catalog-visual stage-body"
        tabIndex={0}
        aria-label="Experiment diagram and response curve; scroll horizontally on small screens"
      >
        <svg
          viewBox="0 0 960 470"
          role="img"
          aria-label={`${f.title}: ${f.output} ${formatValue(value)} ${f.unit}`}
        >
          <defs>
            <pattern id={`${uid}dots`} width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="var(--lime)" opacity=".7" />
            </pattern>
            <radialGradient id={`${uid}glow`}>
              <stop stopColor="var(--lime)" stopOpacity=".12" />
              <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
            </radialGradient>
            <marker
              id={`${uid}arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0 0L6 3L0 6" fill="none" stroke="var(--text)" strokeWidth="1" />
            </marker>
          </defs>
          <rect width="960" height="470" fill="#080e0b" />
          <circle cx="285" cy="255" r="220" fill={`url(#${uid}glow)`} />
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={60 + i * 46}
              y1="90"
              x2={60 + i * 46}
              y2="400"
              stroke="var(--rule)"
              opacity=".35"
            />
          ))}
          {[130, 200, 270, 340].map((y) => (
            <line key={y} x1="60" y1={y} x2="530" y2={y} stroke="var(--rule)" opacity=".25" />
          ))}
          <text x="60" y="48" className="catalog-svg-label">
            01 / {f.scene === 'graph' ? 'FUNCTION MODEL' : 'SCHEMATIC MODEL'}
          </text>
          <text x="640" y="48" className="catalog-svg-label">
            02 / RESPONSE CURVE
          </text>
          <line x1="585" x2="585" y1="25" y2="440" stroke="var(--rule)" />
          {f.scene === 'spring' && (
            <>
              <line x1="95" y1="170" x2="95" y2="330" stroke="var(--text-2)" strokeWidth="8" />
              <line
                x1="280"
                x2="280"
                y1="125"
                y2="370"
                stroke="var(--amber)"
                strokeDasharray="4 7"
                opacity=".6"
              />
              {f.id === 'pendulum' ? (
                <>
                  <path
                    d={`M280 130L${280 + Math.sin(phase * Math.PI * 2) * 80} 300`}
                    stroke="var(--text)"
                    strokeWidth="2"
                  />
                  <circle
                    cx={280 + Math.sin(phase * Math.PI * 2) * 80}
                    cy="300"
                    r="20"
                    fill={`url(#${uid}dots)`}
                    stroke="var(--lime)"
                  />
                </>
              ) : (
                <>
                  <path
                    d={`M95 250 ${Array.from({ length: 25 }, (_, i) => `L${100 + (i * (massX - 100)) / 24} ${i % 2 ? 265 : 235}`).join(' ')}`}
                    fill="none"
                    stroke="var(--lime)"
                    strokeWidth="3"
                  />
                  <rect
                    x={massX}
                    y="220"
                    width="55"
                    height="60"
                    fill={`url(#${uid}dots)`}
                    stroke="var(--lime)"
                  />
                  {p.x !== 0 && arrow(massX + 28, 190, 280, 190, 'var(--amber)')}
                </>
              )}
              <text x="280" y="410" textAnchor="middle" className="catalog-svg-label">
                {f.id === 'pendulum' ? 'SMALL-ANGLE OSCILLATION' : 'EQUILIBRIUM · x = 0'}
              </text>
            </>
          )}
          {f.scene === 'motion' && (
            <>
              <path
                d={
                  f.id === 'projectile'
                    ? `M90 330Q${90 + projectileRange * 2} ${330 - projectileHeight * 8} ${90 + projectileRange * 4} 330`
                    : 'M80 340H520'
                }
                fill="none"
                stroke="var(--violet)"
                strokeDasharray="4 7"
              />
              {f.id === 'potential' && (
                <line
                  x1="290"
                  y1="130"
                  x2="290"
                  y2="340"
                  stroke="var(--amber)"
                  strokeDasharray="4 6"
                />
              )}
              <circle
                cx={
                  f.id === 'potential'
                    ? 290
                    : f.id === 'projectile'
                      ? 90 + phase * projectileRange * 4
                      : f.id === 'newton'
                        ? 130 + phase ** 2 * 300
                        : p.v !== undefined && p.v < 0
                          ? 430 - phase * 300
                          : massX
                }
                cy={
                  f.id === 'projectile'
                    ? 330 - projectileHeight * 16 * phase * (1 - phase)
                    : f.id === 'potential'
                      ? 340 - (p.h / 20) * 200
                      : 310
                }
                r={14 + Math.min(12, p.m || 2)}
                fill={`url(#${uid}dots)`}
                stroke="var(--lime)"
                strokeWidth="2"
              />
              {f.id === 'work'
                ? arrow(
                    250,
                    245,
                    250 + 160 * Math.cos((p.theta * Math.PI) / 180),
                    245 - 160 * Math.sin((p.theta * Math.PI) / 180),
                    'var(--lime)',
                  )
                : f.id !== 'projectile' &&
                  arrow(190, 175, 260 + normalized * 180, 175, 'var(--lime)')}
              <text x="80" y="415" className="catalog-svg-label">
                {f.id === 'projectile'
                  ? 'PARABOLIC TRAJECTORY · NO AIR RESISTANCE'
                  : f.id === 'potential'
                    ? 'HEIGHT ABOVE REFERENCE LEVEL'
                    : f.id === 'work'
                      ? 'FORCE COMPONENT ALONG DISPLACEMENT'
                      : 'MOTION / ENERGY TRANSFER'}
              </text>
            </>
          )}
          {f.scene === 'orbit' && f.id !== 'torque' && (
            <>
              {rings(290, 250)}
              <circle cx="290" cy="250" r="15" fill={`url(#${uid}dots)`} stroke="var(--ice)" />
              <circle
                cx={290 + Math.cos(phase * Math.PI * 2) * 125}
                cy={250 + Math.sin(phase * Math.PI * 2) * 125}
                r="16"
                fill={`url(#${uid}dots)`}
                stroke="var(--lime)"
              />
              {arrow(
                290 + Math.cos(phase * Math.PI * 2) * 100,
                250 + Math.sin(phase * Math.PI * 2) * 100,
                290 + Math.cos(phase * Math.PI * 2) * 40,
                250 + Math.sin(phase * Math.PI * 2) * 40,
              )}
              <text x="290" y="435" textAnchor="middle" className="catalog-svg-label">
                ROTATION ABOUT A FIXED CENTRE
              </text>
            </>
          )}
          {f.id === 'torque' && (
            <>
              <line
                x1="130"
                y1="285"
                x2={160 + p.r * 100}
                y2="285"
                stroke="var(--ice)"
                strokeWidth="6"
              />
              <circle cx="130" cy="285" r="12" fill="var(--lime)" />
              {arrow(
                160 + p.r * 100,
                285,
                160 + p.r * 100 + 100 * Math.cos((p.theta * Math.PI) / 180),
                285 - 100 * Math.sin((p.theta * Math.PI) / 180),
                'var(--lime)',
              )}
              <text x="130" y="350" className="catalog-svg-label">
                PIVOT
              </text>
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                LEVER ARM × PERPENDICULAR FORCE
              </text>
            </>
          )}
          {f.scene === 'wave' && (
            <>
              <path d={wave} fill="none" stroke="var(--lime)" strokeWidth="2.5" />
              <path d={wave} fill="none" stroke="var(--lime)" strokeWidth="8" opacity=".07" />
              <circle
                cx="260"
                cy={
                  255 -
                  65 * Math.sin(0.4167 * Math.PI * 2 * cycles - phase * Math.PI * 2) * amplitude
                }
                r="5"
                fill="var(--ice)"
              />
              <text x="80" y="405" className="catalog-svg-label">
                OSCILLATION / WAVEFRONT SCHEMATIC
              </text>
            </>
          )}
          {f.scene === 'circuit' && (
            <>
              <path
                d="M120 210V150H265M335 150H475V345H120V270"
                stroke="var(--ice)"
                fill="none"
                strokeWidth="2"
              />
              {['capacitance', 'capacitor-energy', 'rc'].includes(f.id) ? (
                <path
                  d="M265 150h25M290 125v50M310 125v50M310 150h25"
                  fill="none"
                  stroke="var(--lime)"
                  strokeWidth="3"
                />
              ) : (
                <path
                  d="M265 150l8 -12 10 24 10 -24 10 24 10 -24 10 24 12 -12"
                  fill="none"
                  stroke="var(--lime)"
                  strokeWidth="2"
                />
              )}
              <path d="M95 220h50M105 260h30" stroke="var(--amber)" strokeWidth="4" />
              {[0, 1, 2, 3, 4].map((i) => (
                <circle
                  key={i}
                  opacity={f.id === 'rc' ? Math.max(0.05, value / 12) : 1}
                  cx={
                    140 +
                    (((f.id === 'capacitance' || f.id === 'capacitor-energy' ? 0 : phase) + i / 5) %
                      1) *
                      315
                  }
                  cy="345"
                  r="3"
                  fill="var(--lime)"
                />
              ))}
              <text x="300" y="110" textAnchor="middle" className="catalog-svg-label">
                {f.id.includes('capacit') || f.id === 'rc'
                  ? 'CAPACITOR / RESISTOR MODEL'
                  : 'ELECTRICAL ENERGY TRANSFER'}
              </text>
              <text x="300" y="410" textAnchor="middle" className="catalog-svg-label">
                IDEAL CIRCUIT · CONVENTIONAL CURRENT
              </text>
            </>
          )}
          {f.scene === 'field' && (
            <>
              {rings(210, 250)}
              <circle cx="210" cy="250" r="28" stroke="var(--lime)" fill={`url(#${uid}dots)`} />
              {f.id === 'coulomb' && (
                <>
                  {rings(430, 250)}
                  <circle cx="430" cy="250" r="20" fill={`url(#${uid}dots)`} stroke="var(--ice)" />
                  {value !== 0 && arrow(255, 195, value > 0 ? 155 : 375, 195)}
                  {value !== 0 && arrow(390, 310, value > 0 ? 490 : 270, 310)}
                </>
              )}
              {f.id !== 'coulomb' && value !== 0 &&
                [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const a = (i * Math.PI) / 4;
                  return (
                    <g key={i}>
                      {arrow(
                        210 + Math.cos(a) * (value < 0 ? 125 : 70),
                        250 + Math.sin(a) * (value < 0 ? 125 : 70),
                        210 + Math.cos(a) * (value < 0 ? 70 : 125),
                        250 + Math.sin(a) * (value < 0 ? 70 : 125),
                      )}
                    </g>
                  );
                })}
              <text x="290" y="430" textAnchor="middle" className="catalog-svg-label">
                {f.id === 'coulomb'
                  ? value === 0 ? 'ZERO CHARGE · NO FORCE' : value < 0
                    ? 'UNLIKE CHARGES · ATTRACTION'
                    : 'LIKE CHARGES · REPULSION'
                  : f.id === 'mass-energy' ? 'REST ENERGY · E = mc²' : 'RADIAL INVERSE-SQUARE FIELD'}
              </text>
            </>
          )}
          {f.scene === 'gas' && (
            <>
              <rect
                x="120"
                y="125"
                width="340"
                height="245"
                fill="var(--ice)"
                fillOpacity=".025"
                stroke="var(--ice)"
              />
              <line
                x1="120"
                y1={piston}
                x2="460"
                y2={piston}
                stroke="var(--lime)"
                strokeWidth="5"
              />
              {particles}
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                {['heat', 'cooling', 'expansion'].includes(f.id)
                  ? 'THERMAL RESPONSE · SCHEMATIC'
                  : 'MOLECULAR MOTION · IDEAL GAS'}
              </text>
            </>
          )}
          {f.scene === 'fluid' && f.id !== 'continuity' && (
            <>
              <path d="M130 135V365H450V135" fill="none" stroke="var(--ice)" strokeWidth="2" />
              <rect
                x="132"
                y={200 - normalized * 40}
                width="316"
                height={163 + normalized * 40}
                fill="var(--ice)"
                fillOpacity=".07"
              />
              <path
                d={wave}
                transform="translate(55,-25) scale(.7,1)"
                stroke="var(--ice)"
                strokeWidth="1"
                fill="none"
                opacity=".5"
              />
              <rect
                x="255"
                y="230"
                width="70"
                height="65"
                stroke="var(--lime)"
                fill={`url(#${uid}dots)`}
              />
              {arrow(290, 320, 290, 275, 'var(--lime)')}
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                FLUID VOLUME / FLOW SCHEMATIC
              </text>
            </>
          )}
          {f.id === 'continuity' && (
            <>
              <path
                d={`M90 ${250 - p.A1 * 4}H250L360 ${250 - p.A2 * 4}H510M90 ${250 + p.A1 * 4}H250L360 ${250 + p.A2 * 4}H510`}
                fill="none"
                stroke="var(--ice)"
                strokeWidth="3"
              />
              {arrow(120, 250, 200, 250, 'var(--lime)')}
              {arrow(370, 250, Math.min(520, 380 + value * 7), 250, 'var(--lime)')}
              <text x="140" y="130" className="catalog-svg-label">
                INLET / A₁
              </text>
              <text x="390" y="130" className="catalog-svg-label">
                OUTLET / A₂
              </text>
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                SAME VOLUME FLOW · A₁v₁ = A₂v₂
              </text>
            </>
          )}
          {f.id === 'snell' && (
            <>
              <rect x="70" y="250" width="460" height="140" fill="var(--ice)" fillOpacity=".06" />
              <path d="M70 250H530M300 100V390" stroke="var(--text-2)" strokeDasharray="4 6" />
              <path
                d={`M${300 - Math.sin((p.theta * Math.PI) / 180) * 155} ${250 - Math.cos((p.theta * Math.PI) / 180) * 155}L300 250L${300 + Math.sin(((Number.isFinite(value) ? value : p.theta) * Math.PI) / 180) * 155} ${250 + (Number.isFinite(value) ? 1 : -1) * Math.cos(((Number.isFinite(value) ? value : p.theta) * Math.PI) / 180) * 155}`}
                stroke="var(--lime)"
                strokeWidth="2.5"
                fill="none"
              />
              <text x="80" y="95" className="catalog-svg-label">
                INCIDENT MEDIUM / n₁
              </text>
              <text x="80" y="435" className="catalog-svg-label">
                {Number.isFinite(value) ? 'TRANSMITTED MEDIUM / n₂' : 'TOTAL INTERNAL REFLECTION'}
              </text>
            </>
          )}
          {f.id === 'lens' &&
            (() => {
              const scale = 400 / (p.u + value),
                lens = 80 + p.u * scale,
                h = (35 * value) / p.u;
              return (
                <>
                  <path d="M70 250H530" stroke="var(--text-2)" strokeDasharray="4 6" />
                  <line x1={lens} x2={lens} y1="120" y2="370" stroke="var(--ice)" strokeWidth="4" />
                  {arrow(80, 250, 80, 215, 'var(--lime)')}
                  {arrow(480, 250, 480, 250 + h, 'var(--ice)')}
                  <path
                    d={`M80 215H${lens}L480 ${250 + h}M80 215L480 ${250 + h}`}
                    stroke="var(--amber)"
                    fill="none"
                    strokeWidth="1.5"
                  />
                  <text x="80" y="410" className="catalog-svg-label">
                    OBJECT
                  </text>
                  <text x="475" y="410" textAnchor="end" className="catalog-svg-label">
                    REAL IMAGE
                  </text>
                </>
              );
            })()}
          {f.id === 'photon' && (
            <>
              <path
                d={wave}
                fill="none"
                stroke={`hsl(${270 - ((p.lambda - 380) / 370) * 270} 80% 70%)`}
                strokeWidth="3"
              />
              {arrow(350, 150, 470, 150)}
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                SHORTER WAVELENGTH → HIGHER PHOTON ENERGY
              </text>
            </>
          )}
          {f.scene === 'geometry' &&
            (f.id === 'circle' ? (
              <>
                <circle
                  cx="290"
                  cy="250"
                  r={35 + normalized * 115}
                  fill={`url(#${uid}dots)`}
                  stroke="var(--lime)"
                  strokeWidth="2"
                />
                {arrow(290, 250, 325 + normalized * 115, 250, 'var(--amber)')}
                <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                  RADIUS → AREA
                </text>
              </>
            ) : (
              <>
                <path
                  d={`M140 340L${140 + Math.min(300, (300 * p.a) / Math.max(p.a, p.b))} 340L140 ${340 - Math.min(210, (210 * p.b) / Math.max(p.a, p.b))}Z`}
                  fill={`url(#${uid}dots)`}
                  stroke="var(--lime)"
                  strokeWidth="2"
                />
                <path d="M140 322h18v18" stroke="var(--ice)" fill="none" />
                <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                  RIGHT TRIANGLE · a² + b² = c²
                </text>
              </>
            ))}
          {f.scene === 'graph' && (
            <>
              <path
                d={chart}
                transform="translate(-1027,-10) scale(1.73,1)"
                fill="none"
                stroke="var(--lime)"
                strokeWidth="3"
              />
              <text x="290" y="425" textAnchor="middle" className="catalog-svg-label">
                EXACT FUNCTION RESPONSE
              </text>
            </>
          )}
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                x1="640"
                x2="900"
                y1={115 + i * 65}
                y2={115 + i * 65}
                stroke="var(--rule)"
                opacity=".5"
              />
            </g>
          ))}
          <line x1="640" x2="900" y1="375" y2="375" stroke="var(--text-2)" />
          <line x1="640" x2="640" y1="105" y2="375" stroke="var(--text-2)" />
          <path d={chart} stroke="var(--lime)" strokeWidth="2" fill="none" />
          {Number.isFinite(value) && (
            <circle
              cx={640 + normalized * 260}
              cy={py(value)}
              r="5"
              fill="var(--ice)"
              stroke="var(--bg)"
              strokeWidth="2"
            />
          )}
          <text x="640" y="405" className="catalog-svg-label">
            {formatValue(x.min)}
          </text>
          <text x="900" y="405" textAnchor="end" className="catalog-svg-label">
            {formatValue(x.max)}
          </text>
          <text x="770" y="438" textAnchor="middle" className="catalog-svg-label">
            {x.symbol} {x.unit && `/ ${x.unit}`}
          </text>
          <text x="640" y="88" className="catalog-svg-label">
            {f.output} {f.unit && `/ ${f.unit}`}
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
        {f.id === 'quadratic-roots' && (
          <div>
            <span className="instrument-label">Negative-branch root</span>
            <strong>{formatValue((-p.b - Math.sqrt(p.b ** 2 - 4 * p.a * p.c)) / (2 * p.a))}</strong>
          </div>
        )}
        <p>
          Change a value below. The point tracks your setting; the curve holds other variables
          fixed.
        </p>
      </div>
      <div className="stage-controls">
        {animated && (
          <>
            <button
              className="btn icon-text"
              disabled={reducedMotion}
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing && !reducedMotion ? 'Pause animation' : 'Play animation'}
            >
              <Icon name={playing && !reducedMotion ? 'pause' : 'play'} size={16} />
              {playing && !reducedMotion ? 'Pause' : 'Play'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setPhase(0);
                setPlaying(false);
              }}
            >
              Reset animation
            </button>
          </>
        )}
        <span className="instrument-label">
          {animated ? 'Illustrative animation' : 'Static relationship model'} · numeric curve uses
          exact formula
        </span>
      </div>
    </InstrumentFrame>
  );
}
