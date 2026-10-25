import { C } from '../palette';
import { type Paint, type SceneState, sample, clamp, number } from './paint';
export function mechanics(g: Paint, { f, p, t, reference }: SceneState): boolean {
  const id = f.id,
    v = f.calculate(p),
    cycle = (t / 6) % 1;
  const track = (y = 340) => {
    g.line(100, y, 900, y, C.dim, 1);
    for (let i = 0; i <= 10; i++) {
      g.line(100 + i * 80, y - 5, 100 + i * 80, y + 5, C.dim);
    }
  };
  const energy = (value: number, max: number, label: string, y = 400, color: string = C.lime) => {
    g.text(100, y - 12, label, color, 13);
    g.line(100, y, 900, y, C.rule, 14);
    g.line(100, y, 100 + 800 * clamp(value / max, 0, 1), y, color, 10);
  };
  switch (id) {
    case 'newton': {
      const u = t % 4,
        distance = 0.5 * p.a * u * u,
        scale = 8,
        x = 140 + distance * scale;
      track();
      for (let i = 1; i <= 12; i++) {
        const ti = Math.max(0, u - i * 0.12);
        g.circle(140 + 0.5 * p.a * ti * ti * scale, 310, 2, C.lime, true, 0.5 * (1 - i / 13));
      }
      g.rect(x - 24, 280, 48 + Math.sqrt(p.m) * 4, 48, C.lime, true);
      g.arrow(x, 245, x + Math.log1p(v) * 35, 245, C.lime);
      g.text(100, 140, 'CONSTANT NET FORCE → ACCELERATING BODY', C.ice, 14);
      g.text(890, 175, `a = ${number(p.a)} m/s²`, C.ice, 17, 'right');
      g.text(100, 395, 'Distance between successive positions grows with time.', C.dim, 14);
      break;
    }
    case 'kinetic': {
      const speed = p.v,
        phase = ((t * speed) / 45) % 1,
        slow = ((t * speed) / 90) % 1;
      g.text(100, 135, 'SAME MASS. TWICE THE SPEED. FOUR TIMES THE ENERGY.', C.ice, 14);
      for (const [i, factor] of [1, 0.5].entries()) {
        const y = 235 + i * 125,
          x = 130 + (i ? slow : phase) * 670;
        g.line(100, y + 35, 900, y + 35, C.rule);
        for (let j = 1; j < 20; j++)
          g.circle(x - j * 4 * factor, y, 1.2, C.lime, true, Math.max(0, 1 - j / 20) * 0.4);
        g.body(x, y, 16 + Math.cbrt(p.m) * 6, i ? C.ice : C.lime);
        g.arrow(760, y - 12, 760 + speed * factor * 4, y - 12, i ? C.ice : C.lime);
        g.text(110, y - 50, `${number(speed * factor)} m/s`, i ? C.ice : C.lime, 16);
        g.text(900, y - 50, `${number(v * factor * factor)} J`, i ? C.ice : C.lime, 18, 'right');
      }
      g.text(500, 430, 'Reference speed is v/2; reference energy is E/4.', C.dim, 14, 'center');
      break;
    }
    case 'potential': {
      const y = 400 - p.h * 10;
      g.line(100, 400, 900, 400, C.dim, 2);
      g.line(510, 120, 510, 400, C.dim, 1, [4, 5]);
      g.rect(478, y - 45, 64, 45, C.lime, true);
      g.arrow(510, y + 10, 510, y + 55, C.amber);
      g.dimension(680, 430, 680, `h = ${number(p.h)} m`);
      g.line(680, 400, 680, y, C.amber);
      g.line(670, y, 690, y, C.amber);
      g.text(100, 140, 'LIFTING STORES GRAVITATIONAL ENERGY', C.ice, 14);
      g.text(100, 180, `Weight = ${number(p.m * 9.81)} N`, C.amber, 17);
      g.text(100, 430, 'Zero-energy reference level', C.dim, 14);
      break;
    }
    case 'momentum': {
      track();
      const x = 500 + Math.sign(p.v) * ((t * Math.abs(p.v) * 22) % 300);
      g.body(x, 290, 18 + Math.cbrt(p.m) * 7);
      g.arrow(x, 225, x + Math.sign(v) * Math.min(140, Math.log1p(Math.abs(v)) * 55), 225, C.lime);
      g.text(100, 140, 'MOMENTUM HAS A DIRECTION', C.ice, 14);
      g.text(100, 400, `p = ${number(v)} kg·m/s`, C.lime, 20);
      g.text(
        900,
        400,
        p.v < 0 ? '← negative velocity' : p.v > 0 ? 'positive velocity →' : 'at rest',
        C.ice,
        16,
        'right',
      );
      break;
    }
    case 'impulse': {
      const width = p.dt * 130;
      g.line(140, 390, 880, 390, C.dim);
      g.line(140, 390, 140, 135, C.dim);
      g.rect(140, 390 - p.F * 10, width, p.F * 10, C.lime, true);
      g.line(140 + width * cycle, 390 - p.F * 10, 140 + width * cycle, 390, C.ice, 2);
      g.text(170, 140, 'AREA UNDER A FORCE–TIME PULSE', C.ice, 14);
      g.text(880, 430, 'contact time / s', C.dim, 14, 'right');
      g.text(155 + width / 2, 340, `${number(v)} N·s`, C.text, 22, 'center');
      g.text(100, 435, `Δp = impulse = ${number(v)}`, C.amber, 16);
      break;
    }
    case 'work': {
      const distance = p.d * 55,
        x = 180 + cycle * distance,
        a = (p.theta * Math.PI) / 180;
      track(370);
      g.rect(x - 20, 315, 40, 48, C.lime, true);
      g.arrow(x, 300, x + Math.cos(a) * p.F * 6, 300 - Math.sin(a) * p.F * 6, C.lime);
      g.arrow(180, 405, 180 + distance, 405, C.ice);
      g.line(x, 300, x + Math.cos(a) * p.F * 6, 300, C.amber, 2, [5, 5]);
      g.text(100, 135, 'ONLY THE PARALLEL COMPONENT DOES WORK', C.ice, 14);
      g.text(900, 170, `F∥ = ${number(p.F * Math.cos(a))} N`, C.amber, 18, 'right');
      g.text(100, 445, `displacement = ${number(p.d)} m`, C.ice, 15);
      break;
    }
    case 'mechanical-power': {
      g.text(100, 135, 'THE SAME ENERGY, DELIVERED AT A DIFFERENT RATE', C.ice, 14);
      g.rect(140, 200, 130, 170, C.lime, true);
      g.rect(730, 200, 130, 170, C.ice, true);
      g.text(205, 410, 'ENERGY SOURCE', C.lime, 14, 'center');
      g.text(795, 410, 'RECEIVER', C.ice, 14, 'center');
      for (let i = 0; i < 16; i++) {
        const k = (t * Math.min(v / 100, 0.8) + i / 16) % 1;
        g.circle(290 + k * 420, 285 + Math.sin(i * 2.4) * 25, 2.5, C.lime, true, 0.8);
      }
      g.arrow(300, 175, 700, 175);
      g.text(500, 230, `${number(v)} joules / second`, C.text, 21, 'center');
      break;
    }
    case 'hooke':
    case 'elastic': {
      const end = 500 + p.x * 110;
      g.rect(115, 175, 18, 185, C.dim);
      g.line(500, 140, 500, 400, C.amber, 1, [4, 6]);
      g.spring(135, end - 35, 270);
      g.rect(end - 35, 235, 70, 70, C.lime, true);
      g.dimension(500, 420, end, `x = ${number(p.x)} m`);
      if (p.x !== 0)
        g.arrow(
          end,
          190,
          end - Math.sign(p.x) * Math.min(170, Math.log1p(p.k * Math.abs(p.x)) * 38),
          190,
          C.lime,
        );
      g.text(
        100,
        125,
        id === 'hooke'
          ? 'RESTORING FORCE POINTS TOWARD EQUILIBRIUM'
          : 'EQUAL COMPRESSION AND EXTENSION STORE EQUAL ENERGY',
        C.ice,
        14,
      );
      if (reference) {
        const rx = 500 + reference.x * 110;
        g.line(rx, 225, rx, 315, C.amber, 1, [3, 4]);
      }
      if (id === 'elastic') energy(v, 0.5 * p.k * 4, 'STORED SPRING ENERGY', 380);
      break;
    }
    case 'projectile': {
      const range = v,
        h = (p.v ** 2 * Math.sin((p.theta * Math.PI) / 180) ** 2) / (2 * 9.81),
        scale = Math.min(700 / Math.max(range, 1), 240 / Math.max(h, 1));
      g.line(100, 410, 900, 410, C.dim);
      const point = (q: number): [number, number] => [
        100 + range * q * scale,
        410 - 4 * h * q * (1 - q) * scale,
      ];
      g.path(sample(100, point), C.violet, 1, 0.45);
      g.path(
        sample(55, (q) => point(q * cycle)),
        C.lime,
        2,
      );
      const [x, y] = point(cycle);
      g.body(x, y, 9);
      g.arrow(
        x,
        y,
        x + p.v * Math.cos((p.theta * Math.PI) / 180) * 2,
        y - p.v * Math.sin((p.theta * Math.PI) / 180) * (1 - 2 * cycle) * 2,
        C.ice,
      );
      g.dimension(100, 438, 100 + range * scale, `R = ${number(range)} m`);
      g.text(100, 130, 'HORIZONTAL AND VERTICAL MOTION, CONNECTED', C.ice, 14);
      g.text(900, 165, `peak = ${number(h)} m`, C.amber, 17, 'right');
      g.text(
        100,
        165,
        `flight = ${number((2 * p.v * Math.sin((p.theta * Math.PI) / 180)) / 9.81)} s`,
        C.ice,
        17,
      );
      break;
    }
    case 'acceleration': {
      const time = p.t,
        scale = 700 / 350;
      track(370);
      g.path(
        sample(30, (q) => [130 + (p.u * q * time + 0.5 * p.a * (q * time) ** 2) * scale, 330]),
        C.violet,
        1,
        0.5,
      );
      const local = cycle * time;
      g.body(130 + (p.u * local + 0.5 * p.a * local * local) * scale, 330, 24);
      g.text(100, 135, 'A LINEAR START + A QUADRATIC ACCELERATION TERM', C.ice, 14);
      g.text(100, 180, `ut = ${number(p.u * time)} m`, C.lime, 18);
      g.text(900, 180, `½at² = ${number(0.5 * p.a * time * time)} m`, C.ice, 18, 'right');
      g.text(
        500,
        440,
        `preview t = ${number(local)} s of selected ${number(time)} s`,
        C.amber,
        14,
        'center',
      );
      break;
    }
    case 'centripetal':
    case 'orbital': {
      const radius = id === 'orbital' ? 60 + ((p.r - 7) / 33) * 75 : 50 + p.r * 8,
        a = t * (id === 'centripetal' ? p.v / p.r : 1 / Math.sqrt(p.r / 10) ** 3);
      g.field(500, 275, [50, 90, 130, 180, 210]);
      g.circle(500, 275, radius, C.violet, false, 0.55);
      const x = 500 + radius * Math.cos(a),
        y = 275 + radius * Math.sin(a);
      if (id === 'orbital') g.body(500, 275, 24 + Math.cbrt(p.M) * 7, C.ice);
      else g.circle(500, 275, 3, C.ice, true);
      g.body(x, y, 15);
      if (id === 'centripetal' && p.v > 0) {
        g.arrow(x, y, x - (x - 500) * 0.55, y - (y - 275) * 0.55, C.lime);
        g.arrow(x, y, x - Math.sin(a) * 65, y + Math.cos(a) * 65, C.ice);
      }
      g.text(
        100,
        125,
        id === 'orbital'
          ? 'A LARGER ORBIT TAKES LONGER TO COMPLETE'
          : 'INWARD FORCE CHANGES DIRECTION, NOT SPEED',
        C.ice,
        14,
      );
      g.text(
        100,
        435,
        id === 'orbital' ? `radius = ${number(p.r)} × 10⁶ m` : `radius = ${number(p.r)} m`,
        C.amber,
        16,
      );
      break;
    }
    case 'torque': {
      const end = 200 + p.r * 170,
        a = (p.theta * Math.PI) / 180;
      g.line(200, 315, end, 315, C.ice, 8);
      g.body(200, 315, 16, C.ice);
      g.circle(200, 315, 80, C.violet, false, 0.25);
      g.arrow(end, 315, end + Math.cos(a) * p.F * 4, 315 - Math.sin(a) * p.F * 4, C.lime);
      g.line(end, 315, end, 315 - Math.sin(a) * p.F * 4, C.amber, 1, [4, 5]);
      g.dimension(200, 420, end, `lever arm = ${number(p.r)} m`);
      g.text(100, 125, 'THE PERPENDICULAR COMPONENT TURNS THE LEVER', C.ice, 14);
      g.text(900, 165, `F⊥ = ${number(p.F * Math.sin(a))} N`, C.amber, 18, 'right');
      break;
    }
    case 'mass-energy': {
      g.body(255, 275, 25 + Math.cbrt(p.m) * 22);
      g.text(255, 400, `${number(p.m)} μg rest mass`, C.lime, 18, 'center');
      g.text(500, 280, '≡', C.dim, 55, 'center');
      const count = Math.round(16 + p.m * 8);
      for (let i = 0; i < count; i++) {
        const x = 640 + (i % 10) * 20,
          y = 180 + Math.floor(i / 10) * 19;
        g.circle(x, y, 2, C.ice, true, 0.6);
      }
      g.text(745, 400, `${number(v)} MJ rest energy`, C.ice, 18, 'center');
      g.text(100, 125, 'TWO MEASURES OF THE SAME REST ENERGY', C.ice, 14);
      g.text(500, 447, 'Equivalence, not a literal conversion animation.', C.dim, 14, 'center');
      break;
    }
    case 'pendulum': {
      const length = 75 + p.L * 35,
        angle = 0.14 * Math.sin(t * Math.sqrt(p.g / p.L)),
        x = 500 + length * Math.sin(angle),
        y = 140 + length * Math.cos(angle);
      g.path(
        sample(65, (q) => [
          500 + length * Math.sin((q - 0.5) * 0.5),
          140 + length * Math.cos((q - 0.5) * 0.5),
        ]),
        C.violet,
        1,
        0.4,
      );
      g.circle(500, 140, 5, C.ice, true);
      g.line(500, 140, x, y, C.text, 2);
      g.body(x, y, 20);
      g.line(500, 140, 500, 420, C.amber, 1, [4, 6]);
      g.text(100, 125, 'LONGER STRING → LONGER PERIOD', C.ice, 14);
      g.text(900, 165, `L = ${number(p.L)} m`, C.amber, 18, 'right');
      g.text(500, 445, 'Small-angle oscillation; bob size is illustrative.', C.dim, 14, 'center');
      break;
    }
    default:
      return false;
  }
  return true;
}
