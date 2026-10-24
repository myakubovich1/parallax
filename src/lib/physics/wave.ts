/**
 * Idealized one-dimensional, equal-frequency wave superposition.
 *   y1 = A1 sin(kx − 2πft)
 *   y2 = A2 sin(kx − 2πft + φ)
 *   y  = y1 + y2
 * Wavelength is fixed so k stays constant while frequency changes.
 */
export const WAVELENGTH_M = 1;
export const WAVE_NUMBER = (2 * Math.PI) / WAVELENGTH_M; // k, rad/m
export const X_SPAN_M = 3; // display spans three wavelengths

export interface WaveParams {
  A1: number;
  A2: number;
  f: number; // Hz
  phi: number; // degrees
}

export const degToRad = (deg: number) => (deg * Math.PI) / 180;

export function y1(x: number, t: number, p: WaveParams): number {
  return p.A1 * Math.sin(WAVE_NUMBER * x - 2 * Math.PI * p.f * t);
}

export function y2(x: number, t: number, p: WaveParams): number {
  return p.A2 * Math.sin(WAVE_NUMBER * x - 2 * Math.PI * p.f * t + degToRad(p.phi));
}

export function yTotal(x: number, t: number, p: WaveParams): number {
  return y1(x, t, p) + y2(x, t, p);
}

/** Amplitude of the sum: A_R = √(A1² + A2² + 2·A1·A2·cos φ). */
export function resultantAmplitude(p: WaveParams): number {
  const v = p.A1 * p.A1 + p.A2 * p.A2 + 2 * p.A1 * p.A2 * Math.cos(degToRad(p.phi));
  return Math.sqrt(Math.max(0, v));
}

/** Phase of the sum relative to y1, in degrees (0–360). */
export function resultantPhaseDeg(p: WaveParams): number {
  const r = degToRad(p.phi);
  const deg = (Math.atan2(p.A2 * Math.sin(r), p.A1 + p.A2 * Math.cos(r)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Spatial offset between matching crests of y1 and y2, as a fraction of λ. */
export function phaseOffsetMeters(phiDeg: number): number {
  return ((phiDeg % 360) / 360) * WAVELENGTH_M;
}

export type InterferenceKind = 'constructive' | 'destructive' | 'cancellation' | 'partial';

export function classify(p: WaveParams): InterferenceKind {
  const AR = resultantAmplitude(p);
  if (AR < 1e-6) return 'cancellation';
  if (Math.abs(AR - (p.A1 + p.A2)) < 1e-6) return 'constructive';
  if (Math.abs(AR - Math.abs(p.A1 - p.A2)) < 1e-6) return 'destructive';
  return 'partial';
}
