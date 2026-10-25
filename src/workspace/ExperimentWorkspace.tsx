import { useMemo, useState } from 'react';
import { evaluateLesson, parameterValues } from '../../server/lesson-engine.mjs';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { ModeSelector } from '../components/ModeSelector';
import { MathText } from '../components/MathText';
import { Icon } from '../components/Icon';
import type { ExperimentLesson, LearningMode, Params, TermTone } from '../lib/lessons/types';
import { ExperimentStage, quantity } from '../renderers/ExperimentStage';
import { CheckedCustomStage } from '../renderers/CheckedCustomStage';
import { ParameterControl } from './ParameterControl';

const TONES: TermTone[] = ['lime', 'ice', 'amber', 'violet'];
const STEPS = ['Background', 'Understand the model', 'Try it yourself'];
export function ExperimentWorkspace({
  lesson,
  initialParams,
  initialMode = 'explore',
  onExit,
  onSave,
}: {
  lesson: ExperimentLesson;
  initialParams?: Params;
  initialMode?: LearningMode;
  onExit: () => void;
  onSave: (params: Params, mode: LearningMode) => void;
}) {
  const defaults = useMemo(() => Object.fromEntries(lesson.params.map((p) => [p.id, p.default])), [lesson]);
  const [params, setParams] = useState<Params>(() =>
    Object.fromEntries(
      lesson.params.map((p) => [p.id, Math.max(p.min, Math.min(p.max, initialParams?.[p.id] ?? p.default))]),
    ),
  );
  const [reference, setReference] = useState<Params>(defaults);
  const [mode, setMode] = useState(initialMode);
  const [tab, setTab] = useState<'understand' | 'experiment' | 'challenge'>('experiment');
  const [step, setStep] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);
  const [graph, setGraph] = useState(false);
  const [status, setStatus] = useState(lesson.plan.interaction);
  const [question, setQuestion] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [customIssue, setCustomIssue] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const results = useMemo(() => evaluateLesson(lesson, params), [lesson, params]);
  const pinned = useMemo(() => evaluateLesson(lesson, reference), [lesson, reference]);
  const primary = lesson.outputs.find((o) => o.id === lesson.renderer.outputId)!;
  const input = lesson.params.find((p) => p.id === lesson.renderer.inputId)!;
  const inputRatio = reference[input.id] ? params[input.id] / reference[input.id] : null;
  const outputRatio = pinned[primary.id].si ? results[primary.id].si / pinned[primary.id].si : null;
  const term = [
    ...lesson.params.map((p, i) => ({
      id: p.id,
      symbol: p.symbol,
      name: p.label,
      meaning: p.hint,
      value: `${quantity(params[p.id], p.digits)} ${p.unit}`,
      role: 'Adjustable variable',
      tone: TONES[i],
    })),
    ...lesson.constants.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.label,
      meaning: c.meaning,
      value: `${quantity(c.value, 5)} ${c.unit}`,
      role: 'Fixed constant',
      tone: 'violet' as TermTone,
    })),
    ...lesson.outputs.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      name: o.label,
      meaning: o.meaning,
      value: `${quantity(results[o.id].value, o.digits)} ${o.displayUnit}`,
      role: 'Computed result',
      tone: 'ice' as TermTone,
    })),
  ].find((t) => t.id === focused);

  const apply = (next: Params, message: string) => {
    try {
      evaluateLesson(lesson, next);
      setParams(next);
      setStatus(message);
      setDomainError(null);
    } catch {
      setDomainError('That combination is outside this model’s domain. Your previous values are kept.');
    }
  };
  const change = (id: string, value: number) => {
    const p = lesson.params.find((p) => p.id === id)!;
    const next = { ...params, [id]: Math.max(p.min, Math.min(p.max, value)) };
    try {
      const before = results[primary.id],
        after = evaluateLesson(lesson, next)[primary.id];
      setChoice(null);
      setQuestion(false);
      apply(
        next,
        `${p.label}: ${quantity(params[id], p.digits)} → ${quantity(next[id], p.digits)} ${p.unit}. ${primary.label}: ${quantity(before.value, primary.digits)} → ${quantity(after.value, primary.digits)} ${after.unit}.`,
      );
    } catch {
      setDomainError('That value is outside this model’s domain. Your previous values are kept.');
    }
  };
  const startPrediction = () => {
    const setup = parameterValues(lesson, lesson.prediction.setup);
    setReference(setup);
    apply(setup, 'Make your prediction before revealing the change.');
    setChoice(null);
    setQuestion(true);
    setGraph(false);
  };
  const answer = (index: number) => {
    setChoice(index);
    apply(parameterValues(lesson, lesson.prediction.reveal), lesson.prediction.explanation);
  };
  const selectMode = (next: LearningMode) => {
    setMode(next);
    setQuestion(false);
    setChoice(null);
  };
  const showControls = (mode === 'explore' && tab === 'experiment') || (mode === 'basics' && step === 2);
  const showPrediction = (mode === 'explore' && tab === 'challenge') || (mode === 'basics' && step === 2);

  const prediction = (
    <section className="experiment-prediction" aria-label="Prediction challenge">
      <p className="instrument-label">Predict → experiment → explain</p>
      <h3>{lesson.prediction.question}</h3>
      {!question ? (
        <button className="btn primary" onClick={startPrediction}>
          Set up and predict
        </button>
      ) : (
        <>
          <p className="muted small">
            {input.label}: {quantity(lesson.prediction.setup[lesson.params.indexOf(input)])} →{' '}
            {quantity(lesson.prediction.reveal[lesson.params.indexOf(input)])} {input.unit}
          </p>
          <div className="prediction-options">
            {lesson.prediction.options.map((option, i) => (
              <button
                key={option}
                className={`btn prediction-option ${choice === i ? 'chosen' : ''}`}
                disabled={choice !== null}
                onClick={() => answer(i)}
              >
                {option}
              </button>
            ))}
          </div>
          {choice !== null && (
            <div
              className={`challenge-result ${choice === lesson.prediction.correctIndex ? 'right' : 'wrong'}`}
              role="status"
            >
              <strong>
                {choice === lesson.prediction.correctIndex
                  ? 'Your prediction matches.'
                  : 'Here’s what happened.'}
              </strong>
              <p>{lesson.prediction.explanation}</p>
              <p>
                {primary.label}: {quantity(pinned[primary.id].value, primary.digits)} →{' '}
                {quantity(results[primary.id].value, primary.digits)} {primary.displayUnit}
              </p>
              <button className="btn" onClick={startPrediction}>
                Try again
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <main id="main" className="generated-workspace experiment-workspace">
      <header className="experiment-heading">
        <div className="generated-toolbar">
          <button className="btn" onClick={onExit}>
            ← Back to start
          </button>
          <button className="btn primary" onClick={() => onSave(params, mode)}>
            <Icon name="save" size={16} /> Save experiment
          </button>
        </div>
        <div className="experiment-title-row">
          <div>
            <p className="instrument-label">Your interactive field guide</p>
            <h1>{lesson.title}</h1>
          </div>
          <ModeSelector compact value={mode} onChange={selectMode} name="generated-mode" />
        </div>
        <p className="experiment-takeaway">{lesson.plan.takeaway}</p>
        <p className="experiment-essential-limit">{lesson.assumptions[0]}</p>
      </header>
      <div className="experiment-grid">
        <div className="experiment-main">
          <InstrumentFrame
            title="Observe"
            meta={
              graph
                ? 'Graph · axes adapt to the current and reference inputs'
                : 'Change one thing. See what follows.'
            }
            className="experiment-stage-frame"
            actions={
              <div className="row">
                <button className="btn small" aria-pressed={!graph} onClick={() => setGraph(false)}>
                  Scene
                </button>
                <button className="btn small" aria-pressed={graph} onClick={() => setGraph(true)}>
                  Graph
                </button>
              </div>
            }
          >
            {lesson.renderer.kind === 'custom' && !graph && !customIssue ? (
              <CheckedCustomStage
                lesson={lesson}
                params={params}
                focused={focused}
                onIssue={setCustomIssue}
              />
            ) : (
              <ExperimentStage
                lesson={lesson}
                params={params}
                reference={reference}
                focused={focused}
                graph={graph}
              />
            )}
            {customIssue && (
              <p className="stage-quality-note" role="status">
                The custom scene couldn’t pass its display or numerical checks. Showing the shared quantity
                view. {customIssue}
              </p>
            )}
            <p className="experiment-stage-caption">{lesson.renderer.caption}</p>
            <div className="experiment-readouts">
              {lesson.outputs.map((o) => (
                <button
                  key={o.id}
                  className={`experiment-readout ${focused === o.id ? 'active' : ''}`}
                  onClick={() => setFocused(o.id)}
                  onFocus={() => setFocused(o.id)}
                >
                  <span>{o.label}</span>
                  <strong>
                    {quantity(results[o.id].value, o.digits)} <small>{o.displayUnit}</small>
                  </strong>
                  <span className="muted small">
                    Reference: {quantity(pinned[o.id].value, o.digits)} {o.displayUnit}
                  </span>
                </button>
              ))}
            </div>
          </InstrumentFrame>

          <InstrumentFrame
            title="Equation"
            meta="Select a symbol to trace it"
            className="experiment-equation"
          >
            <div className="experiment-equation-parts">
              {lesson.equationParts.map((part, i) =>
                part.termId ? (
                  <button
                    key={i}
                    className={`term ${focused === part.termId ? 'active' : ''}`}
                    aria-pressed={focused === part.termId}
                    onClick={() => setFocused(part.termId)}
                    onFocus={() => setFocused(part.termId)}
                    onMouseEnter={() => setFocused(part.termId)}
                  >
                    <MathText text={part.text} />
                  </button>
                ) : (
                  <span key={i}>
                    <MathText text={part.text} />
                  </span>
                ),
              )}
            </div>
            <div className="experiment-term" aria-live="polite">
              {term ? (
                <>
                  <span className={`instrument-label tone-${term.tone}`}>{term.role}</span>
                  <strong>
                    <MathText text={term.symbol} /> · {term.name} · {term.value}
                  </strong>
                  <p>{term.meaning}</p>
                  {lesson.params.some((p) => p.id === term.id) && (
                    <button
                      className="link-btn"
                      onClick={() => {
                        setMode('explore');
                        setTab('experiment');
                        requestAnimationFrame(() => document.getElementById(`range-${term.id}`)?.focus());
                      }}
                    >
                      Adjust this variable →
                    </button>
                  )}
                </>
              ) : (
                <p className="muted">
                  Select a symbol to see its meaning, unit, value, and connection to the picture.
                </p>
              )}
            </div>
          </InstrumentFrame>

          <InstrumentFrame title="What changed?" className="experiment-feedback">
            <p role="status">{status}</p>
            <p className="muted small">
              {inputRatio !== null && outputRatio !== null
                ? `Compared with your reference: ${input.label} × ${quantity(inputRatio)}; ${primary.label} × ${quantity(outputRatio)}.`
                : 'A zero reference is shown as an absolute comparison.'}
            </p>
            <div className="row">
              <button
                className="btn small"
                onClick={() => {
                  setReference({ ...params });
                  setStatus('Reference pinned. Change a variable to compare.');
                }}
              >
                Pin current values
              </button>
              <button
                className="btn small"
                onClick={() => {
                  setReference(defaults);
                  setQuestion(false);
                  setChoice(null);
                  apply(defaults, lesson.plan.interaction);
                }}
              >
                Reset values
              </button>
            </div>
          </InstrumentFrame>
        </div>

        <InstrumentFrame
          as="aside"
          title={
            mode === 'quick' ? 'Quick intuition' : mode === 'basics' ? 'Build from basics' : 'Your experiment'
          }
          className="experiment-inspector"
        >
          <div className="experiment-inspector-body">
            {mode === 'explore' && (
              <div className="tabs" role="tablist" aria-label="Lesson panels">
                {(['understand', 'experiment', 'challenge'] as const).map((id, i, tabs) => (
                  <button
                    key={id}
                    id={`experiment-tab-${id}`}
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls="experiment-panel"
                    tabIndex={tab === id ? 0 : -1}
                    className={`tab ${tab === id ? 'selected' : ''}`}
                    onClick={() => {
                      setTab(id);
                      setQuestion(false);
                      setChoice(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
                        setTab(next);
                        document.getElementById(`experiment-tab-${next}`)?.focus();
                      }
                    }}
                  >
                    {id[0].toUpperCase() + id.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <div
              id="experiment-panel"
              role={mode === 'explore' ? 'tabpanel' : undefined}
              aria-labelledby={mode === 'explore' ? `experiment-tab-${tab}` : undefined}
            >
              {mode === 'quick' && (
                <>
                  <p className="lead">{lesson.plan.takeaway}</p>
                  <p>{lesson.plan.observation}</p>
                  <button
                    className="btn primary"
                    onClick={() => {
                      const preset = lesson.presets[1];
                      setReference({ ...params });
                      apply(parameterValues(lesson, preset.values), preset.note);
                    }}
                  >
                    Try it: {lesson.presets[1].label}
                  </button>
                  <button className="link-btn" onClick={() => selectMode('explore')}>
                    Explore the full experiment →
                  </button>
                </>
              )}
              {mode === 'basics' && (
                <>
                  <nav className="steps" aria-label="Lesson steps">
                    <ol>
                      {STEPS.map((label, i) => (
                        <li key={label}>
                          <button
                            className={`step-btn ${i === step ? 'current' : ''}`}
                            aria-current={step === i ? 'step' : undefined}
                            onClick={() => setStep(i)}
                          >
                            <span className="step-n">{i + 1}</span>
                            {label}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </nav>
                  <h2>{STEPS[step]}</h2>
                  <p>{[lesson.basics.background, lesson.basics.model, lesson.basics.experiment][step]}</p>
                  {step < 2 && (
                    <button className="btn primary" onClick={() => setStep(step + 1)}>
                      Next: {STEPS[step + 1]} →
                    </button>
                  )}
                </>
              )}
              {mode === 'explore' && tab === 'understand' && (
                <>
                  <h2>The idea</h2>
                  <p>{lesson.plan.objective}</p>
                  {lesson.explanation.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                  <h3>A common misconception</h3>
                  <p>{lesson.plan.misconception}</p>
                </>
              )}
              {showControls && (
                <>
                  <p className="experiment-next-action">{lesson.plan.interaction}</p>
                  <div className="experiment-presets">
                    {lesson.presets.map((preset) => (
                      <button
                        key={preset.label}
                        className="btn"
                        onClick={() => {
                          setReference({ ...params });
                          setQuestion(false);
                          setChoice(null);
                          apply(parameterValues(lesson, preset.values), preset.note);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <fieldset className="experiment-parameters" disabled={question && choice === null}>
                    <legend className="sr-only">Adjust the variables</legend>
                    {lesson.params.map((p, i) => (
                      <ParameterControl
                        key={p.id}
                        def={{ ...p, term: p.id }}
                        value={params[p.id]}
                        tone={TONES[i]}
                        active={focused === p.id}
                        onChange={(value) => change(p.id, value)}
                        onFocusTerm={(id) => setFocused(id)}
                      />
                    ))}
                  </fieldset>
                  <p className="muted small">{lesson.plan.observation}</p>
                </>
              )}
              {showPrediction && prediction}
            </div>
            <details className="experiment-details">
              <summary>Assumptions & limitations</summary>
              <ul>
                {lesson.assumptions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
            <details className="experiment-details">
              <summary>How this was checked</summary>
              <p>
                Formula dimensions, unit conversion, parameter boundaries and {lesson.checks.length} numerical
                reference cases were checked. AI-written formulas, explanations and predictions can still be
                wrong.
              </p>
              <p>{lesson.plan.visualReason}</p>
            </details>
            {domainError && <p role="alert">{domainError}</p>}
          </div>
        </InstrumentFrame>
      </div>
    </main>
  );
}
