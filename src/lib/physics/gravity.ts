/** Newtonian gravitational force between two point masses: F = G·m1·m2 / r². */
export const G = 6.674e-11; // N·m²/kg²
/** Bodies are drawn as solid lead spheres so their size follows from mass. */
export const LEAD_DENSITY = 11340; // kg/m³
export const MIN_GAP_M = 0.02;

export interface GravityParams {
  m1: number; // kg
  m2: number; // kg
  r: number; // m, centre-to-centre
}

export function force(p: GravityParams): number {
  if (p.r <= 0) throw new RangeError('Separation must be positive');
  return (G * p.m1 * p.m2) / (p.r * p.r);
}

export function sphereRadius(mass: number, density = LEAD_DENSITY): number {
  return Math.cbrt((3 * mass) / (4 * Math.PI * density));
}

/** Smallest centre-to-centre distance before the spheres would touch. */
export function minSeparation(m1: number, m2: number): number {
  return sphereRadius(m1) + sphereRadius(m2) + MIN_GAP_M;
}
