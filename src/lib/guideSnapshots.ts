import { evaluateLesson } from '../../server/lesson-engine.mjs';
import type { Formula } from './catalog/formulas';
import { displayEquation } from './catalog/display';
import {
  isExperiment,
  type GeneratedLessonSpec,
  type LearningMode,
  type LessonSpec,
  type Params,
} from './lessons/types';
import type { GuideSnapshot } from './help';
import { guideValue } from './guideExperiment';

const controls = (defs: GeneratedLessonSpec['params'], params: Params, prefix: string) =>
  defs.map((p) => ({
    id: `${prefix}-${p.id}`,
    label: p.label,
    symbol: p.symbol,
    value: guideValue(params[p.id], p.unit),
    hint: `${p.hint} Range: ${guideValue(p.min, p.unit)} to ${guideValue(p.max, p.unit)}.`,
  }));

export function authoredGuideSnapshot(
  lesson: LessonSpec,
  params: Params,
  mode: LearningMode,
  step: number,
  state: string,
  reference: Params | null,
): GuideSnapshot {
  const ctx = { step };
  return {
    id: lesson.id,
    kind: 'authored',
    title: lesson.title,
    mode,
    equation: lesson.equations
      .map(
        (e) =>
          `${e.label}: ${e.parts.map((p) => (typeof p === 'string' ? p : (p.text ?? lesson.terms[p.term]?.symbol ?? p.term))).join('')}`,
      )
      .join('\n'),
    summary: `${lesson.quick}\nCurrent observation: ${lesson.caption(params, ctx)}`,
    controls: controls(lesson.params, params, 'range'),
    terms: Object.values(lesson.terms).map((t) => ({
      symbol: t.symbol,
      label: t.name,
      meaning: t.meaning,
      value:
        t.value?.(params, ctx) ??
        (t.param ? guideValue(params[t.param], t.unit) : t.unit ? `Unit: ${t.unit}` : ''),
    })),
    readouts: lesson
      .readouts(params, ctx)
      .map((r) => `${r.label}: ${r.value}`)
      .join('\n'),
    assumptions: lesson.assumptions,
    state,
    reference: reference
      ? `${lesson.compare?.(params, reference) ?? ''}\nPinned parameters: ${lesson.params.map((p) => `${p.label}: ${guideValue(reference[p.id], p.unit)}`).join('; ')}`
      : 'No pinned reference.',
  };
}

export function catalogGuideSnapshot(
  f: Formula,
  params: Params,
  mode: LearningMode,
  reference: Params | null,
  state: string,
): GuideSnapshot {
  return {
    id: f.id,
    kind: 'catalog',
    title: f.title,
    mode,
    equation: displayEquation(f.id, f.equation),
    summary: f.explain,
    controls: controls(f.params, params, 'generated'),
    terms: f.params.map((p) => ({
      symbol: p.symbol,
      label: p.label,
      meaning: p.hint,
      value: guideValue(params[p.id], p.unit),
    })),
    readouts: `${f.output}: ${guideValue(f.calculate(params), f.unit)}`,
    assumptions: f.assumptions,
    state,
    reference: reference
      ? `Pinned ${f.output}: ${guideValue(f.calculate(reference), f.unit)}. ${f.params.map((p) => `${p.label}: ${guideValue(reference[p.id], p.unit)}`).join('; ')}`
      : 'No pinned reference.',
  };
}

export function generatedGuideSnapshot(
  lesson: GeneratedLessonSpec,
  params: Params,
  mode: LearningMode,
  reference: Params | null = null,
  state = '',
): GuideSnapshot {
  const snapshot: GuideSnapshot = {
    id: lesson.title,
    kind: isExperiment(lesson) ? 'generated' : 'legacy',
    title: lesson.title,
    mode,
    equation: lesson.equation,
    summary: lesson.explanation.join('\n'),
    controls: controls(lesson.params, params, isExperiment(lesson) ? 'range' : 'generated'),
    terms: lesson.params.map((p) => ({
      symbol: p.symbol,
      label: p.label,
      meaning: p.hint,
      value: guideValue(params[p.id], p.unit),
    })),
    readouts:
      'This older visualization does not expose computed readouts to the guide. Do not infer numerical results from its image.',
    assumptions: lesson.assumptions,
    state,
    reference: 'No pinned reference.',
  };
  if (isExperiment(lesson)) {
    const results = evaluateLesson(lesson, params);
    snapshot.summary = `${lesson.plan.objective}\n${lesson.plan.takeaway}\n${lesson.plan.misconception}`;
    snapshot.terms.push(
      ...lesson.constants.map((c) => ({
        symbol: c.symbol,
        label: c.label,
        meaning: c.meaning,
        value: guideValue(c.value, c.unit),
      })),
      ...lesson.outputs.map((o) => ({
        symbol: o.symbol,
        label: o.label,
        meaning: o.meaning,
        value: guideValue(results[o.id].value, o.displayUnit),
      })),
    );
    snapshot.readouts = lesson.outputs
      .map(
        (o) =>
          `${o.label}: ${guideValue(results[o.id].value, o.displayUnit)} (SI: ${guideValue(results[o.id].si, o.unit)})`,
      )
      .join('\n');
    snapshot.reference = reference
      ? lesson.outputs
          .map(
            (o) => `${o.label}: ${guideValue(evaluateLesson(lesson, reference)[o.id].value, o.displayUnit)}`,
          )
          .join('; ')
      : 'No pinned reference.';
  }
  return snapshot;
}
