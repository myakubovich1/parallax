import { describe, expect, it, vi } from 'vitest';
import { FORMULAS } from './formulas';
import { reviewFormula } from './matcher';
import { liveAdapter } from '../generation/liveAdapter';

describe('equation review', () => {
  it.each([
    ['1//2mv^2', '1/2mv^2'],
    ['KE = 1//2mv^2', 'KE = 1/2mv^2'],
    ['E==mc²', 'E=mc²'],
    ['x = sin(t', 'x = sin(t)'],
  ])('offers a specific syntax repair for %s', (input, corrected) => {
    expect(reviewFormula(input)).toMatchObject({ kind: 'correction', original: input, corrected });
  });
  it.each([
    ['E=mc^3', 'mass-energy'],
    ['KE=mv^2', 'kinetic'],
    ['F=-kx^2', 'hooke'],
    ['1/2mv^3', 'kinetic'],
  ])('asks before substituting a nearby standard equation for %s', (input, id) => {
    expect(reviewFormula(input)).toMatchObject({
      kind: 'correction',
      corrected: FORMULAS.find((f) => f.id === id)!.equation,
    });
  });
  it.each(['E =', 'F = (m*a', 'x = sin(', 'x=1=2'])('guides incomplete input %s', (input) => {
    // A missing final parenthesis is repairable; other incomplete inputs need editing.
    expect(reviewFormula(input)).not.toBeNull();
  });
  it('requests a more specific question for a vague topic', () => {
    expect(reviewFormula('sex')).toMatchObject({ kind: 'clarify' });
  });
  it('checks a mistyped original gravity equation before the broad lesson matcher', async () => {
    const result = await liveAdapter.generate(
      { prompt: 'F=Gm1m2/r^3', mode: 'explore' },
      { signal: new AbortController().signal, onStage: () => {} },
    );
    expect(result).toMatchObject({
      status: 'review',
      review: { kind: 'correction', corrected: 'F = G*m_1*m_2/r^2' },
    });
  });
  it.each([
    'Explain black holes',
    'photosynthesis',
    'y=3*x+7',
    'F=-kx^3',
    'y=sin(t)+cos(t)',
    'F=mv',
  ])('preserves unfamiliar questions and valid custom equations: %s', (input) => {
    expect(reviewFormula(input)).toBeNull();
  });
  it('does not interrupt any exact preloaded equation or alias', () => {
    for (const f of FORMULAS)
      for (const input of [f.equation, f.title, ...f.aliases])
        expect(reviewFormula(input), input).toBeNull();
  });
  it('waits for confirmation without any provider request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      const request = { prompt: '1//2mv^2', mode: 'explore' as const };
      const opts = { signal: new AbortController().signal, onStage: () => {} };
      expect(await liveAdapter.generate(request, opts)).toMatchObject({
        status: 'review',
        review: { kind: 'correction' },
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(
        await liveAdapter.generate(
          { ...request, prompt: '1/2mv^2' },
          { ...opts, confirmedInput: true },
        ),
      ).toEqual({ status: 'preloaded', id: 'kinetic' });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
