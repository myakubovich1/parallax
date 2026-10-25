import type { GeneratedLessonSpec, LearningMode, LessonSpec } from '../lessons/types';
import type { InputReview } from '../catalog/matcher';

/**
 * Boundary between the UI and whatever produces lessons. Demo mode resolves
 * prompts to built-in lessons; a live service would implement the same
 * interface on top of a server endpoint (credentials stay server-side).
 */
export type GenerationStage = 'matching' | 'generating' | 'loading';

export const STAGE_LABEL: Record<GenerationStage, string> = {
  matching: 'Finding a preloaded experiment',
  generating: 'Designing your experiment and checking its model',
  loading: 'Loading the lesson’s interactive model',
};

export interface GenerationRequest { prompt: string; mode: LearningMode }

export type GenerationResult =
  | { status: 'review'; review: InputReview }
  | { status: 'ready'; lesson: LessonSpec; source: 'demo' | 'live' }
  | { status: 'preloaded'; id: string }
  | { status: 'generated'; lesson: GeneratedLessonSpec }
  | { status: 'unsupported'; prompt: string };

export class GenerationError extends Error {
  constructor(message: string, readonly recoverable = true) {
    super(message);
  }
}

export interface GenerationAdapter {
  readonly kind: 'demo' | 'live';
  readonly stages: GenerationStage[];
  generate(
    req: GenerationRequest,
    opts: { signal: AbortSignal; onStage: (s: GenerationStage) => void; confirmedInput?: boolean },
  ): Promise<GenerationResult>;
}
