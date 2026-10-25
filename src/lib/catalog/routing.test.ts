import { describe, expect, it, vi } from 'vitest';
import { FORMULAS } from './formulas';
import { displayEquation } from './display';
import { matchFormula, matchLessonEquation } from './matcher';
import { liveAdapter } from '../generation/liveAdapter';
import { equationKey, expressionKey } from './algebra';

describe('premium experiment routing', () => {
  it.each(FORMULAS.map((f) => [f.id, f] as const))(
    '%s accepts its displayed notation and ordinary equation requests',
    (_, f) => {
      for (const input of [
        displayEquation(f.id, f.equation),
        `Please explain ${f.equation}`,
        `Show me an experiment for ${f.equation}`,
        `Can you visualize ${f.equation} for me?`,
        `Explain this equation: $${f.equation}$`,
        `${f.title} (${f.equation})`,
      ])
        expect(matchFormula(input)?.id, input).toBe(f.id);
    },
  );
  it.each([
    ['p=w/t', 'mechanical-power'],
    ['P = W / t', 'mechanical-power'],
    ['W=P*t', 'mechanical-power'],
    ['t=W/P', 'mechanical-power'],
    ['P*t=W', 'mechanical-power'],
    ['power = W/t', 'mechanical-power'],
    ['Explain electrical power', 'electric-power'],
    ['Explain elastic potential energy', 'elastic'],
    ['Kinetic energy = ½mv²', 'kinetic'],
    ['mv^2=2E', 'kinetic'],
    ['v²=2E/m', 'kinetic'],
    ['m=2E/v²', 'kinetic'],
    ['E_k=\\frac{mv^{2}}{2}', 'kinetic'],
    ['v=\\sqrt{\\frac{2E}{m}}', 'kinetic'],
    ['a=F/m', 'newton'],
    ['m=F/a', 'newton'],
    ['IR=V', 'ohm'],
    ['R=V/I', 'ohm'],
    ['V=I*R', 'ohm'],
    ['PV=nRT', 'ideal-gas'],
    ['T=PV/(nR)', 'ideal-gas'],
    ['c²=b²+a²', 'pythagoras'],
    ['A/r²=π', 'circle'],
    ['r²=A/π', 'circle'],
    ['PE=mgh', 'potential'],
    ['E_p=mgh', 'potential'],
    ['v₁A₁=v₂A₂', 'continuity'],
  ])('%s selects %s', (input, id) => expect(matchFormula(input)?.id).toBe(id));
  it('is independent of symbol order and harmless scalar factors', () => {
    expect(equationKey('P=W/t')).toBe(equationKey('2*W=2*t*P'));
    expect(equationKey('y=(x+1)^2')).toBe(equationKey('y=x^2+2*x+1'));
    expect(expressionKey('N0*e^{kt}')).toBe(expressionKey('N0*exp(k*t)'));
  });
  it.each([
    'F=-k*x^3',
    'F=G*m1*m2/r^4',
    'y=sin(k*x)^2',
    'm=0.5*m*v^2',
    'Compare kinetic energy and momentum',
  ])('does not force a different model for %s', (input) => {
    expect(matchFormula(input)).toBeNull();
    expect(matchLessonEquation(input)).toBeNull();
  });
  it('bounds algebraic work and rejects executable or invalid syntax', () => {
    for (const input of [
      'x=1;alert(1)',
      'x=import("secret")',
      'x=1/0',
      'x=' + '(a+b+c+d+e+f+g+h)^8',
      'x=' + '('.repeat(90) + 'a' + ')'.repeat(90),
    ])
      expect(equationKey(input)).toBeNull();
  });
  it('always routes supported variants locally before any provider call', async () => {
    const fetch = vi.fn(() => {
      throw Error('Supported input must never reach AI');
    });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('location', { search: '' });
    try {
      const opts = { signal: new AbortController().signal, onStage: () => {} };
      for (const f of FORMULAS) {
        for (const prompt of [
          f.title,
          f.equation,
          displayEquation(f.id, f.equation),
          `Explain this equation: ${f.equation}`,
        ]) {
          expect(await liveAdapter.generate({ prompt, mode: 'explore' }, opts), prompt).toEqual({
            status: 'preloaded',
            id: f.id,
          });
        }
      }
      for (const [prompt, id] of [
        ['P=W/t', 'mechanical-power'],
        ['W=Pt', 'mechanical-power'],
        ['t=W/P', 'mechanical-power'],
      ])
        expect(await liveAdapter.generate({ prompt, mode: 'explore' }, opts)).toEqual({
          status: 'preloaded',
          id,
        });
      for (const [prompt, id] of [
        ['r²=Gm₁m₂/F', 'gravitational-attraction'],
        ['y=y₂+y₁', 'wave-interference'],
        ['L=w^2-6w+9', 'gradient-descent'],
      ])
        expect(await liveAdapter.generate({ prompt, mode: 'explore' }, opts)).toMatchObject({
          status: 'ready',
          lesson: { id },
        });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('allows unfamiliar models to reach AI instead of a broad keyword fallback', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'Mock provider reached' }), { status: 503 }),
    );
    vi.stubGlobal('fetch', fetch);
    try {
      for (const prompt of ['F=G*m1*m2/r^4', 'y=sin(k*x)^2', 'Explain damped wave interference'])
        await expect(
          liveAdapter.generate(
            { prompt, mode: 'explore' },
            { signal: new AbortController().signal, onStage: () => {} },
          ),
        ).rejects.toThrow('Mock provider reached');
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
