import { describe, expect, it } from 'vitest';
import { matchLesson } from './matcher';

const id = (p: string) => matchLesson(p)?.id ?? null;

describe('demo matcher', () => {
  it.each([
    ['Explain wave interference.', 'wave-interference'],
    ['what happens when two waves overlap', 'wave-interference'],
    ['y = y1 + y2 superposition', 'wave-interference'],
    ['F = G m1 m2 / r²', 'gravitational-attraction'],
    ['F=G·m₁m₂/r²', 'gravitational-attraction'],
    ['why do masses attract each other?', 'gravitational-attraction'],
    ['Why does gradient descent sometimes overshoot?', 'gradient-descent'],
    ['my learning rate is too high and loss explodes', 'gradient-descent'],
  ])('%s', (prompt, expected) => expect(id(prompt)).toBe(expected));

  it('returns null for unsupported topics', () => {
    expect(id('Explain photosynthesis')).toBeNull();
    expect(id('E = mc^2')).toBeNull();
  });

  it('sends only gravitation, not the laws of motion, to the gravity lesson (the one with the apple story)', () => {
    for (const p of ["Newton's law", "Newton's law of universal gravitation", "Newton’s law of gravity", 'F = G m1 m2 / r^2', 'why do apples fall'])
      expect(id(p), p).toBe('gravitational-attraction');
    for (const p of ["Newton's laws", "Newton's laws of motion", "Newton's law of motion", "Newton's first law", "Newton's 3rd law", 'law of inertia', "Newton's law of cooling"])
      expect(id(p), p).not.toBe('gravitational-attraction');
  });
});
