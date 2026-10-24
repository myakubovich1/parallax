/**
 * Gradient descent on L(w) = (w − 3)².
 *   dL/dw = 2(w − 3)
 *   w_next = w − η·2(w − 3)
 * Closed form: w_n − 3 = (1 − 2η)^n · (w0 − 3).
 */
export const MINIMUM_W = 3;
/** The chart shows |w − 3| ≤ 12; beyond that the point leaves the display. */
export const DISPLAY_BOUND = 12;
export const CONVERGED_TOL = 1e-3;
export const MAX_STEPS = 200;

export const loss = (w: number) => (w - MINIMUM_W) ** 2;
export const slope = (w: number) => 2 * (w - MINIMUM_W);
export const nextW = (w: number, eta: number) => w - eta * slope(w);

export function wAt(w0: number, eta: number, n: number): number {
  let w = w0;
  for (let i = 0; i < n; i++) w = nextW(w, eta);
  return w;
}

export type Regime = 'slow' | 'direct' | 'oscillating' | 'periodic' | 'unstable';

/** Behaviour is set by the contraction factor 1 − 2η. */
export function regime(eta: number): Regime {
  const c = 1 - 2 * eta;
  if (Math.abs(c) > 1 + 1e-12) return 'unstable';
  if (Math.abs(Math.abs(c) - 1) <= 1e-12) return eta === 0 ? 'slow' : 'periodic';
  if (c < 0) return 'oscillating';
  if (c <= 0.5) return 'direct';
  return 'slow';
}

export type Halt =
  | { kind: 'converged'; n: number }
  | { kind: 'out-of-bounds'; n: number; w: number }
  | { kind: 'max-steps'; n: number };

export function haltAt(w0: number, eta: number, n: number): Halt | null {
  const w = wAt(w0, eta, n);
  if (!Number.isFinite(w) || Math.abs(w - MINIMUM_W) > DISPLAY_BOUND) return { kind: 'out-of-bounds', n, w };
  if (Math.abs(w - MINIMUM_W) < CONVERGED_TOL) return { kind: 'converged', n };
  if (n >= MAX_STEPS) return { kind: 'max-steps', n };
  return null;
}
