import { painter, background, type SceneState } from './paint';
import { mechanics } from './mechanics';
import { wavesElectric } from './wavesElectric';
import { thermalFluids } from './thermalFluids';
import { opticsMath } from './opticsMath';
export function drawScene(ctx: CanvasRenderingContext2D, state: SceneState, effects: boolean) {
  const g = painter(ctx, effects);
  background(g, state.f, state.p, state.t);
  if (
    !mechanics(g, state) &&
    !wavesElectric(g, state) &&
    !thermalFluids(g, state) &&
    !opticsMath(g, state)
  )
    throw new Error(`Missing authored scene: ${state.f.id}`);
  if (state.focused) {
    const i = state.f.params.findIndex((p) => p.id === state.focused);
    if (i >= 0) {
      g.ctx.strokeStyle = '#c3f86b';
      g.ctx.strokeRect(45 + i * 235, 12, 220, 57);
    }
  }
}
export const ANIMATED = new Set([
  'harmonic',
  'rc',
  'cooling',
  'newton',
  'kinetic',
  'momentum',
  'impulse',
  'work',
  'mechanical-power',
  'projectile',
  'acceleration',
  'centripetal',
  'orbital',
  'pendulum',
  'wave-speed',
  'period',
  'doppler',
  'photon',
  'snell',
  'lens',
  'ohm',
  'electric-power',
  'ideal-gas',
  'boyle',
  'charles',
  'heat',
  'cooling',
  'continuity',
  'quadratic',
  'quadratic-roots',
  'exponential',
  'compound',
  'logistic',
]);
