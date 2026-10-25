import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { ModeSelector } from '../components/ModeSelector';
import { useMediaQuery, useOnScreen, useSimClock } from '../lib/clock';
import { LESSONS, sanitizeParams } from '../lib/lessons/registry';
import type { ConceptId, LearningMode, LessonSpec, Params, Prediction } from '../lib/lessons/types';
import { useSettings } from '../lib/settings';
import { revealEgg } from '../lib/eggs';
import { EquationStrip } from './EquationStrip';
import { FollowUpInput, type FollowUpReply } from './FollowUpInput';
import { Inspector, type Tab } from './Inspector';
import { SimulationStage } from './SimulationStage';

interface Props {
  lesson: LessonSpec;
  initialMode: LearningMode;
  initialParams: Params;
  onExit: () => void;
  onNew: () => void;
  onSwitch: (id: ConceptId) => void;
  onSave: (mode: LearningMode, params: Params) => void;
}

const RAIL_ICON: Record<ConceptId, string> = { 'wave-interference': 'wave', 'gravitational-attraction': 'gravity', 'gradient-descent': 'gradient' };

export function LessonWorkspace({ lesson, initialMode, initialParams, onExit, onNew, onSwitch, onSave }: Props) {
  const { reducedMotion, effects } = useSettings();
  const [mode, setMode] = useState<LearningMode>(initialMode);
  const [params, setParamsState] = useState<Params>(() => sanitizeParams(lesson, initialParams));
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const [consequence, setConsequence] = useState<string | null>(null);
  const [hoverTerm, setHoverTerm] = useState<string | null>(null);
  const [pinnedTerm, setPinnedTerm] = useState<string | null>(null);
  const focusedTerm = hoverTerm ?? pinnedTerm;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reference, setReference] = useState<Params | null>(null);
  const [playing, setPlaying] = useState(lesson.animated && !reducedMotion);
  const [speed, setSpeed] = useState(1);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const [halt, setHalt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('experiment');
  const [basicsStep, setBasicsStep] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reply, setReply] = useState<FollowUpReply | null>(null);
  const [beats, setBeats] = useState(false);
  const beatsTimer = useRef(0);
  useEffect(() => () => clearTimeout(beatsTimer.current), []);
  const isDrawer = useMediaQuery('(min-width: 720px) and (max-width: 1099px)');
  const isMobile = useMediaQuery('(max-width: 719px)');

  const frameRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(frameRef);
  const clock = useSimClock(playing, speed, onScreen);
  const ctx = { step };

  // Reduced motion: stop automatic playback; manual stepping remains.
  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  // Stepped lessons: derive the iteration from simulated time and stop at a halt condition.
  useEffect(() => {
    if (!lesson.stepRate) return;
    const rate = lesson.stepRate;
    return clock.subscribe(() => {
      const n = Math.floor(clock.t * rate + 1e-9);
      if (n === stepRef.current) return;
      for (let k = stepRef.current + 1; k <= n; k++) {
        const msg = lesson.halt?.(paramsRef.current, k);
        if (msg) {
          clock.t = k / rate;
          stepRef.current = k;
          setStep(k);
          setPlaying(false);
          setHalt(msg);
          return;
        }
      }
      stepRef.current = n;
      setStep(n);
    });
  }, [clock, lesson]);

  const resetTime = useCallback(() => {
    stepRef.current = 0;
    setStep(0);
    setHalt(lesson.halt?.(paramsRef.current, 0) ?? null);
    clock.set(0);
  }, [clock, lesson]);

  // A new trajectory starts whenever a stepped lesson's parameters change. Waves keep their phase in time.
  useEffect(() => {
    if (lesson.stepRate) resetTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.stepRate ? JSON.stringify(params) : null]);

  const tweenRef = useRef(0);
  const commitParams = useCallback(
    (patch: Params, announce = true) => {
      cancelAnimationFrame(tweenRef.current);
      const prev = paramsRef.current;
      const next = sanitizeParams(lesson, { ...prev, ...patch });
      paramsRef.current = next;
      setParamsState(next);
      if (announce) setConsequence(lesson.consequence(prev, next));
      return next;
    },
    [lesson],
  );

  // Smoothly interpolate to new values so cause and effect stay visible.
  const animateParams = useCallback(
    (patch: Params, ms = 700) => {
      cancelAnimationFrame(tweenRef.current);
      const from = { ...paramsRef.current };
      const target = sanitizeParams(lesson, { ...from, ...patch });
      if (reducedMotion || lesson.stepRate) return commitParams(target);
      const t0 = performance.now();
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - (1 - k) ** 3;
        if (k < 1) {
          const mid: Params = {};
          for (const key of Object.keys(target)) mid[key] = from[key] + (target[key] - from[key]) * e;
          paramsRef.current = mid;
          setParamsState(mid);
          tweenRef.current = requestAnimationFrame(frame);
        } else {
          paramsRef.current = from;
          commitParams(target);
        }
      };
      tweenRef.current = requestAnimationFrame(frame);
      return target;
    },
    [commitParams, lesson, reducedMotion],
  );
  useEffect(() => () => cancelAnimationFrame(tweenRef.current), []);

  const play = () => {
    if (halt) resetTime();
    setHalt(null);
    setPlaying(true);
  };
  const pause = () => {
    setPlaying(false);
    if (lesson.stepRate) clock.set(stepRef.current / lesson.stepRate);
  };
  const stepOnce = () => {
    setPlaying(false);
    if (lesson.stepRate) {
      if (halt) return;
      clock.set((stepRef.current + 1) / lesson.stepRate);
    } else clock.set(clock.t + lesson.stepSeconds(paramsRef.current));
  };
  const reset = () => {
    if (!lesson.animated) {
      commitParams(Object.fromEntries(lesson.params.map((p) => [p.id, p.default])));
      setReference(null);
      return;
    }
    resetTime();
  };

  const onPredictSetup = (q: Prediction) => {
    const next = commitParams(q.setup, false);
    setReference(next);
    setConsequence(null);
    if (lesson.stepRate) {
      setPlaying(false);
      resetTime();
    }
  };
  const onPredictReveal = (q: Prediction) => {
    if (Object.keys(q.reveal).length) animateParams(q.reveal, 900);
    if (lesson.stepRate) {
      resetTime();
      setHalt(null);
      setPlaying(true);
    } else if (lesson.animated && !reducedMotion) setPlaying(true);
  };

  const jumpToControl = (paramId: string) => {
    if (mode === 'quick') setMode('explore');
    if (mode === 'basics') setBasicsStep(2);
    else setTab('experiment');
    if (isDrawer) setDrawerOpen(true);
    requestAnimationFrame(() => document.getElementById(`range-${paramId}`)?.focus());
  };

  const runFollowUp = (raw: string) => {
    const text = raw.trim();
    if (!text) return setReply({ kind: 'hint', text: 'Type a question or pick one of the suggestions.' });
    if (lesson.id === 'wave-interference' && /^beats?\b/i.test(text)) {
      // Easter egg: briefly step outside the equal-frequency model to show beats.
      clearTimeout(beatsTimer.current);
      setBeats(true);
      if (!reducedMotion) setPlaying(true);
      beatsTimer.current = window.setTimeout(() => setBeats(false), 12000);
      revealEgg('beats', 'Unequal frequencies make the sum swell and fade: beats.');
      return setReply({
        kind: 'done',
        text: `Easter egg: for 12 s wave 2 runs at f + 0.25 Hz, so the sum swells and fades every 4 s (beats).${reducedMotion ? ' Press Play or Step to watch it.' : ''} The readouts still describe the equal-frequency lesson.`,
      });
    }
    if (/\b(simpl(er|e)|quick|short(er)?|summar|brief|tl;?dr)\b/i.test(text)) {
      setMode('quick');
      return setReply({ kind: 'done', text: 'Switched to Quick intuition. Your settings are unchanged.' });
    }
    if (/\b(basics|from scratch|step[- ]by[- ]step|more detail|background|beginner)\b/i.test(text)) {
      setMode('basics');
      setBasicsStep(0);
      return setReply({ kind: 'done', text: 'Switched to Build from basics. Your settings are unchanged.' });
    }
    const fu = lesson.followUps.find((f) => f.match.test(text));
    if (!fu) {
      return setReply({
        kind: 'unsupported',
        text: `This example lesson’s follow-up box runs its built-in actions: ${lesson.followUps.map((f) => `“${f.label}”`).join(', ')}. To explore a different idea, ask on the start page.`,
      });
    }
    const action = fu.run(paramsRef.current);
    if (action.pinReference) setReference(paramsRef.current);
    if (action.setParams) animateParams(action.setParams);
    if (action.highlight) setHighlight(action.highlight);
    setReply({ kind: 'done', text: action.message });
  };

  const changeMode = (m: LearningMode) => {
    setMode(m);
    if (m === 'basics') setBasicsStep(0);
  };

  const inspector = (
    <Inspector
      lesson={lesson}
      mode={mode}
      params={params}
      ctx={ctx}
      focusedTerm={focusedTerm}
      reference={reference}
      tab={tab}
      onTab={setTab}
      basicsStep={basicsStep}
      onBasicsStep={setBasicsStep}
      onParam={(id, v) => commitParams({ [id]: v })}
      onPreset={(p) => animateParams(p)}
      onFocusTerm={setHoverTerm}
      onPin={() => setReference(params)}
      onUnpin={() => setReference(null)}
      onExplore={() => {
        setMode('explore');
        setTab('experiment');
      }}
      onPredictSetup={onPredictSetup}
      onPredictReveal={onPredictReveal}
    />
  );

  const suggestions = lesson.followUps.slice(0, isMobile ? 2 : 3).map((f) => f.label);

  return (
    <div className={`workspace ${railOpen ? 'rail-open' : ''} ${isDrawer ? 'drawer-mode' : ''}`}>
      <nav className="rail" aria-label="Experiments">
        <button className="rail-btn" onClick={() => setRailOpen((o) => !o)} aria-expanded={railOpen} aria-label={railOpen ? 'Collapse experiment rail' : 'Expand experiment rail'}>
          <Icon name="rail" />
          <span className="rail-label">Collapse</span>
        </button>
        <button className="rail-btn" onClick={onNew} aria-label="New experiment">
          <Icon name="plus" />
          <span className="rail-label">New</span>
        </button>
        <span className="rail-rule" aria-hidden="true" />
        {LESSONS.map((l) => (
          <button key={l.id} className={`rail-btn ${l.id === lesson.id ? 'current' : ''}`} aria-current={l.id === lesson.id ? 'page' : undefined} onClick={() => l.id !== lesson.id && onSwitch(l.id)} aria-label={l.title} title={l.title}>
            <Icon name={RAIL_ICON[l.id]} />
            <span className="rail-label">{l.title}</span>
          </button>
        ))}
      </nav>

      <header className="ws-header">
        <button className="btn ghost back" onClick={onExit} aria-label="Back to start">
          <Icon name="back" size={16} /> <span>Start</span>
        </button>
        <div className="ws-title">
          <span className="instrument-label">{lesson.kicker} · <span className="demo-tag">Authored example</span></span>
          <h1>{lesson.title}</h1>
        </div>
        <ModeSelector value={mode} onChange={changeMode} compact name="ws-mode" />
        <div className="ws-actions">
          <button className="btn" onClick={() => onSave(mode, params)}>
            <Icon name="save" size={16} /> <span>Save</span>
          </button>
          {isDrawer && (
            <button className="btn" onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} aria-controls="inspector">
              <Icon name="panel" size={16} /> <span>{drawerOpen ? 'Hide panel' : 'Lesson panel'}</span>
            </button>
          )}
        </div>
      </header>

      <main className="ws-center" id="main">
        <SimulationStage
          lesson={lesson}
          frameRef={frameRef}
          playing={playing}
          speed={speed}
          halt={halt}
          onPlayPause={() => (playing ? pause() : play())}
          onStep={stepOnce}
          onReset={reset}
          onSpeed={setSpeed}
          renderer={{
            lesson,
            params,
            setParams: (patch) => commitParams(patch),
            clock,
            step,
            focusedTerm,
            onFocusTerm: setHoverTerm,
            highlight,
            reference,
            effects,
            reducedMotion,
            extras: beats ? { f2: params.f + 0.25 } : undefined,
          }}
        />
        <EquationStrip
          lesson={lesson}
          params={params}
          ctx={ctx}
          focused={focusedTerm}
          pinned={pinnedTerm}
          onHover={setHoverTerm}
          onTogglePin={(id) => setPinnedTerm((p) => (p === id ? null : id))}
          onJumpToControl={jumpToControl}
        />
        <section className="explain" aria-label="What this shows">
          <p className="explain-now"><span className="instrument-label">What this shows</span> {lesson.caption(params, ctx)}</p>
          <p className="explain-change" aria-live="polite">
            {consequence && consequence !== lesson.caption(params, ctx) && <><span className="instrument-label lime">Last change</span> {consequence}</>}
          </p>
        </section>
        {!isMobile && <FollowUpInput suggestions={suggestions} reply={reply} onSubmit={runFollowUp} />}
      </main>

      <aside
        id="inspector"
        className={`inspector frame ${drawerOpen ? 'open' : ''}`}
        aria-label="Lesson panel"
        {...(isDrawer && !drawerOpen ? { inert: '' as unknown as boolean } : {})}
      >
        <span className="reg tl" aria-hidden="true" />
        <span className="reg bl" aria-hidden="true" />
        {isDrawer && (
          <button className="icon-btn drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close panel">
            <Icon name="close" />
          </button>
        )}
        {inspector}
      </aside>
      {isDrawer && drawerOpen && <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      {isMobile && (
        <div className="mobile-followup">
          <FollowUpInput suggestions={suggestions} reply={reply} onSubmit={runFollowUp} />
        </div>
      )}
    </div>
  );
}
