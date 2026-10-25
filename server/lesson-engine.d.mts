import type { ExperimentLesson, Params } from '../src/lib/lessons/types';
export function unitInfo(unit: string): { scale: number; dimensions: number[] };
export function evaluateFormula(
  tokens: string[],
  variables: Record<string, { value: number; dimensions: number[] }>,
): { value: number; dimensions: number[] };
export function evaluateLesson(
  lesson: ExperimentLesson,
  params: Params,
): Record<string, { si: number; value: number; unit: string }>;
export function parameterValues(lesson: ExperimentLesson, values: number[]): Params;
export function checkExperiment(lesson: ExperimentLesson): { probes: number; references: number };
