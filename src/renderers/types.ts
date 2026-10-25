import type { SimClock } from '../lib/clock';
import type { LessonSpec, Params } from '../lib/lessons/types';

export interface RendererProps {
  lesson: LessonSpec;
  params: Params;
  setParams: (patch: Params) => void;
  clock: SimClock;
  /** Completed iterations, for stepped lessons. */
  step: number;
  focusedTerm: string | null;
  onFocusTerm: (id: string | null) => void;
  highlight: string | null;
  reference: Params | null;
  effects: boolean;
  reducedMotion: boolean;
  compact?: boolean;
  /** Easter-egg overrides outside the lesson's model (clearly labelled when drawn). */
  extras?: { f2?: number };
}
