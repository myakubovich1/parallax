import { describe, it, expect, vi } from 'vitest';
import { FORMULAS, FORMULA_BY_ID } from './formulas';
import { LESSONS } from '../lessons/registry';
import { matchFormula } from './matcher';
import { liveAdapter } from '../generation/liveAdapter';

describe('authored formula library', () => {
  it('contains 50 distinct experiments including the three existing authored lessons', () => {
    expect(FORMULAS.length + LESSONS.length).toBe(50);
    expect(new Set(FORMULAS.map((f) => f.id)).size).toBe(47);
  });
  it.each(FORMULAS.map((f) => [f.id, f] as const))(
    'recognizes the name and displayed equation for %s',
    (_, f) => {
      expect(matchFormula(f.title)?.id).toBe(f.id);
      expect(matchFormula(f.equation)?.id).toBe(f.id);
    },
  );
  it.each([
    'kinetic energy',
    'Explain kinetic energy',
    'What is the formula for kinetic energy?',
    '½mv²',
    '1/2mv^2',
    '1/2*m*v^2',
    '0.5mv**2',
    'E = mv²/2',
    'KE = 0.5 v^2 m',
    'E_k = 1/2mv^2',
    '\\frac{1}{2}mv^{2}',
  ])('recognizes equivalent kinetic energy input %s', (text) =>
    expect(matchFormula(text)?.id).toBe('kinetic'),
  );
  it.each([
    'E=mc²',
    'quadratic formula',
    'x=(-b±sqrt(b²-4ac))/(2a)',
    'F = ma',
    'F=m*a',
    'Newton’s second law',
    'V=IR',
    'ohms law',
    'A=πr²',
  ])('recognizes familiar names and notation: %s', (text) =>
    expect(matchFormula(text)).not.toBeNull(),
  );
  it.each([
    '1/2mv^3',
    'F=-kx^2',
    'F=mv',
    'm=0.5mv^2',
    'v=v/r',
    'relativistic kinetic energy',
    'angular momentum',
    'Explain black holes',
    'import("secret")',
    'x=1;alert(1)',
  ])('does not substitute a different model for %s', (text) =>
    expect(matchFormula(text)).toBeNull(),
  );
  it.each(FORMULAS.flatMap((f) => f.aliases.map((a) => [f.id, a] as const)))(
    'recognizes the authored alias for %s: %s',
    (id, alias) => expect(matchFormula(alias)?.id).toBe(id),
  );
  it('has valid slider ranges and finite default readouts for every formula', () => {
    for (const f of FORMULAS) {
      const p = Object.fromEntries(f.params.map((d) => [d.id, d.default]));
      expect(Number.isFinite(f.calculate(p)), f.id).toBe(true);
      for (const d of f.params) {
        expect(d.min).toBeLessThan(d.max);
        expect(d.step).toBeGreaterThan(0);
        expect(d.default).toBeGreaterThanOrEqual(d.min);
        expect(d.default).toBeLessThanOrEqual(d.max);
      }
    }
  });
  it('computes reference values and domain boundaries', () => {
    expect(FORMULA_BY_ID.kinetic.calculate({ m: 2, v: 4 })).toBe(16);
    expect(FORMULA_BY_ID.hooke.calculate({ k: 10, x: 0.5 })).toBe(-5);
    expect(FORMULA_BY_ID.pythagoras.calculate({ a: 3, b: 4 })).toBe(5);
    expect(FORMULA_BY_ID.ohm.calculate({ V: 12, R: 10 })).toBeCloseTo(1.2);
    expect(FORMULA_BY_ID.coulomb.calculate({ q1: 1, q2: -1, r: 1 })).toBeCloseTo(-0.00898755);
    expect(FORMULA_BY_ID.snell.calculate({ theta: 80, n1: 1.5, n2: 1 })).toBeNaN();
    expect(FORMULA_BY_ID.rc.calculate({ t: 1, R: 10, C: 100 })).toBeCloseTo(12 / Math.E);
    expect(FORMULA_BY_ID['ideal-gas'].calculate({ n: 1, T: 300, V: 10 })).toBeCloseTo(249.43387854);
  });
  it('serves every preloaded equation without any network call, including without credentials', async () => {
    const spy = vi.fn(() => {
      throw new Error('A preload must not call an API');
    });
    vi.stubGlobal('fetch', spy);
    try {
      for (const f of FORMULAS) {
        const result = await liveAdapter.generate(
          { prompt: f.equation, mode: 'explore' },
          { signal: new AbortController().signal, onStage: () => {} },
        );
        expect(result).toEqual({ status: 'preloaded', id: f.id });
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
