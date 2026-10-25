import { useCallback, useEffect, useRef, useState } from 'react';
import { SavedDialog } from './components/SavedDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { TopBar } from './components/TopBar';
import { PhosphorBackground } from './components/PhosphorBackground';
import { GenerationError } from './lib/generation/adapter';
import { liveAdapter } from './lib/generation/liveAdapter';
import { GeneratedWorkspace } from './workspace/GeneratedWorkspace';
import { LESSON_BY_ID, defaultParams } from './lib/lessons/registry';
import type { ConceptId, GeneratedLessonSpec, LearningMode, LessonSpec, Params } from './lib/lessons/types';
import { loadSaved, writeSaved, type SavedExperiment } from './lib/storage';
import { EntryScreen, type GenState } from './screens/EntryScreen';
import { LessonWorkspace } from './workspace/LessonWorkspace';

type Screen = { kind: 'generated'; lesson: GeneratedLessonSpec; mode: LearningMode; params?: Params; key: number } | { kind: 'entry' } | { kind: 'lesson'; lesson: LessonSpec; mode: LearningMode; params: Params; key: number };

const adapter = liveAdapter;
/** Progress UI appears only if a request takes longer than this, so instant demo lookups don't flash. */
const PROGRESS_DELAY_MS = 150;

const isConcept = (id: string): id is ConceptId => id in LESSON_BY_ID;

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const id = location.hash.slice(1);
    return isConcept(id) ? { kind: 'lesson', lesson: LESSON_BY_ID[id], mode: 'explore', params: defaultParams(LESSON_BY_ID[id]), key: 0 } : { kind: 'entry' };
  });
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<LearningMode>('explore');
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState<GenState>({ status: 'idle' });
  const [saved, setSaved] = useState<SavedExperiment[]>(loadSaved);
  const [dialog, setDialog] = useState<'saved' | 'settings' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef(1);

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

  const create = useCallback(async () => {
    const text = prompt.trim();
    if (!text) {
      setError('Ask a question about the world, or pick one of the examples below.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGen({ status: 'running', stage: adapter.stages[0], visible: false, stages: adapter.stages });
    const reveal = setTimeout(() => setGen((g) => (g.status === 'running' ? { ...g, visible: true } : g)), PROGRESS_DELAY_MS);
    try {
      const res = await adapter.generate(
        { prompt: text, mode },
        { signal: ac.signal, onStage: (stage) => setGen((g) => (g.status === 'running' ? { ...g, stage } : g)) },
      );
      if (ac.signal.aborted) return;
      if (res.status === 'ready') {
        setGen({ status: 'idle' });
        openLesson(res.lesson.id, mode);
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
  }, [prompt, mode, openLesson]);

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

  return (
    <div className="app">
      <PhosphorBackground />
      <a className="skip" href="#main">Skip to content</a>
      <TopBar onHome={() => goEntry()} onNew={() => { setPrompt(''); setError(null); goEntry(true); }} onSaved={() => setDialog('saved')} onSettings={() => setDialog('settings')} savedCount={saved.length} docked={screen.kind !== 'entry'} />

      {screen.kind === 'entry' ? (
        <EntryScreen
          ref={inputRef}
          prompt={prompt}
          onPrompt={(v) => { setPrompt(v); if (error) setError(null); if (gen.status === 'unsupported' || gen.status === 'failed') setGen({ status: 'idle' }); }}
          mode={mode}
          onMode={setMode}
          error={error}
          gen={gen}
          onCreate={create}
          onCancel={cancel}
          onRetry={create}
          onOpenLesson={(id, params) => { setGen({ status: 'idle' }); openLesson(id, mode, params); }}
        />
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
        open={dialog === 'saved'}
        onClose={() => setDialog(null)}
        items={saved}
        onOpen={(e) => {
          setDialog(null);
          if (e.generatedLesson) {
            abortRef.current?.abort();
            setGen({ status: 'idle' });
            setScreen({ kind: 'generated', lesson: e.generatedLesson, mode: e.mode, params: e.params, key: keyRef.current++ });
            if (location.hash) history.pushState(null, '', location.pathname + location.search);
            window.scrollTo(0, 0);
          } else openLesson(e.conceptId, e.mode, e.params);
        }}
        onDelete={(id) => persist(saved.filter((s) => s.id !== id))}
      />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
