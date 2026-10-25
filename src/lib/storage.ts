import { validateLesson } from '../../server/lesson.mjs';
import type { ConceptId, GeneratedLessonSpec, LearningMode, Params } from './lessons/types';

interface SavedBase {
  id: string;
  title: string;
  mode: LearningMode;
  params: Params;
  savedAt: number;
}

export type SavedExperiment = SavedBase & (
  { conceptId: ConceptId; generatedLesson?: never }
  | { conceptId?: never; generatedLesson: GeneratedLessonSpec }
);

const KEY = 'parallax.saved.v1';

export function loadSaved(): SavedExperiment[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedExperiment[]) : [];
    return Array.isArray(list) ? list.filter(e => {
      if (!e || typeof e.id !== 'string' || !e.params || !Object.values(e.params).every(v => typeof v === 'number' && Number.isFinite(v))) return false;
      if (e.generatedLesson) {
        try { validateLesson(e.generatedLesson); return true; } catch { return false; }
      }
      return typeof e.conceptId === 'string';
    }) : [];
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedExperiment[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`parallax.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`parallax.${key}`, JSON.stringify(value));
  } catch {
    /* preferences are a convenience */
  }
}
