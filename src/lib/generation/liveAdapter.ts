import { validateLesson } from '../../../server/lesson.mjs';
import { GenerationError, type GenerationAdapter } from './adapter';
import { demoAdapter } from './demoAdapter';
import { matchLesson } from './matcher';

export const liveAdapter: GenerationAdapter = {
  kind: 'live',
  stages: ['matching', 'generating', 'loading'],
  async generate(req, opts) {
    opts.onStage('matching');
    const { matchFormula, reviewFormula } = await import('../catalog/matcher');
    if (opts.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!opts.confirmedInput) {
      const review = reviewFormula(req.prompt);
      if (review) return { status: 'review', review };
    }
    const formula = matchFormula(req.prompt);
    if (formula) return { status: 'preloaded', id: formula.id };
    if (matchLesson(req.prompt)) return demoAdapter.generate(req, opts);
    opts.onStage('generating');
    let response: Response;
    try {
      response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req), signal: opts.signal,
      });
    } catch (error) {
      if (opts.signal.aborted) throw error;
      throw new GenerationError('Could not reach the lesson server. Check your connection and try again.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new GenerationError(data?.error || 'The lesson service is unavailable. Please try again.');
    opts.onStage('loading');
    try {
      return { status: 'generated', lesson: validateLesson(data?.lesson) };
    } catch {
      throw new GenerationError('The lesson service returned an invalid lesson. Please try again.');
    }
  },
};
