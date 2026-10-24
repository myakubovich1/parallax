import { LESSONS } from '../lessons/registry';
import type { LessonSpec } from '../lessons/types';

/** Normalise pasted maths so "F=G·m₁m₂/r²" and "F = G m1 m2 / r^2" look alike. */
export function normalizePrompt(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchLesson(prompt: string): LessonSpec | null {
  const text = normalizePrompt(prompt);
  let best: { lesson: LessonSpec; score: number } | null = null;
  for (const lesson of LESSONS) {
    const score = lesson.matchers.reduce((s, re) => s + (re.test(text) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { lesson, score };
  }
  return best?.lesson ?? null;
}
