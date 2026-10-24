import { loadRenderer } from '../../renderers/loadRenderer';
import { GenerationError, type GenerationAdapter } from './adapter';
import { matchLesson } from './matcher';

const abortError = () => new DOMException('Cancelled', 'AbortError');

/** Deterministic: no network, no model. Lessons are authored, not generated. */
export const demoAdapter: GenerationAdapter = {
  kind: 'demo',
  stages: ['matching', 'loading'],
  async generate(req, { signal, onStage }) {
    onStage('matching');
    const lesson = matchLesson(req.prompt);
    if (!lesson) return { status: 'unsupported', prompt: req.prompt };
    if (signal.aborted) throw abortError();

    onStage('loading');
    // QA hook (development builds only): ?demo-failure forces the recoverable error state.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo-failure')) {
      throw new GenerationError('The interactive model for this lesson could not be loaded.');
    }
    try {
      await loadRenderer(lesson.renderer);
    } catch {
      throw new GenerationError('The interactive model for this lesson could not be loaded. Check your connection and try again.');
    }
    if (signal.aborted) throw abortError();
    return { status: 'ready', lesson, source: 'demo' };
  },
};
