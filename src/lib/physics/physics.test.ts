import { describe, expect, it } from 'vitest';
import * as W from './wave';
import * as Gv from './gravity';
import * as Gd from './gradient';

describe('wave interference', () => {
  const xs = Array.from({ length: 31 }, (_, i) => i * 0.1);
  it('composite equals the sum of the sources everywhere', () => {
    const p = { A1: 0.8, A2: 1.3, f: 0.7, phi: 125 };
    for (const x of xs) for (const t of [0, 0.37, 2.1]) {
      expect(W.yTotal(x, t, p)).toBeCloseTo(W.y1(x, t, p) + W.y2(x, t, p), 12);
    }
  });
  it('resultant amplitude matches the peak of the sampled sum', () => {
    const p = { A1: 0.6, A2: 1.1, f: 1, phi: 70 };
    let peak = 0;
    for (let i = 0; i <= 4000; i++) peak = Math.max(peak, Math.abs(W.yTotal(i / 4000, 0, p)));
    expect(peak).toBeCloseTo(W.resultantAmplitude(p), 4);
  });
  it('equal amplitudes at 0° are constructive (2A)', () => {
    const p = { A1: 1, A2: 1, f: 1, phi: 0 };
    expect(W.resultantAmplitude(p)).toBeCloseTo(2, 12);
    expect(W.classify(p)).toBe('constructive');
  });
  it('equal amplitudes at 180° cancel everywhere', () => {
    const p = { A1: 1, A2: 1, f: 1, phi: 180 };
    expect(W.classify(p)).toBe('cancellation');
    for (const x of xs) expect(Math.abs(W.yTotal(x, 0.3, p))).toBeLessThan(1e-12);
  });
  it('k is consistent with the fixed wavelength', () => {
    const p = { A1: 1, A2: 0, f: 1, phi: 0 };
    expect(W.y1(0.13, 0, p)).toBeCloseTo(W.y1(0.13 + W.WAVELENGTH_M, 0, p), 12);
  });
  it('frequency does not change the resultant amplitude', () => {
    const a = W.resultantAmplitude({ A1: 1, A2: 0.5, f: 0.2, phi: 90 });
    const b = W.resultantAmplitude({ A1: 1, A2: 0.5, f: 2, phi: 90 });
    expect(a).toBeCloseTo(b, 12);
  });
});

describe('gravitational attraction', () => {
  it('doubling separation quarters the force', () => {
    const a = Gv.force({ m1: 500, m2: 200, r: 1.5 });
    const b = Gv.force({ m1: 500, m2: 200, r: 3 });
    expect(b / a).toBeCloseTo(0.25, 12);
  });
  it('force is linear in each mass', () => {
    expect(Gv.force({ m1: 400, m2: 200, r: 2 }) / Gv.force({ m1: 200, m2: 200, r: 2 })).toBeCloseTo(2, 12);
  });
  it('uses SI units', () => {
    expect(Gv.force({ m1: 1, m2: 1, r: 1 })).toBeCloseTo(6.674e-11, 20);
  });
  it('rejects zero separation', () => {
    expect(() => Gv.force({ m1: 1, m2: 1, r: 0 })).toThrow();
  });
  it('minimum separation keeps spheres apart', () => {
    const m = 1000;
    expect(Gv.minSeparation(m, m)).toBeGreaterThan(2 * Gv.sphereRadius(m));
  });
});

describe('gradient descent', () => {
  it('closed form matches the update rule', () => {
    for (const eta of [0.05, 0.3, 0.85, 1.05]) {
      expect(Gd.wAt(-2, eta, 7) - 3).toBeCloseTo((1 - 2 * eta) ** 7 * (-2 - 3), 9);
    }
  });
  it('classifies the three presets', () => {
    expect(Gd.regime(0.05)).toBe('slow');
    expect(Gd.regime(0.85)).toBe('oscillating');
    expect(Gd.regime(1.05)).toBe('unstable');
    expect(Gd.regime(1)).toBe('periodic');
  });
  it('slow and overshooting rates converge; unstable leaves the display bound', () => {
    const steps = (eta: number) => {
      for (let n = 0; n <= Gd.MAX_STEPS; n++) { const h = Gd.haltAt(-2, eta, n); if (h) return h; }
      return null;
    };
    expect(steps(0.05)?.kind).toBe('converged');
    expect(steps(0.85)?.kind).toBe('converged');
    expect(steps(1.05)?.kind).toBe('out-of-bounds');
  });
  it('overshooting crosses the minimum each step', () => {
    const a = Gd.wAt(-2, 0.85, 1) - 3, b = Gd.wAt(-2, 0.85, 2) - 3;
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });
});
