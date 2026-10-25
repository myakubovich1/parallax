import { C } from '../palette';
import { type Paint, type SceneState, sample, number, clamp, TAU } from './paint';
export function wavesElectric(g: Paint, { f, p, t, reference }: SceneState): boolean {
  const id = f.id,
    v = f.calculate(p);
  if (['harmonic', 'wave-speed', 'period', 'doppler', 'photon'].includes(id)) {
    if (id === 'doppler') {
      const beta = p.vs / 343,
        x0 = 420 + beta * 80 * (t % 8),
        interval = (0.65 * 440) / p.f;
      g.ctx.save();
      g.ctx.beginPath();
      g.ctx.rect(100, 145, 800, 280);
      g.ctx.clip();
      for (let i = 0; i < Math.ceil(9 / interval); i++) {
        const age = (t % interval) + i * interval;
        g.circle(x0 - beta * 80 * age, 285, age * 80, C.ice, false, 0.3 * (1 - age / 11));
      }
      g.ctx.restore();
      g.body(x0, 285, 20);
      g.body(855, 285, 8, C.ice);
      g.arrow(x0, 180, x0 + p.vs * 0.8, 180, C.lime);
      g.text(100, 125, 'MOVING SOURCE · STATIONARY OBSERVER', C.ice, 14);
      g.text(855, 400, 'LISTENER', C.ice, 14, 'center');
      g.text(
        480,
        430,
        `emitted ${number(p.f)} Hz → observed ${number(v)} Hz`,
        C.text,
        18,
        'center',
      );
    } else if (id === 'harmonic') {
      const actual = p.A * Math.cos(p.omega * p.t),
        amplitude = 65,
        period = TAU / p.omega;
      g.line(90, 270, 910, 270, C.dim);
      g.path(
        sample(300, (k) => [
          100 + k * 800,
          270 - (p.A / 3) * amplitude * Math.cos(p.omega * k * 10),
        ]),
        C.lime,
        2,
      );
      const x = 100 + (p.t / 10) * 800,
        y = 270 - (actual / 3) * amplitude;
      g.line(x, 155, x, 390, C.amber, 1, [4, 5]);
      g.body(x, y, 9);
      g.text(100, 125, 'TIME SELECTS A POINT ON THE OSCILLATION', C.ice, 14);
      g.text(900, 425, `T = ${number(period)} s`, C.amber, 18, 'right');
      g.text(100, 425, `selected t = ${number(p.t)} s`, C.ice, 18);
    } else {
      const wavelength =
          id === 'wave-speed'
            ? p.lambda
            : id === 'photon'
              ? p.lambda / 180
              : id === 'period'
                ? 1 / p.f
                : 2,
        frequency =
          id === 'photon' ? 3 / wavelength : id === 'wave-speed' || id === 'period' ? p.f : 1,
        speed = id === 'photon' ? 3 : frequency * wavelength,
        span = id === 'period' ? 3 * wavelength : 6;
      const y = (x: number) => 270 - 70 * Math.sin(TAU * (x / wavelength - frequency * t * 0.2));
      g.line(90, 270, 910, 270, C.dim);
      g.path(
        sample(500, (k) => [100 + k * 800, y(k * span)]),
        id === 'photon' ? `hsl(${270 - ((p.lambda - 380) / 370) * 270} 70% 72%)` : C.lime,
        2,
      );
      for (let i = 0; i < 90; i++) {
        const x = (i / 89) * span;
        g.circle(100 + (x / span) * 800, y(x), 1.2, C.ice, true, 0.35);
      }
      const marker = (t * speed * 0.2) % span;
      g.body(100 + (marker / span) * 800, y(marker), 7, C.ice);
      g.dimension(
        150,
        405,
        150 + Math.min(700, (wavelength / span) * 800),
        id === 'photon'
          ? `λ = ${number(p.lambda)} nm`
          : id === 'period'
            ? `T = ${number(v)} s`
            : `λ = ${number(p.lambda)} m`,
      );
      g.text(
        100,
        125,
        id === 'photon'
          ? 'SHORTER WAVELENGTH → MORE ENERGY PER PHOTON'
          : id === 'period'
            ? 'MORE CYCLES PER SECOND → LESS TIME PER CYCLE'
            : 'ONE WAVELENGTH TRAVELLED PER CYCLE',
        C.ice,
        14,
      );
    }
    return true;
  }
  if (['ohm', 'electric-power', 'capacitance', 'capacitor-energy', 'rc'].includes(id)) {
    const capacitor = ['capacitance', 'capacitor-energy', 'rc'].includes(id),
      voltage = id === 'rc' ? v : p.V,
      current = id === 'ohm' ? v : (p.I ?? (id === 'rc' ? v / (p.R * 1000) : 0)),
      q = id === 'capacitance' ? v : id === 'capacitor-energy' ? p.C * p.V : voltage * 10;
    const top = 185,
      bottom = 365;
    g.line(200, top, 450, top, C.ice, 2);
    g.line(550, top, 800, top, C.ice, 2);
    g.line(800, top, 800, bottom, C.ice, 2);
    g.line(800, bottom, 200, bottom, C.ice, 2);
    g.line(200, top, 200, 245, C.ice, 2);
    g.line(200, 305, 200, bottom, C.ice, 2);
    if (id === 'rc') {
      g.path(
        [
          [200, 245],
          [185, 255],
          [215, 265],
          [185, 275],
          [215, 285],
          [200, 305],
        ],
        C.lime,
        2,
      );
    } else {
      g.line(170, 255, 230, 255, C.amber, 4);
      g.line(183, 294, 217, 294, C.amber, 4);
    }
    if (capacitor) {
      g.line(475, 140, 475, 230, C.lime, 4);
      g.line(525, 140, 525, 230, C.ice, 4);
      g.line(450, top, 475, top, C.lime, 2);
      g.line(525, top, 550, top, C.ice, 2);
      for (let i = 0; i < 8; i++) {
        const y = 150 + i * 10;
        g.circle(466, y, 1.5, C.lime, true, Math.min(1, q / 100));
        g.circle(534, y, 1.5, C.ice, true, Math.min(1, q / 100));
      }
      if (voltage > 0)
        for (let i = 0; i < 6; i++) g.arrow(485, 150 + i * 14, 515, 150 + i * 14, C.text, 1);
    } else
      g.path(
        [
          [450, top],
          ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(
            (i) => [450 + i * 12.5, top + (i % 2 ? -15 : 15)] as [number, number],
          ),
          [550, top],
        ],
        C.lime,
        2,
      );
    const moving = id === 'ohm' || id === 'electric-power' || id === 'rc';
    if (moving && current > 0) {
      for (let i = 0; i < 18; i++) {
        const u = (i / 18 + t * Math.min(0.3, current * 0.05)) % 1;
        let x: number, y: number;
        if (u < 0.4) {
          x = 200 + (u / 0.4) * 600;
          y = bottom;
        } else if (u < 0.5) {
          x = 800;
          y = bottom - ((u - 0.4) / 0.1) * 180;
        } else if (u < 0.9) {
          x = 800 - ((u - 0.5) / 0.4) * 600;
          y = top;
        } else {
          x = 200;
          y = top + ((u - 0.9) / 0.1) * 180;
        }
        if (!(capacitor && y === top && x > 450 && x < 550)) g.circle(x, y, 2, C.lime, true, 0.8);
      }
    }
    g.text(200, 420, `${number(voltage)} V`, C.amber, 18, 'center');
    g.text(
      800,
      420,
      id === 'ohm'
        ? `${number(p.R)} Ω`
        : id === 'electric-power'
          ? `${number(p.I)} A`
          : `${number(p.C)} μF`,
      C.ice,
      18,
      'center',
    );
    g.text(
      500,
      125,
      id === 'rc'
        ? 'DISCHARGE · VOLTAGE FALLS EXPONENTIALLY'
        : capacitor
          ? 'SEPARATED CHARGE · STORED ELECTRIC ENERGY'
          : 'VOLTAGE DRIVES A CURRENT THROUGH THE CIRCUIT',
      C.ice,
      14,
      'center',
    );
    if (id === 'electric-power') {
      g.glow(500, 185, 90, C.amber);
      g.text(500, 325, `${number(v)} joules each second`, C.text, 18, 'center');
    }
    if (id === 'rc') {
      const tau = p.R * 1000 * p.C * 1e-6;
      g.text(500, 325, `τ = RC = ${number(tau)} s`, C.text, 19, 'center');
      g.text(500, 447, `At one τ, voltage is ${number(12 / Math.E)} V.`, C.dim, 14, 'center');
    }
    if (id === 'capacitor-energy') {
      g.text(500, 325, `${number(v)} mJ stored`, C.text, 20, 'center');
      g.glow(500, 185, 100, C.ice);
    }
    if (id === 'capacitance')
      g.text(500, 325, `${number(q)} μC separated charge`, C.text, 20, 'center');
    if (reference && id === 'ohm')
      g.text(
        500,
        447,
        `Pinned current: ${number(f.calculate(reference))} A`,
        C.amber,
        14,
        'center',
      );
    return true;
  }
  if (['coulomb', 'electric-field', 'light-intensity'].includes(id)) {
    const cx = 500,
      cy = 280;
    if (id === 'coulomb') {
      const gap = 120 + p.r * 80,
        x1 = 500 - gap / 2,
        x2 = 500 + gap / 2,
        force = f.calculate(p),
        len = clamp(Math.log1p(Math.abs(force) * 1e5) * 13, 0, 150);
      const nx = 70,
        ny = 34,
        scale = gap / p.r,
        base = Math.max(0.01, (Math.abs(p.q1) + Math.abs(p.q2)) / p.r);
      const grid = Array.from({ length: ny + 1 }, (_, j) =>
        Array.from({ length: nx + 1 }, (_, i) => {
          const x = 100 + (i * 800) / nx,
            y = 150 + (j * 280) / ny,
            d1 = Math.max(0.04, Math.hypot(x - x1, y - cy) / scale),
            d2 = Math.max(0.04, Math.hypot(x - x2, y - cy) / scale);
          return Math.asinh((p.q1 / d1 + p.q2 / d2) / base);
        }),
      );
      for (const level of [-2, -1.4, -0.9, -0.5, -0.2, 0, 0.2, 0.5, 0.9, 1.4, 2]) {
        g.ctx.beginPath();
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++) {
            const hits: [number, number][] = [],
              values = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]],
              coords = [
                [100 + (i * 800) / nx, 150 + (j * 280) / ny],
                [100 + ((i + 1) * 800) / nx, 150 + (j * 280) / ny],
                [100 + ((i + 1) * 800) / nx, 150 + ((j + 1) * 280) / ny],
                [100 + (i * 800) / nx, 150 + ((j + 1) * 280) / ny],
              ];
            for (let k = 0; k < 4; k++) {
              const n = (k + 1) % 4;
              if (values[k] < level !== values[n] < level) {
                const q = (level - values[k]) / (values[n] - values[k]);
                hits.push([
                  coords[k][0] + q * (coords[n][0] - coords[k][0]),
                  coords[k][1] + q * (coords[n][1] - coords[k][1]),
                ]);
              }
            }
            for (let k = 0; k + 1 < hits.length; k += 2) {
              g.ctx.moveTo(...hits[k]);
              g.ctx.lineTo(...hits[k + 1]);
            }
          }
        g.ctx.strokeStyle = C.violet;
        g.ctx.globalAlpha = 0.25;
        g.ctx.lineWidth = 1;
        g.ctx.stroke();
        g.ctx.globalAlpha = 1;
      }
      g.body(x1, cy, 25 + Math.abs(p.q1) * 4);
      g.body(x2, cy, 25 + Math.abs(p.q2) * 4, C.ice);
      const sign = force >= 0 ? -1 : 1;
      if (force !== 0) {
        g.arrow(x1, cy - 10, x1 + sign * len, cy - 10);
        g.arrow(x2, cy + 10, x2 - sign * len, cy + 10);
      }
      g.text(x1, 365, `q₁ = ${number(p.q1)} μC`, C.lime, 17, 'center');
      g.text(x2, 365, `q₂ = ${number(p.q2)} μC`, C.ice, 17, 'center');
      g.dimension(x1, 410, x2, `r = ${number(p.r)} m`);
      g.text(
        100,
        125,
        force === 0
          ? 'ZERO CHARGE · NO ELECTROSTATIC FORCE'
          : force > 0
            ? 'LIKE CHARGES REPEL'
            : 'UNLIKE CHARGES ATTRACT',
        C.ice,
        14,
      );
      g.text(900, 165, `|F| = ${number(Math.abs(force))} N`, C.text, 18, 'right');
    } else {
      const r = 55 + p.r * 22;
      g.field(cx, cy, [50, 80, 115, 150, 190]);
      g.body(cx, cy, 26, id === 'light-intensity' ? C.amber : C.lime);
      g.circle(cx, cy, r, C.ice, false, 0.7);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        const inward = id === 'electric-field' && p.Q < 0;
        if (v !== 0)
          g.arrow(
            cx + Math.cos(a) * (inward ? 190 : 70),
            cy + Math.sin(a) * (inward ? 190 : 70),
            cx + Math.cos(a) * (inward ? 145 : 115),
            cy + Math.sin(a) * (inward ? 145 : 115),
            id === 'light-intensity' ? C.amber : C.ice,
            1,
          );
        if (id === 'light-intensity') {
          const rr = 40 + ((t * 55 + i * 7) % 160);
          g.circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.3, C.amber, true, 0.7);
        }
      }
      g.dimension(cx, 435, cx + r, `r = ${number(p.r)} m`);
      g.text(
        100,
        125,
        id === 'light-intensity'
          ? 'THE SAME POWER SPREADS OVER A LARGER SPHERE'
          : 'FIELD STRENGTH FALLS WITH DISTANCE SQUARED',
        C.ice,
        14,
      );
      g.text(
        900,
        165,
        id === 'light-intensity'
          ? `sphere area = ${number(4 * Math.PI * p.r * p.r)} m²`
          : p.Q < 0
            ? 'FIELD POINTS INWARD'
            : p.Q > 0
              ? 'FIELD POINTS OUTWARD'
              : 'ZERO SOURCE CHARGE',
        C.ice,
        16,
        'right',
      );
    }
    return true;
  }
  return false;
}
