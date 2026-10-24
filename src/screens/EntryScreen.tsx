import { forwardRef } from 'react';
import { ConceptInput } from '../components/ConceptInput';
import { Icon } from '../components/Icon';
import { ModeSelector } from '../components/ModeSelector';
import { STAGE_LABEL, type GenerationStage } from '../lib/generation/adapter';
import { LESSONS } from '../lib/lessons/registry';
import type { ConceptId, LearningMode, Params } from '../lib/lessons/types';
import { WavePreview } from './WavePreview';

export type GenState =
  | { status: 'idle' }
  | { status: 'running'; stage: GenerationStage; visible: boolean; stages: GenerationStage[] }
  | { status: 'failed'; message: string }
  | { status: 'unsupported'; prompt: string };

interface Props {
  prompt: string;
  onPrompt: (v: string) => void;
  mode: LearningMode;
  onMode: (m: LearningMode) => void;
  error: string | null;
  gen: GenState;
  onCreate: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpenLesson: (id: ConceptId, params?: Params) => void;
}

const EXAMPLES: { id: ConceptId; label: string }[] = [
  { id: 'wave-interference', label: 'Wave interference' },
  { id: 'gravitational-attraction', label: 'Gravitational attraction' },
  { id: 'gradient-descent', label: 'Gradient descent' },
];

export const EntryScreen = forwardRef<HTMLTextAreaElement, Props>(function EntryScreen(props, inputRef) {
  const { prompt, onPrompt, mode, onMode, error, gen, onCreate, onCancel, onRetry, onOpenLesson } = props;
  const running = gen.status === 'running';
  return (
    <main className="entry" id="main">
      <div className="entry-grid">
        <section className="entry-left" aria-labelledby="entry-title">
          <p className="instrument-label kicker"><span className="live-dot on" aria-hidden="true" /> Demo mode · three authored lessons</p>
          <h1 id="entry-title">See what the equation means.</h1>
          <p className="entry-copy">Bring a formula or a question. Explore the idea behind it.</p>

          <form className="entry-form" onSubmit={(e) => { e.preventDefault(); onCreate(); }} noValidate>
            <ConceptInput ref={inputRef} value={prompt} onChange={onPrompt} onSubmit={onCreate} error={error} disabled={running} />
            <div className="examples">
              <span className="instrument-label">Try</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.id} type="button" className="chip" onClick={() => onPrompt(LESSONS.find((l) => l.id === ex.id)!.examplePrompt)}>
                  {ex.label}
                </button>
              ))}
            </div>
            <ModeSelector value={mode} onChange={onMode} />
            <div className="create-row">
              <button type="submit" className="btn primary large" disabled={running}>
                Create experiment <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          <GenerationStatus gen={gen} onCancel={onCancel} onRetry={onRetry} onOpenLesson={onOpenLesson} />
        </section>

        <section className="entry-right" aria-label="Live preview: wave interference">
          <WavePreview onOpen={(params) => onOpenLesson('wave-interference', params)} />
        </section>
      </div>
      <footer className="entry-foot">
        <span className="instrument-label">Parallax</span>
        <span>Turn ideas into intuition.</span>
        <span className="muted small">Lessons here are authored demos, not live AI generations.</span>
      </footer>
    </main>
  );
});

function GenerationStatus({ gen, onCancel, onRetry, onOpenLesson }: Pick<Props, 'gen' | 'onCancel' | 'onRetry' | 'onOpenLesson'>) {
  if (gen.status === 'idle' || (gen.status === 'running' && !gen.visible)) return <div className="gen-status" aria-live="polite" />;
  if (gen.status === 'running') {
    const at = gen.stages.indexOf(gen.stage);
    return (
      <div className="gen-status frame running" aria-live="polite">
        <span className="reg tl" aria-hidden="true" />
        <span className="reg br" aria-hidden="true" />
        <p className="instrument-label">Preparing your experiment</p>
        <ol className="gen-stages">
          {gen.stages.map((s, i) => (
            <li key={s} className={i < at ? 'done' : i === at ? 'active' : ''}>
              <span className="stage-mark" aria-hidden="true">{i < at ? '✓' : i === at ? '◉' : '○'}</span>
              {STAGE_LABEL[s]}
              {i === at && <span className="sr-only"> (in progress)</span>}
            </li>
          ))}
        </ol>
        <button className="btn small" onClick={onCancel}>Cancel</button>
      </div>
    );
  }
  if (gen.status === 'failed') {
    return (
      <div className="gen-status frame failed" role="alert">
        <span className="reg tl" aria-hidden="true" />
        <span className="reg br" aria-hidden="true" />
        <p className="instrument-label amber">Couldn’t open the lesson</p>
        <p>{gen.message} Your question is still in the box above.</p>
        <button className="btn" onClick={onRetry}><Icon name="retry" size={16} /> Try again</button>
      </div>
    );
  }
  return (
    <div className="gen-status frame unsupported" role="status">
      <span className="reg tl" aria-hidden="true" />
      <span className="reg br" aria-hidden="true" />
      <p className="instrument-label">Not available in demo mode</p>
      <p>
        Live lesson generation isn’t connected, so Parallax can’t build an experiment for “{gen.prompt.length > 80 ? `${gen.prompt.slice(0, 80)}…` : gen.prompt}” yet. These three lessons are available:
      </p>
      <div className="examples">
        {LESSONS.map((l) => (
          <button key={l.id} className="chip strong" onClick={() => onOpenLesson(l.id)}>{l.title} →</button>
        ))}
      </div>
    </div>
  );
}
