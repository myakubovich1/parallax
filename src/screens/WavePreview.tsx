import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { useOnScreen, useSimClock } from '../lib/clock';
import { fixed } from '../lib/format';
import { waveLesson } from '../lib/lessons/wave';
import type { Params } from '../lib/lessons/types';
import { classify, phaseOffsetMeters, resultantAmplitude, type WaveParams } from '../lib/physics/wave';
import { useSettings } from '../lib/settings';
import WaveRenderer from '../renderers/WaveRenderer';

const KIND = { cancellation: 'Complete cancellation', constructive: 'Constructive', destructive: 'Destructive', partial: 'Partial' };

/** Entry-screen preview: the real wave model with only phase exposed. */
export function WavePreview({ onOpen }: { onOpen: (params: Params) => void }) {
  const { reducedMotion, effects } = useSettings();
  const [params, setParams] = useState<Params>({ A1: 1, A2: 1, f: 0.5, phi: 60 });
  const [playing, setPlaying] = useState(!reducedMotion);
  const [focus, setFocus] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const clock = useSimClock(playing && !reducedMotion, 1, useOnScreen(ref));
  const p = params as unknown as WaveParams;

  return (
    <div ref={ref} className="preview">
      <InstrumentFrame
        className="preview-frame"
        title={<><span className={`live-dot ${playing && !reducedMotion ? 'on' : ''}`} aria-hidden="true" />Live preview</>}
        meta="Wave interference · idealized 1D"
        reveal
      >
        <div className="stage-body preview-stage">
          <WaveRenderer
            lesson={waveLesson}
            params={params}
            setParams={(patch) => setParams((x) => ({ ...x, ...patch }))}
            clock={clock}
            step={0}
            focusedTerm={focus}
            onFocusTerm={setFocus}
            highlight="phase"
            reference={null}
            effects={effects}
            reducedMotion={reducedMotion}
            compact
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
              type="range"
              min={0}
              max={360}
              step={5}
              value={p.phi}
              aria-valuetext={`${fixed(p.phi, 0)} degrees`}
              onChange={(e) => setParams((x) => ({ ...x, phi: parseFloat(e.target.value) }))}
              onFocus={() => setFocus('phi')}
              onBlur={() => setFocus(null)}
              style={{ '--fill': `${(p.phi / 360) * 100}%` } as React.CSSProperties}
            />
          </div>
          <button className="btn primary" onClick={() => onOpen(params)}>
            Open full lesson <span aria-hidden="true">→</span>
          </button>
        </div>
        <dl className="dossier">
          <div><dt>Model</dt><dd>y = y₁ + y₂</dd></div>
          <div><dt>Wavelength</dt><dd>λ = 1.00 m · fixed</dd></div>
          <div><dt>Crest offset</dt><dd className="amber">{fixed(phaseOffsetMeters(p.phi))} m</dd></div>
          <div><dt>Sum amplitude</dt><dd>A<sub>R</sub> = {fixed(resultantAmplitude(p))}</dd></div>
          <div className="wide"><dt>State</dt><dd aria-live="polite">{KIND[classify(p)]}</dd></div>
        </dl>
      </InstrumentFrame>
    </div>
  );
}
