import { gradientLesson } from './gradient';
import { gravityLesson } from './gravity';
import type { ConceptId, LessonSpec, Params } from './types';
import { waveLesson } from './wave';

export const LESSONS: LessonSpec[] = [waveLesson, gravityLesson, gradientLesson];
export const LESSON_BY_ID: Record<ConceptId, LessonSpec> = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<ConceptId, LessonSpec>;

export function defaultParams(lesson: LessonSpec): Params {
  return Object.fromEntries(lesson.params.map((p) => [p.id, p.default]));
}

/** Clamp to each parameter's range and step, then apply lesson constraints. */
export function sanitizeParams(lesson: LessonSpec, input: Params): Params {
  const out: Params = {};
  for (const def of lesson.params) {
    const raw = Number.isFinite(input[def.id]) ? input[def.id] : def.default;
    const stepped = Math.round((raw - def.min) / def.step) * def.step + def.min;
    out[def.id] = Number(Math.min(def.max, Math.max(def.min, stepped)).toFixed(6));
  }
  return lesson.normalize ? lesson.normalize(out) : out;
}
