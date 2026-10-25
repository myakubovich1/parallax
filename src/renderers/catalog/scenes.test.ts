import { describe, it, expect } from 'vitest';
import { FORMULAS } from '../../lib/catalog/formulas';
import { drawScene } from './draw';
function context() {
  let primitives = 0,
    texts = 0;
  const check = (...args: unknown[]) => {
    for (const a of args)
      if (typeof a === 'number' && !Number.isFinite(a)) throw Error('Nonfinite drawing coordinate');
    primitives++;
  };
  const c = {
    clearRect: check,
    fillRect: check,
    strokeRect: check,
    beginPath: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    moveTo: check,
    lineTo: check,
    arc: check,
    rect: check,
    clip: () => {},
    setLineDash: () => {},
    createRadialGradient: (...args: unknown[]) => {
      check(...args);
      return { addColorStop: () => {} };
    },
    fillText: (_text: string, x: number, y: number) => {
      check(x, y);
      texts++;
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  };
  return { ctx: c as unknown as CanvasRenderingContext2D, counts: () => ({ primitives, texts }) };
}
describe('authored demonstration renderers', () => {
  it.each(FORMULAS.map((f) => [f.id, f] as const))(
    '%s has a complete, finite scene at defaults and every slider endpoint combination',
    (_, f) => {
      const defaults = Object.fromEntries(f.params.map((p) => [p.id, p.default]));
      const probes = [
        defaults,
        ...Array.from({ length: 2 ** f.params.length }, (_, mask) =>
          Object.fromEntries(f.params.map((p, i) => [p.id, mask & (1 << i) ? p.max : p.min])),
        ),
      ];
      for (const p of probes)
        for (const t of [0, 2.5, 17]) {
          const { ctx, counts } = context();
          drawScene(ctx, { f, p, t, reference: defaults, focused: f.params[0].id }, true);
          expect(counts().primitives).toBeGreaterThan(30);
          expect(counts().texts).toBeGreaterThanOrEqual(f.params.length * 2 + 2);
        }
    },
  );
});
