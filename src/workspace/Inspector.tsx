import { useId, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { MathText } from '../components/MathText';
import { TONE_GLYPH, type LearningMode, type LessonContext, type LessonSpec, type Params, type Prediction } from '../lib/lessons/types';
import { ParameterControl } from './ParameterControl';
import { PredictionChallenge } from './PredictionChallenge';

export type Tab = 'understand' | 'experiment' | 'challenge';
const TABS: { id: Tab; label: string }[] = [
  { id: 'understand', label: 'Understand' },
  { id: 'experiment', label: 'Experiment' },
  { id: 'challenge', label: 'Challenge' },
];
const BASICS_STEPS = ['Background', 'Understand the model', 'Try it yourself'];

interface Props {
  lesson: LessonSpec;
  mode: LearningMode;
  params: Params;
  ctx: LessonContext;
  focusedTerm: string | null;
  reference: Params | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  basicsStep: number;
  onBasicsStep: (n: number) => void;
  onParam: (id: string, v: number) => void;
  onPreset: (p: Params) => void;
  onFocusTerm: (id: string | null) => void;
  onPin: () => void;
  onUnpin: () => void;
  onExplore: () => void;
  onPredictSetup: (q: Prediction) => void;
  onPredictReveal: (q: Prediction) => void;
}

export function Inspector(props: Props) {
  const { lesson, mode, tab, onTab, basicsStep, onBasicsStep } = props;
  const tabsId = useId();

  if (mode === 'quick') {
    return (
      <div className="inspector-body">
        <section className="insp-section">
          <h2 className="insp-title">Quick intuition</h2>
          <p className="lead">{lesson.quick}</p>
          <Readouts {...props} only="emphasis" />
          <button className="btn primary wide" onClick={props.onExplore}>Explore this <span aria-hidden="true">→</span></button>
          <p className="muted small">Opens the controls and challenges. Your current settings are kept.</p>
        </section>
        <Assumptions lesson={lesson} />
      </div>
    );
  }

  if (mode === 'basics') {
    return (
      <div className="inspector-body">
        <nav className="steps" aria-label="Lesson steps">
          <ol>
            {BASICS_STEPS.map((s, i) => (
              <li key={s}>
                <button className={`step-btn ${i === basicsStep ? 'current' : ''} ${i < basicsStep ? 'done' : ''}`} aria-current={i === basicsStep ? 'step' : undefined} onClick={() => onBasicsStep(i)}>
                  <span className="step-n">{i < basicsStep ? '✓' : i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section className="insp-section reveal-sweep" key={basicsStep} aria-live="polite">
          <h2 className="insp-title">{BASICS_STEPS[basicsStep]}</h2>
          {basicsStep === 0 && lesson.basics.background.map((t, i) => <p key={i}>{t}</p>)}
          {basicsStep === 1 && (
            <>
              {lesson.basics.model.map((t, i) => <p key={i}>{t}</p>)}
              <TermList {...props} />
            </>
          )}
          {basicsStep === 2 && (
            <>
              <p className="lead">{lesson.basics.tryIt}</p>
              <ExperimentPanel {...props} />
              <h3 className="insp-sub">Predict</h3>
              <PredictionChallenge lesson={lesson} onSetup={props.onPredictSetup} onReveal={props.onPredictReveal} />
            </>
          )}
        </section>
        <div className="step-nav">
          <button className="btn" disabled={basicsStep === 0} onClick={() => onBasicsStep(basicsStep - 1)}>← Back</button>
          {basicsStep < 2 ? (
            <button className="btn primary" onClick={() => onBasicsStep(basicsStep + 1)}>Next: {BASICS_STEPS[basicsStep + 1]} →</button>
          ) : (
            <span className="muted small">Final step</span>
          )}
        </div>
        {basicsStep < 2 && <Assumptions lesson={lesson} />}
      </div>
    );
  }

  return (
    <div className="inspector-body">
      <div className="tabs" role="tablist" aria-label="Lesson panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`${tabsId}-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${tabsId}-${t.id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`tab ${tab === t.id ? 'selected' : ''}`}
            onClick={() => onTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (d) {
                const nt = TABS[(i + d + TABS.length) % TABS.length].id;
                onTab(nt);
                document.getElementById(`${tabsId}-${nt}`)?.focus();
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="insp-section reveal-sweep" key={tab}>
        {tab === 'understand' && (
          <>
            {lesson.understand.map((t, i) => <p key={i}>{t}</p>)}
            <TermList {...props} />
            <Assumptions lesson={lesson} />
          </>
        )}
        {tab === 'experiment' && (
          <>
            <p className="muted">{lesson.quick}</p>
            <ExperimentPanel {...props} />
          </>
        )}
        {tab === 'challenge' && <PredictionChallenge lesson={lesson} onSetup={props.onPredictSetup} onReveal={props.onPredictReveal} />}
      </div>
    </div>
  );
}

function ExperimentPanel(props: Props) {
  const { lesson, params, focusedTerm, onParam, onPreset, onFocusTerm, reference, onPin, onUnpin } = props;
  const note = lesson.constraintNote?.(params);
  return (
    <>
      <div className="presets" role="group" aria-label="Presets">
        {lesson.presets.map((p) => {
          const on = Object.entries(p.params).every(([k, v]) => Math.abs(params[k] - v) < 1e-9);
          return (
            <button key={p.id} className={`preset ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onPreset(p.params)}>
              <span className="preset-name">{p.label}</span>
              <span className="preset-note">{p.note}</span>
            </button>
          );
        })}
      </div>
      <div className="params">
        {lesson.params.map((def) => (
          <ParameterControl
            key={def.id}
            def={def}
            value={params[def.id]}
            tone={lesson.terms[def.term].tone}
            active={focusedTerm === def.term}
            onChange={(v) => onParam(def.id, v)}
            onFocusTerm={onFocusTerm}
          />
        ))}
      </div>
      {note && <p className="constraint-note" role="status"><Icon name="info" size={14} /> {note}</p>}
      <Readouts {...props} />
      {lesson.compare && (
        <div className="compare">
          {reference ? (
            <>
              <p className="compare-text"><span className="instrument-label">Compared with pinned</span><span className="mono"><MathText text={lesson.compare(params, reference)} /></span></p>
              <button className="btn small" onClick={onUnpin}>Clear reference</button>
            </>
          ) : (
            <button className="btn small" onClick={onPin}><Icon name="pin" size={14} /> Pin current values as reference</button>
          )}
        </div>
      )}
    </>
  );
}

function Readouts({ lesson, params, ctx, focusedTerm, only }: Props & { only?: 'emphasis' }) {
  const rows = lesson.readouts(params, ctx).filter((r) => (only ? r.emphasis : true));
  return (
    <dl className="readouts">
      {rows.map((r) => {
        const tone = r.term ? lesson.terms[r.term].tone : 'neutral';
        return (
          <div key={r.id} className={`readout tone-${tone} ${r.emphasis ? 'emphasis' : ''} ${r.term && focusedTerm === r.term ? 'active' : ''}`}>
            <dt>{r.term && <span className="term-glyph" aria-hidden="true">{TONE_GLYPH[tone]} </span>}<MathText text={r.label} /></dt>
            <dd>{r.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function TermList({ lesson, params, ctx, focusedTerm, onFocusTerm }: Props) {
  return (
    <ul className="term-list" aria-label="What each symbol means">
      {Object.values(lesson.terms).filter((t) => t.tone !== 'neutral' || t.value).map((t) => (
        <li key={t.id} className={`tone-${t.tone} ${focusedTerm === t.id ? 'active' : ''}`} onMouseEnter={() => onFocusTerm(t.id)} onMouseLeave={() => onFocusTerm(null)}>
          <span className="term-glyph" aria-hidden="true">{TONE_GLYPH[t.tone]}</span>
          <span className="term-sym"><MathText text={t.symbol} /></span>
          <span className="term-desc">
            <strong>{t.name}</strong>
            {t.value && <span className="mono"> · {t.value(params, ctx)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Assumptions({ lesson }: { lesson: LessonSpec }): ReactNode {
  return (
    <details className="assumptions">
      <summary>Model assumptions &amp; simplifications</summary>
      <ul>{lesson.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </details>
  );
}
