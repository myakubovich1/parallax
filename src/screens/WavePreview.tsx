import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { useOnScreen, useSimClock } from '../lib/clock';
import { fixed } from '../lib/format';
import type { Params } from '../lib/lessons/types';
import { WAVELENGTH_M, classify, phaseOffsetMeters, resultantAmplitude, yTotal, y1, y2, type WaveParams } from '../lib/physics/wave';
import { useSettings } from '../lib/settings';
import { BAYER, ObserverHead } from '../renderers/ObserverHead';
import { C } from '../renderers/palette';

const KIND = { cancellation: 'Complete cancellation', constructive: 'Constructive', destructive: 'Destructive', partial: 'Partial' };
const PRESETS = [
  { phi: 0, name: 'Constructive', note: '0°' },
  { phi: 90, name: 'Partial', note: '90°' },
  { phi: 180, name: 'Cancelled', note: '180°' },
];
const TWEEN_MS = 420;

/** Ordered-dither thumbnail of one preset: both sources as thin traces, the sum as dither density. */
function PresetThumb({ phi }: { phi: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 112, H = 48, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p: WaveParams = { A1: 1, A2: 1, f: 0.5, phi };
    const mid = H / 2, unit = H / 4.6, span = 2 * WAVELENGTH_M;
    // Sum as a dithered field between the axis and the curve.
    ctx.fillStyle = C.text;
    for (let cy = 0; cy < H / 3; cy++) for (let cx = 0; cx < W / 3; cx++) {
      const yv = yTotal(((cx * 3) / W) * span, 0, p);
      const py = cy * 3;
      const inside = yv >= 0 ? py <= mid && py >= mid - yv * unit : py >= mid && py <= mid - yv * unit;
      if (inside && BAYER[(cy % 4) * 4 + (cx % 4)] < 11) ctx.fillRect(cx * 3, py, 2, 2);
    }
    for (const [fn, col] of [[y1, C.lime], [y2, C.ice]] as const) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = 0; px <= W; px += 1) {
        const y = mid - fn((px / W) * span, 0, p) * unit;
        px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [phi]);
  return <canvas ref={ref} className="preset-thumb" aria-hidden="true" />;
}

/** Entry-screen preview: the real wave model with only phase exposed. */
export function WavePreview({ onOpen }: { onOpen: (params: Params) => void }) {
  const { reducedMotion, effects } = useSettings();
  const [params, setParams] = useState<Params>({ A1: 1, A2: 1, f: 0.5, phi: 60 });
  const [playing, setPlaying] = useState(!reducedMotion);
  const [focus, setFocus] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const tween = useRef(0);
  const clock = useSimClock(playing && !reducedMotion, 1, useOnScreen(ref));
  const p = params as unknown as WaveParams;

  const setPhi = (phi: number) => setParams((x) => ({ ...x, phi }));
  const stopTween = () => cancelAnimationFrame(tween.current);
  useEffect(() => stopTween, []);

  /** Presets animate the slider so the change reads as a cause, not a jump. */
  const goTo = (target: number) => {
    stopTween();
    const from = p.phi;
    if (reducedMotion || from === target) return setPhi(target);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / TWEEN_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setPhi(k < 1 ? Math.round((from + (target - from) * e) * 10) / 10 : target);
      if (k < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  };

  const serial = `SERIAL /λ${fixed(WAVELENGTH_M)} /f${fixed(p.f)} /φ${fixed(p.phi, 0)} · OBSERVER OU-01`;

  return (
    <div ref={ref} className="preview">
      <InstrumentFrame
        className="preview-frame"
        title={<><span className={`live-dot ${playing && !reducedMotion ? 'on' : ''}`} aria-hidden="true" />Live preview</>}
        meta={<span className="serial">{serial}</span>}
        reveal
      >
        <div className="stage-body preview-stage">
          <ObserverHead
            params={p}
            clock={clock}
            focus={focus}
            effects={effects}
            reducedMotion={reducedMotion}
            onPhase={(phi) => { stopTween(); setPhi(phi); }}
            sliderRef={sliderRef}
          />
        </div>
        <div className="preview-controls">
          <button className="btn icon-only" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause preview' : 'Play preview'} disabled={reducedMotion} title={reducedMotion ? 'Reduced motion is on' : undefined}>
            <Icon name={playing && !reducedMotion ? 'pause' : 'play'} size={16} />
          </button>
          <div className={`param tone-amber inline ${focus === 'phi' ? 'active' : ''}`}>
            <label htmlFor="preview-phi" className="param-label">
              <span className="term-glyph" aria-hidden="true">◆</span>
              <span className="param-sym">φ</span> Phase difference
              <span className="param-value mono">{fixed(p.phi, 0)}°</span>
            </label>
            <input
              id="preview-phi"
              ref={sliderRef}
              type="range"
              min={0}
              max={360}
              step={5}
              value={p.phi}
              aria-valuetext={`${fixed(p.phi, 0)} degrees`}
              onChange={(e) => { stopTween(); setPhi(parseFloat(e.target.value)); }}
              onFocus={() => setFocus('phi')}
              onBlur={() => setFocus(null)}
              style={{ '--fill': `${(p.phi / 360) * 100}%` } as React.CSSProperties}
            />
          </div>
          <button className="btn primary" onClick={() => onOpen(params)}>
            Open full lesson <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="preset-tiles" role="group" aria-label="Phase presets">
          {PRESETS.map((t) => {
            const on = Math.abs((((p.phi % 360) + 360) % 360) - t.phi) < 0.01;
            return (
              <button key={t.phi} className={`preset-tile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => goTo(t.phi)}>
                <span className="reg tl" aria-hidden="true" />
                <span className="reg br" aria-hidden="true" />
                <PresetThumb phi={t.phi} />
                <span className="preset-tile-label"><span>{t.name}</span> <span>· {t.note}</span></span>
              </button>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {KIND[classify(p)]}. Sum amplitude {fixed(resultantAmplitude(p))}, crest offset {fixed(phaseOffsetMeters(p.phi))} metres.
        </p>
      </InstrumentFrame>
    </div>
  );
}
