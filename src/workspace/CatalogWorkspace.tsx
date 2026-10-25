import { useCallback, useMemo, useState } from 'react';
import { CatalogStage } from '../renderers/CatalogStage';
import { Icon } from '../components/Icon';
import { ModeSelector } from '../components/ModeSelector';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { MathText } from '../components/MathText';
import { displayEquation, symbol } from '../lib/catalog/display';
import { formatValue, type Formula } from '../lib/catalog/formulas';
import type { LearningMode, Params } from '../lib/lessons/types';

interface Props {
  formula: Formula;
  initialParams?: Params;
  initialMode: LearningMode;
  onExit: () => void;
  onSave: (params: Params, mode: LearningMode) => void;
}
export function CatalogWorkspace({
  formula: f,
  initialParams,
  initialMode,
  onExit,
  onSave,
}: Props) {
  const defaults = useMemo(() => Object.fromEntries(f.params.map((d) => [d.id, d.default])), [f]);
  const [params, setParams] = useState<Params>(() =>
      Object.fromEntries(
        f.params.map((d) => [
          d.id,
          Math.max(d.min, Math.min(d.max, initialParams?.[d.id] ?? d.default)),
        ]),
      ),
    ),
    [mode, setMode] = useState(initialMode),
    [focused, setFocused] = useState<string | null>(null),
    [reference, setReference] = useState<Params | null>(null),
    [tab, setTab] = useState<'controls' | 'prediction'>('controls'),
    [choice, setChoice] = useState<string | null>(null),
    [revealed, setRevealed] = useState(false),
    [interactionVersion, setInteractionVersion] = useState(0);
  const update = useCallback(
    (id: string, value: number) => setParams((p) => ({ ...p, [id]: value })),
    [],
  );
  const adjust = (id: string, value: number) => {
    setInteractionVersion((v) => v + 1);
    update(id, value);
  };
  const applyValues = (values: Params) => {
    setInteractionVersion((v) => v + 1);
    setParams(values);
  };
  const first = f.params[0],
    current = f.calculate(params),
    base = reference ?? defaults;
  const target = useMemo(
    () =>
      [first.max, first.min, first.min + (first.max - first.min) / 2]
        .map((value) => ({ ...base, [first.id]: value }))
        .find(
          (p) =>
            Number.isFinite(f.calculate(p)) &&
            Math.abs(f.calculate(p) - f.calculate(base)) >
              Math.max(1e-9, Math.abs(f.calculate(base)) * 1e-6),
        ),
    [base, f, first],
  );
  const correct = target ? (f.calculate(target) > f.calculate(base) ? 'higher' : 'lower') : 'same';
  const active = f.params.find((d) => d.id === focused);
  return (
    <main id="main" className="generated-workspace catalog-workspace">
      <header className="generated-toolbar">
        <button className="btn" onClick={onExit}>
          ← Back to start
        </button>
        <button className="btn primary" onClick={() => onSave(params, mode)}>
          <Icon name="save" size={16} />
          Save experiment
        </button>
      </header>
      <div className="catalog-heading">
        <div>
          <p className="instrument-label">{f.category} / Preloaded visual experiment</p>
          <h1>{f.title}</h1>
          <p className="catalog-takeaway">{f.explain}</p>
          <p className="catalog-limit">{f.assumptions[0]}</p>
        </div>
        <ModeSelector value={mode} onChange={setMode} compact name="catalog-mode" />
      </div>
      <div className="catalog-layout">
        <section className="catalog-main">
          <CatalogStage
            formula={f}
            params={params}
            reference={reference}
            focused={focused}
            onParam={update}
            interactionVersion={interactionVersion}
          />
          <InstrumentFrame
            title="The equation"
            meta="Select a symbol to locate its control"
            className="catalog-equation"
          >
            <p className="catalog-equation-text">
              <MathText text={displayEquation(f.id, f.equation)} />
            </p>
            <div className="catalog-term-buttons">
              {f.params.map((d, i) => (
                <button
                  className={`catalog-term ${focused === d.id ? 'active' : ''}`}
                  key={d.id}
                  onClick={() => {
                    setFocused(d.id);
                    document.getElementById(`generated-${d.id}`)?.focus();
                  }}
                >
                  <span
                    style={{
                      color: ['var(--lime)', 'var(--ice)', 'var(--amber)', 'var(--violet)'][i],
                    }}
                  >
                    <MathText text={symbol(d.symbol)} />
                  </span>
                  <span>{d.label}</span>
                  <span>
                    {formatValue(params[d.id])} {d.unit}
                  </span>
                </button>
              ))}
            </div>
            <p className="catalog-term-help">
              {active
                ? `${active.label}: ${active.hint}`
                : 'The colors link each adjustable variable to its measurement in the scene.'}
            </p>
          </InstrumentFrame>
          <div className="catalog-comparison frame">
            <div>
              <span className="instrument-label">Compare two states</span>
              <p>
                {reference
                  ? `Reference ${f.output.toLowerCase()}: ${formatValue(f.calculate(reference))} ${f.unit}. Current: ${formatValue(current)} ${f.unit}.`
                  : 'Pin a reference, then change one variable to see what the formula predicts.'}
              </p>
            </div>
            <button className="btn" onClick={() => setReference({ ...params })}>
              <Icon name="pin" size={16} />
              {reference ? 'Update reference' : 'Pin reference'}
            </button>
            {reference && (
              <button className="btn ghost" onClick={() => setReference(null)}>
                Clear
              </button>
            )}
          </div>
        </section>
        <aside className="catalog-inspector frame">
          <div className="catalog-tabs" role="tablist" aria-label="Experiment panel">
            <button
              role="tab"
              aria-selected={tab === 'controls'}
              onClick={() => setTab('controls')}
            >
              Experiment
            </button>
            <button
              role="tab"
              aria-selected={tab === 'prediction'}
              onClick={() => {
                setTab('prediction');
                setChoice(null);
                setRevealed(false);
              }}
            >
              Predict
            </button>
          </div>
          {tab === 'controls' ? (
            <div className="catalog-inspector-body">
              <p className="catalog-next-action">
                Start with {first.label.toLowerCase()}: drag its slider and watch{' '}
                {f.output.toLowerCase()} change.
              </p>
              <div className="catalog-presets">
                <button className="btn small" onClick={() => applyValues({ ...defaults })}>
                  Defaults
                </button>
                <button
                  className="btn small"
                  onClick={() => applyValues({ ...params, [first.id]: first.min })}
                >
                  {first.symbol} = {formatValue(first.min)}
                </button>
                <button
                  className="btn small"
                  onClick={() => applyValues({ ...params, [first.id]: first.max })}
                >
                  {first.symbol} = {formatValue(first.max)}
                </button>
              </div>
              {f.params.map((d, i) => (
                <label
                  key={d.id}
                  className={`catalog-control ${focused === d.id ? 'active' : ''}`}
                  style={
                    {
                      '--parameter-color': [
                        'var(--lime)',
                        'var(--ice)',
                        'var(--amber)',
                        'var(--violet)',
                      ][i],
                    } as React.CSSProperties
                  }
                  onMouseEnter={() => setFocused(d.id)}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.contains(document.activeElement)) setFocused(null);
                  }}
                >
                  <span className="catalog-control-heading">
                    <span>
                      <b>{symbol(d.symbol)}</b> {d.label}
                    </span>
                    <output>
                      {formatValue(params[d.id])} {d.unit}
                    </output>
                  </span>
                  <input
                    id={`generated-${d.id}`}
                    type="range"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={params[d.id]}
                    style={{ '--fill': `${((params[d.id] - d.min) / (d.max - d.min)) * 100}%` } as React.CSSProperties}
                    onChange={(e) => adjust(d.id, Number(e.target.value))}
                    onFocus={() => setFocused(d.id)}
                    onBlur={() => setFocused(null)}
                    aria-label={d.label}
                  />
                  <span className="catalog-range">
                    <span>{formatValue(d.min)}</span>
                    <span>
                      {formatValue(d.max)} {d.unit}
                    </span>
                  </span>
                  <span className="small muted">{d.hint}</span>
                </label>
              ))}
              <button
                className="btn"
                onClick={() => {
                  applyValues({ ...defaults });
                  setReference(null);
                }}
              >
                Reset values
              </button>
              {mode === 'basics' && (
                <section className="catalog-basics">
                  <h2>Build the idea</h2>
                  <ol>
                    <li>
                      Read the units beside each control. These are the quantities used in the
                      calculation.
                    </li>
                    <li>{f.explain}</li>
                    <li>
                      Pin the reference, change {first.label.toLowerCase()}, and compare the exact
                      result with the demonstration.
                    </li>
                  </ol>
                </section>
              )}
              <details className="catalog-assumptions">
                <summary>Model &amp; visual limits</summary>
                <ul>
                  {f.assumptions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  <li>
                    Scenes are authored explanations. Diagram sizes, particle counts, and playback
                    speed may be rescaled for visibility. Readouts use the displayed formula and
                    units.
                  </li>
                </ul>
              </details>
            </div>
          ) : (
            <div className="catalog-inspector-body catalog-prediction">
              {target ? (
                <>
                  <p className="instrument-label">Before you move the slider</p>
                  <h2>What changes?</h2>
                  <p>
                    Starting from the {reference ? 'pinned' : 'default'} reference, set{' '}
                    {first.label.toLowerCase()} to{' '}
                    <strong>
                      {formatValue(target[first.id])} {first.unit}
                    </strong>
                    . Will {f.output.toLowerCase()} be higher or lower?
                  </p>
                  <div className="prediction-options">
                    {['higher', 'lower', 'same'].map((c) => (
                      <button
                        key={c}
                        className={`btn ${choice === c ? 'chosen' : ''}`}
                        onClick={() => setChoice(c)}
                      >
                        {c === 'same' ? 'Stay the same' : c[0].toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                  {choice && (
                    <p role="status">
                      {choice === correct ? 'Correct.' : 'Try the model and compare.'}{' '}
                      {choice === correct || revealed ? f.explain : ''}
                    </p>
                  )}
                  <button
                    className="btn primary"
                    onClick={() => {
                      setReference({ ...base });
                      applyValues(target);
                      setRevealed(true);
                    }}
                  >
                    Reveal in the scene
                  </button>
                  {revealed && (
                    <p className="catalog-prediction-result">
                      {formatValue(f.calculate(base))} → {formatValue(f.calculate(target))} {f.unit}
                    </p>
                  )}
                </>
              ) : (
                <p>Set a finite reference with a nonzero response before making a comparison.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
