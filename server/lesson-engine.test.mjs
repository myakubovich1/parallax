import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLesson, evaluateFormula, unitInfo } from './lesson-engine.mjs';
import { validateLesson } from './lesson.mjs';
import { massEnergy, spring } from '../verify/fixtures/experiments.mjs';

test('older saved lessons retain their original text limits but cannot be new provider output', () => {
  const old = {title: 'Saved lesson', equation: 'F = -kx', explanation: ['a'.repeat(3000)], stageHtml: '<p>Saved scene</p>', params: spring.params, assumptions: spring.assumptions};
  assert.equal(validateLesson(old), old);
  assert.throws(() => validateLesson(old, true));
});

test('mass-energy converts g to kg exactly once and EJ correctly', () => {
  validateLesson(massEnergy, true);
  const one = evaluateLesson(massEnergy, { m: 1 }).E;
  assert.ok(Math.abs(one.value - 89.87551787368177) < 1e-10);
  assert.equal(evaluateLesson(massEnergy, { m: 2 }).E.si / one.si, 2);
  assert.equal(evaluateLesson(massEnergy, { m: 0 }).E.si, 0);
  const ej = { ...massEnergy, outputs: [{ ...massEnergy.outputs[0], displayUnit: 'EJ' }] };
  assert.ok(Math.abs(evaluateLesson(ej, { m: 1000 }).E.value - 0.08987551787368176) < 1e-12);
});
test('spring has the right dimensions, magnitude and direction', () => {
  validateLesson(spring, true);
  assert.equal(evaluateLesson(spring, { x: -2 }).F.si, 4);
  assert.equal(evaluateLesson(spring, { x: 0 }).F.si, 0);
});
test('dimensional errors, false reference results, inert sliders and invalid ranges are rejected', () => {
  for (const broken of [
    { ...massEnergy, outputs: [{ ...massEnergy.outputs[0], formula: ['m', 'c', '*'] }] },
    { ...massEnergy, outputs: [{ ...massEnergy.outputs[0], displayUnit: 'N' }] },
    { ...massEnergy, checks: [{ ...massEnergy.checks[0], expectedSI: 90e18 }] },
    { ...spring, params: [{ ...spring.params[0], min: -1, max: 1, default: 2 }] },
    { ...spring, constants: [{ ...spring.constants[0], id: 'x' }] },
    { ...massEnergy, constants: [{ ...massEnergy.constants[0], value: 300000000 }] },
    { ...spring, prediction: { ...spring.prediction, correctIndex: 9 } },
    { ...spring, presets: [{ ...spring.presets[0], values: [] }] },
    { ...spring, outputs: [{ ...spring.outputs[0], formula: ['k', 'x', '/', 'neg'] }] },
    { ...spring, outputs: [{ ...spring.outputs[0], formula: ['k', '1', '*'] }], checks: [] },
  ])
    assert.throws(() => validateLesson(broken, true));
});
test('arithmetic rejects executable input and handles finite domains without eval', () => {
  for (const tokens of [['globalThis'], ['1', '0', '/'], ['-1', 'sqrt'], ['1', '+'], ['1', '2'], ['1e999']])
    assert.throws(() => evaluateFormula(tokens, {}));
  assert.equal(evaluateFormula(['9', 'sqrt', '2', '^'], {}).value, 9);
  assert.deepEqual(unitInfo('kg*m/s^2'), unitInfo('N'));
  assert.deepEqual(unitInfo('V*A'), unitInfo('W'));
  assert.throws(() => unitInfo('banana'));
});

test('independent laws reject self-consistent but scientifically wrong generated checks', () => {
  const wrong = {
    ...massEnergy,
    outputs: [{ ...massEnergy.outputs[0], formula: [...massEnergy.outputs[0].formula, '1000', '*'] }],
    checks: massEnergy.checks.map((c) => ({ ...c, expectedSI: c.expectedSI * 1000 })),
  };
  assert.throws(() => validateLesson(wrong, true), /Independent mass/);
});
