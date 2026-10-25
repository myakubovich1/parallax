import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SavedDialog } from './components/SavedDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { TopBar } from './components/TopBar';
import { HelpAssistant } from './components/HelpAssistant';
import { readGuideContext, type GuideAction } from './lib/help';
import { PhosphorBackground } from './components/PhosphorBackground';
import { EggCaption } from './components/EggCaption';
import { cueRobot, isMassEnergy, listenForKeyEggs, revealEgg, setOverdrive } from './lib/eggs';
import { GenerationError } from './lib/generation/adapter';
import { liveAdapter } from './lib/generation/liveAdapter';
import { CatalogWorkspace } from './workspace/CatalogWorkspace';
import { FORMULA_BY_ID } from './lib/catalog/formulas';
import { GeneratedWorkspace } from './workspace/GeneratedWorkspace';
import { LESSON_BY_ID, defaultParams } from './lib/lessons/registry';
import type { ConceptId, GeneratedLessonSpec, LearningMode, LessonSpec, Params } from './lib/lessons/types';
import { loadSaved, writeSaved, type SavedExperiment } from './lib/storage';
import { useSettings } from './lib/settings';
import { EntryScreen, type GenState } from './screens/EntryScreen';
import { LessonWorkspace } from './workspace/LessonWorkspace';

type Screen = { kind: 'preloaded'; id: string; mode: LearningMode; params?: Params; key: number } | { kind: 'generated'; lesson: GeneratedLessonSpec; mode: LearningMode; params?: Params; key: number } | { kind: 'entry' } | { kind: 'lesson'; lesson: LessonSpec; mode: LearningMode; params: Params; key: number };

const adapter = liveAdapter;
/** Progress UI appears only if a request takes longer than this, so instant demo lookups don't flash. */
const PROGRESS_DELAY_MS = 150;

const isConcept = (id: string): id is ConceptId => id in LESSON_BY_ID;

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const id = location.hash.slice(1);
    return isConcept(id) ? { kind: 'lesson', lesson: LESSON_BY_ID[id], mode: 'explore', params: defaultParams(LESSON_BY_ID[id]), key: 0 } : { kind: 'entry' };
  });
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<LearningMode>('explore');
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState<GenState>({ status: 'idle' });
  const [saved, setSaved] = useState<SavedExperiment[]>(loadSaved);
  const [dialog, setDialog] = useState<'saved' | 'settings' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpTrigger = useRef<HTMLElement | null>(null);
  const helpHighlight = useRef<{node: HTMLElement; timer: number} | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef(1);
  const { reducedMotion } = useSettings();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  useEffect(() => {
    if (gen.status === 'confirmation') document.getElementById('equation-review')?.focus();
  }, [gen.status]);

  // Key-sequence eggs: the Konami code, and typing "parallax" outside any field.
  useEffect(() => {
    let overdriveTimer = 0;
    let logoTimer = 0;
    const stop = listenForKeyEggs({
      konami: () => {
        setOverdrive(true);
        revealEgg('overdrive', 'Phosphor overdrive for 15 seconds. The dithertone poster, turned up to eleven.');
        clearTimeout(overdriveTimer);
        overdriveTimer = window.setTimeout(() => setOverdrive(false), 15000);
      },
      parallax: () => {
        document.documentElement.dataset.logoEgg = 'on';
        clearTimeout(logoTimer);
        logoTimer = window.setTimeout(() => delete document.documentElement.dataset.logoEgg, 1400);
        cueRobot('nod');
        revealEgg('logo', 'Two viewpoints, one point. That is the whole name.');
      },
    });
    return () => {
      stop();
      clearTimeout(overdriveTimer);
      clearTimeout(logoTimer);
      setOverdrive(false);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openLesson = useCallback((id: ConceptId, m: LearningMode, params?: Params) => {
    const lesson = LESSON_BY_ID[id];
    setScreen({ kind: 'lesson', lesson, mode: m, params: { ...defaultParams(lesson), ...params }, key: keyRef.current++ });
    if (location.hash !== `#${id}`) history.pushState({ lesson: id }, '', `#${id}`);
    window.scrollTo(0, 0);
  }, []);

  const goEntry = useCallback((focus = false) => {
    abortRef.current?.abort();
    setGen({ status: 'idle' });
    setScreen({ kind: 'entry' });
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
    if (focus) requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onPop = () => {
      const id = location.hash.slice(1);
      if (isConcept(id)) setScreen((s) => (s.kind === 'lesson' && s.lesson.id === id ? s : { kind: 'lesson', lesson: LESSON_BY_ID[id], mode: 'explore', params: defaultParams(LESSON_BY_ID[id]), key: keyRef.current++ }));
      else setScreen({ kind: 'entry' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const create = useCallback(async (confirmedText?: string) => {
    const text = (typeof confirmedText === 'string' ? confirmedText : prompt).trim();
    if (!text) {
      setError('Ask a question about the world, or pick one of the examples below.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (isMassEnergy(text) && screen.kind === 'entry') {
      // Everyone tries it first; give the moment a beat before the normal flow.
      cueRobot('classic');
      revealEgg('classic', 'E = mc². In SI units, c² ≈ 9 × 10¹⁶ m²/s², which is why a little mass is a lot of energy.');
      await new Promise((r) => setTimeout(r, reducedMotionRef.current ? 900 : 1700));
      if (ac.signal.aborted) return;
    }
    setGen({ status: 'running', stage: adapter.stages[0], visible: false, stages: adapter.stages });
    const reveal = setTimeout(() => setGen((g) => (g.status === 'running' ? { ...g, visible: true } : g)), PROGRESS_DELAY_MS);
    try {
      const res = await adapter.generate(
        { prompt: text, mode },
        { signal: ac.signal, confirmedInput: typeof confirmedText === 'string', onStage: (stage) => setGen((g) => (g.status === 'running' ? { ...g, stage } : g)) },
      );
      if (ac.signal.aborted) return;
      if (res.status === 'review') {
        if (res.review.kind === 'correction') setGen({ status: 'confirmation', review: res.review });
        else {
          setGen({ status: 'idle' });
          setError(res.review.message);
          inputRef.current?.focus();
        }
      } else if (res.status === 'ready') {
        setGen({ status: 'idle' });
        openLesson(res.lesson.id, mode);
      } else if (res.status === 'preloaded') {
        setGen({ status: 'idle' });
        setScreen({ kind: 'preloaded', id: res.id, mode, key: keyRef.current++ });
        if (location.hash) history.pushState(null, '', location.pathname + location.search);
        window.scrollTo(0, 0);
      } else if (res.status === 'generated') {
        setGen({ status: 'idle' });
        setScreen({ kind: 'generated', lesson: res.lesson, mode, key: keyRef.current++ });
        if (location.hash) history.pushState(null, '', location.pathname + location.search);
        window.scrollTo(0, 0);
      } else setGen({ status: 'unsupported', prompt: text });
    } catch (e) {
      if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        setGen({ status: 'idle' });
        return;
      }
      setGen({ status: 'failed', message: e instanceof GenerationError ? e.message : 'Something went wrong while preparing the lesson.' });
    } finally {
      clearTimeout(reveal);
    }
  }, [prompt, mode, openLesson, screen.kind]);

  const cancel = () => {
    abortRef.current?.abort();
    setGen({ status: 'idle' });
  };

  const persist = (list: SavedExperiment[]) => {
    const ok = writeSaved(list);
    if (ok) setSaved(list);
    return ok;
  };

  const save = (lesson: LessonSpec, m: LearningMode, params: Params) => {
    const entry: SavedExperiment = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, conceptId: lesson.id, title: lesson.title, mode: m, params, savedAt: Date.now() };
    const ok = persist([entry, ...saved].slice(0, 50));
    setToast(ok ? 'Saved to this browser. Find it in Saved experiments.' : 'Couldn’t save: this browser’s storage is unavailable.');
  };

  const getHelpContext = useCallback(() => readGuideContext(saved.length), [saved.length]);
  const openHelp = useCallback((trigger: HTMLElement) => {
    helpTrigger.current = trigger;
    setHelpOpen(true);
    requestAnimationFrame(() => document.getElementById('guide-question')?.focus());
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    requestAnimationFrame(() => {
      const trigger = helpTrigger.current;
      if (trigger?.isConnected) trigger.focus(); else document.querySelector<HTMLButtonElement>('.robot-help-trigger')?.focus();
    });
  }, []);
  useEffect(() => () => {
    if (helpHighlight.current) {clearTimeout(helpHighlight.current.timer); helpHighlight.current.node.classList.remove('guide-highlight');}
  }, []);
  const guideAction = (action: GuideAction) => {
    setHelpOpen(false);
    setDialog(null);
    if (action.type === 'fill-question') {
      goEntry(true); setPrompt(action.question); setError(null);
    } else if (action.type === 'open-library') {
      goEntry(true);
    } else if (action.type === 'open-saved') setDialog('saved');
    else if (action.type === 'open-settings') setDialog('settings');
    else requestAnimationFrame(() => {
      const context = readGuideContext(saved.length);
      const target = action.type === 'highlight-control' && context.controls.some(c => c.id === action.controlId) ? document.getElementById(action.controlId) : action.type === 'show-modes' ? document.querySelector<HTMLElement>('#main .mode-selector input:checked') : null;
      if (!target) {setToast('That control isn’t on this screen. Open its experiment and ask again.'); return;}
      if (helpHighlight.current) {clearTimeout(helpHighlight.current.timer); helpHighlight.current.node.classList.remove('guide-highlight');}
      target.scrollIntoView({block: 'center', behavior: 'instant'}); target.focus();
      const node = target.closest<HTMLElement>('.param, .catalog-param, .mode-selector') ?? target;
      node.classList.add('guide-highlight');
      helpHighlight.current = {node, timer: window.setTimeout(() => {node.classList.remove('guide-highlight'); helpHighlight.current = null;}, 3500)};
    });
  };

  return (
    <div className="app">
      <PhosphorBackground />
      <EggCaption />
      <a className="skip" href="#main">Skip to content</a>
      <TopBar onHome={() => goEntry()} onNew={() => { setPrompt(''); setError(null); goEntry(true); }} onSaved={() => setDialog('saved')} onSettings={() => setDialog('settings')} savedCount={saved.length} docked={screen.kind !== 'entry'} helpOpen={helpOpen} onHelp={openHelp} />

      {screen.kind === 'entry' ? (
        <EntryScreen
          onHelp={openHelp}
          ref={inputRef}
          prompt={prompt}
          onPrompt={(v) => { setPrompt(v); if (error) setError(null); if (gen.status === 'unsupported' || gen.status === 'failed' || gen.status === 'confirmation') setGen({ status: 'idle' }); }}
          mode={mode}
          onMode={setMode}
          error={error}
          gen={gen}
          onCreate={() => { if (gen.status !== 'confirmation') void create(); }}
          onCancel={cancel}
          onRetry={() => void create()}
          onConfirmInput={(text) => { setPrompt(text); void create(text); }}
          onEditInput={() => { setGen({ status: 'idle' }); inputRef.current?.focus(); }}
          onOpenLesson={(id, params) => { setGen({ status: 'idle' }); openLesson(id, mode, params); }}
        />
      ) : screen.kind === 'preloaded' ? (
        <CatalogWorkspace key={screen.key} formula={FORMULA_BY_ID[screen.id]} initialMode={screen.mode} initialParams={screen.params} onExit={() => goEntry()} onSave={(params, savedMode) => {
          const entry: SavedExperiment = { id: crypto.randomUUID(), formulaId: screen.id, title: FORMULA_BY_ID[screen.id].title, mode: savedMode, params, savedAt: Date.now() };
          const ok = persist([entry, ...saved].slice(0, 50));
          setToast(ok ? 'Saved to this browser. Find it in Saved experiments.' : 'Couldn’t save: browser storage is full or unavailable.');
        }}/>
      ) : screen.kind === 'generated' ? (
        <GeneratedWorkspace key={screen.key} lesson={screen.lesson} initialMode={screen.mode} initialParams={screen.params} onExit={() => goEntry()} onSave={(params, savedMode) => {
          const entry: SavedExperiment = { id: crypto.randomUUID(), generatedLesson: screen.lesson, title: screen.lesson.title, mode: savedMode, params, savedAt: Date.now() };
          const ok = persist([entry, ...saved].slice(0, 50));
          setToast(ok ? 'Saved to this browser. Find it in Saved experiments.' : 'Couldn’t save: browser storage is full or unavailable. Delete an older experiment and try again.');
        }} />
      ) : (
        <LessonWorkspace
          key={screen.key}
          lesson={screen.lesson}
          initialMode={screen.mode}
          initialParams={screen.params}
          onExit={() => goEntry()}
          onNew={() => { setPrompt(''); goEntry(true); }}
          onSwitch={(id) => openLesson(id, 'explore')}
          onSave={(m, p) => save(screen.lesson, m, p)}
        />
      )}

      <SavedDialog
        onHelp={openHelp}
        open={dialog === 'saved'}
        onClose={() => setDialog(null)}
        items={saved}
        onOpen={(e) => {
          setDialog(null);
          if (e.formulaId) {
            abortRef.current?.abort(); setGen({ status: 'idle' });
            setScreen({ kind: 'preloaded', id: e.formulaId, mode: e.mode, params: e.params, key: keyRef.current++ });
            if (location.hash) history.pushState(null, '', location.pathname + location.search);
            window.scrollTo(0, 0);
          } else if (e.generatedLesson) {
            abortRef.current?.abort();
            setGen({ status: 'idle' });
            setScreen({ kind: 'generated', lesson: e.generatedLesson, mode: e.mode, params: e.params, key: keyRef.current++ });
            if (location.hash) history.pushState(null, '', location.pathname + location.search);
            window.scrollTo(0, 0);
          } else if (e.conceptId) openLesson(e.conceptId, e.mode, e.params);
        }}
        onDelete={(id) => persist(saved.filter((s) => s.id !== id))}
      />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} onHelp={openHelp} />
      <HelpAssistant open={helpOpen} onClose={closeHelp} pageKey={`${screen.kind}:${'key' in screen ? screen.key : 0}:${dialog}:${gen.status}:${error ?? ''}`} getContext={getHelpContext} onAction={guideAction} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
