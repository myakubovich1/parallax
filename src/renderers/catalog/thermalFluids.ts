import { C } from '../palette';
import { type Paint, type SceneState, number, clamp } from './paint';
export function thermalFluids(g: Paint, { f, p, t }: SceneState): boolean {
  const id = f.id,
    v = f.calculate(p);
  if (['ideal-gas', 'boyle', 'charles'].includes(id)) {
    const volume = id === 'ideal-gas' ? p.V : id === 'boyle' ? p.V2 : v,
      temperature = id === 'ideal-gas' ? p.T : id === 'charles' ? p.T2 : 300;
    const height = clamp((volume / 30) * 220, 35, 260),
      floor = 415,
      top = floor - height;
    g.line(300, 140, 300, 415, C.ice, 3);
    g.line(700, 140, 700, 415, C.ice, 3);
    g.line(300, floor, 700, floor, C.ice, 3);
    g.line(300, top, 700, top, C.lime, 5);
    g.rect(480, Math.max(145, top - 45), 40, Math.min(45, Math.max(1, top - 145)), C.lime, true);
    const count = Math.round(id === 'ideal-gas' ? 20 + p.n * 20 : 60),
      speed = Math.sqrt(temperature / 300);
    for (let i = 0; i < count; i++) {
      const reflect = (q: number) => 1 - Math.abs((q % 2) - 1);
      const x = 310 + reflect(i * 0.618 + t * speed * 0.15) * 380,
        y = top + 10 + reflect(i * 0.414 + t * speed * 0.19) * (height - 20);
      g.circle(x, y, 1.6, i % 3 ? C.ice : C.lime, true, 0.8);
    }
    g.text(
      100,
      125,
      id === 'boyle'
        ? 'LESS VOLUME · MORE PRESSURE'
        : id === 'charles'
          ? 'WARMER GAS EXPANDS AT CONSTANT PRESSURE'
          : 'TEMPERATURE, VOLUME AND AMOUNT SET THE PRESSURE',
      C.ice,
      14,
    );
    g.text(100, 190, `T = ${number(temperature)} K`, C.amber, 18);
    g.text(900, 190, `V = ${number(volume)} L`, C.ice, 18, 'right');
    g.text(
      500,
      447,
      id === 'boyle'
        ? `P₁V₁ = P₂V₂ = ${number(p.P1 * p.V1)} kPa·L`
        : 'Particle motion is schematic; calculations use absolute temperature.',
      C.dim,
      14,
      'center',
    );
    return true;
  }
  if (id === 'heat' || id === 'cooling') {
    const temp = id === 'heat' ? 20 + p.dT : v;
    g.line(325, 150, 325, 390, C.ice, 3);
    g.line(675, 150, 675, 390, C.ice, 3);
    g.line(325, 390, 675, 390, C.ice, 3);
    g.ctx.fillStyle = C.ice + '14';
    g.ctx.fillRect(327, 230, 346, 158);
    for (let i = 0; i < 70; i++) {
      const x = 340 + ((i * 71) % 315),
        y = 245 + ((i * 43) % 125);
      g.circle(
        x + Math.sin(t * Math.sqrt(Math.max(temp, 1) / 20) + i) * 3,
        y,
        1,
        C.ice,
        true,
        0.65,
      );
    }
    const thermometerX = 775;
    g.circle(thermometerX, 375, 17, C.amber, true, 0.6);
    g.line(thermometerX, 170, thermometerX, 375, C.dim, 10);
    g.line(thermometerX, 375, thermometerX, 375 - clamp((temp - 20) / 100, 0, 1) * 200, C.amber, 6);
    g.text(820, 260, `${number(temp)} °C`, C.amber, 18);
    if (id === 'heat') {
      for (let i = 0; i < 7; i++) g.arrow(360 + i * 45, 430, 360 + i * 45, 400, C.amber, 1);
      g.text(100, 125, 'HEAT ENTERS · TEMPERATURE RISES', C.ice, 14);
      g.text(100, 190, `water mass = ${number(p.m)} kg`, C.ice, 17);
      g.text(500, 447, `Q = ${number(v)} kJ for ΔT = ${number(p.dT)} K`, C.text, 17, 'center');
    } else {
      for (let i = 0; i < 6; i++)
        g.arrow(350 + i * 60, 220, 350 + i * 60, 220 - (70 * (v - 20)) / (p.T0 - 20), C.amber, 1);
      g.text(100, 125, 'COOLING SLOWS AS THE TEMPERATURE GAP SHRINKS', C.ice, 14);
      g.text(100, 190, `room = 20 °C`, C.ice, 17);
      g.text(500, 447, `remaining temperature gap = ${number(v - 20)} °C`, C.text, 17, 'center');
    }
    return true;
  }
  if (['density', 'hydrostatic', 'buoyancy'].includes(id)) {
    const surface = 205;
    g.line(310, 145, 310, 415, C.ice, 2);
    g.line(690, 145, 690, 415, C.ice, 2);
    g.line(310, 415, 690, 415, C.ice, 2);
    g.ctx.fillStyle = C.ice + '12';
    g.ctx.fillRect(312, surface, 376, 208);
    for (let i = 0; i < 45; i++) {
      const x = 320 + i * 8.1,
        y = surface + Math.sin(i * 0.4 + t * 0.5) * 2;
      g.circle(x, y, 1, C.ice, true, 0.7);
    }
    if (id === 'density') {
      const side = 45 + Math.cbrt(p.V) * 25;
      g.rect(500 - side / 2, 270, side, side, C.lime, true);
      const count = Math.round(p.m * 4);
      for (let i = 0; i < count; i++)
        g.circle(
          500 - side / 2 + 5 + ((i * 17) % (side - 10)),
          275 + ((i * 31) % (side - 10)),
          1,
          C.lime,
          true,
          0.7,
        );
      g.text(100, 125, 'MASS PACKED INTO A GIVEN VOLUME', C.ice, 14);
      g.text(100, 190, `m = ${number(p.m)} kg`, C.lime, 18);
      g.text(900, 190, `V = ${number(p.V)} L`, C.ice, 18, 'right');
    }
    if (id === 'hydrostatic') {
      const y = surface + 30 + p.h * 7;
      g.circle(500, y, 9, C.lime, true);
      const length = 10 + Math.log1p(v) * 14;
      g.arrow(430 - length, y, 475, y, C.lime);
      g.arrow(570 + length, y, 525, y, C.lime);
      g.line(750, surface, 750, y, C.amber);
      g.line(740, surface, 760, surface, C.amber);
      g.line(740, y, 760, y, C.amber);
      g.text(800, 300, `h = ${number(p.h)} m`, C.amber, 17);
      g.text(100, 125, 'A DEEPER POINT SUPPORTS A TALLER WATER COLUMN', C.ice, 14);
    }
    if (id === 'buoyancy') {
      const side = 40 + Math.cbrt(p.V) * 25;
      g.rect(500 - side / 2, 270, side, side, C.lime, true);
      g.arrow(500, 390, 500, 290, C.lime, 3);
      g.rect(790, 280, 65, 110, C.ice);
      g.line(795, 385, 850, 385, C.amber, Math.min(50, p.V * 5));
      g.text(100, 125, 'UPWARD FORCE = WEIGHT OF DISPLACED FLUID', C.ice, 14);
      g.text(820, 240, 'DISPLACED', C.ice, 13, 'center');
      g.text(820, 425, `${number(p.V)} L`, C.ice, 17, 'center');
    }
    g.text(
      500,
      447,
      id === 'hydrostatic'
        ? 'Gauge pressure excludes the atmosphere.'
        : id === 'density'
          ? 'Dotted solid is a schematic sample, not a float/sink simulation.'
          : 'The object is held submerged; force is shown, not free motion.',
      C.dim,
      14,
      'center',
    );
    return true;
  }
  if (id === 'continuity') {
    const left = clamp(p.A1 * 4, 12, 80),
      right = clamp(p.A2 * 4, 12, 80),
      cy = 285;
    g.path(
      [
        [120, cy - left],
        [380, cy - left],
        [620, cy - right],
        [880, cy - right],
      ],
      C.ice,
      2,
    );
    g.path(
      [
        [120, cy + left],
        [380, cy + left],
        [620, cy + right],
        [880, cy + right],
      ],
      C.ice,
      2,
    );
    for (let i = 0; i < 60; i++) {
      const v1 = 260 * p.A1,
        vm = 120 * (p.A1 + p.A2),
        total = v1 + vm + 260 * p.A2,
        volume = ((i / 60) * total + t * 20 * p.v1 * p.A1) % total;
      let x;
      if (volume < v1) x = 120 + volume / p.A1;
      else if (volume < v1 + vm) {
        const slope = (p.A2 - p.A1) / 240,
          relative = volume - v1;
        x =
          380 +
          (Math.abs(slope) < 1e-9
            ? relative / p.A1
            : (-p.A1 + Math.sqrt(p.A1 * p.A1 + 2 * slope * relative)) / slope);
      } else x = 620 + (volume - v1 - vm) / p.A2;
      const h = x < 380 ? left : x > 620 ? right : left + ((right - left) * (x - 380)) / 240;
      g.circle(x, cy + Math.sin(i * 2.4) * h * 0.8, 1.3, C.lime, true, 0.6);
    }
    g.arrow(170, cy, 170 + p.v1 * 20, cy, C.lime);
    g.arrow(670, cy, 670 + Math.min(v * 10, 190), cy, C.ice);
    g.text(200, 175, `A₁ = ${number(p.A1)} cm²`, C.lime, 18);
    g.text(800, 175, `A₂ = ${number(p.A2)} cm²`, C.ice, 18, 'right');
    g.text(200, 410, `v₁ = ${number(p.v1)} m/s`, C.lime, 18);
    g.text(800, 410, `v₂ = ${number(v)} m/s`, C.ice, 18, 'right');
    g.text(100, 125, 'ONE FLOW RATE · DIFFERENT CROSS-SECTIONS', C.ice, 14);
    g.text(500, 447, `A₁v₁ = A₂v₂ = ${number(p.A1 * p.v1)} cm²·m/s`, C.text, 17, 'center');
    return true;
  }
  return false;
}
