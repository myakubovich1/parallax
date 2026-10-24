import type { ConceptId, LearningMode, Params } from './lessons/types';

export interface SavedExperiment {
  id: string;
  conceptId: ConceptId;
  title: string;
  mode: LearningMode;
  params: Params;
  savedAt: number;
}

const KEY = 'parallax.saved.v1';

export function loadSaved(): SavedExperiment[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedExperiment[]) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.conceptId === 'string' && e.params) : [];
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
