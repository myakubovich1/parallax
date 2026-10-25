import { C } from '../palette';
import { type Paint, type SceneState, number } from './paint';
export function opticsMath(g: Paint, { f, p, t, reference }: SceneState): boolean {
  const id = f.id,
    v = f.calculate(p);
  if (id === 'snell') {
    const x = 500,
      y = 280,
      a = (p.theta * Math.PI) / 180,
      b = ((Number.isFinite(v) ? v : p.theta) * Math.PI) / 180,
      reflected = !Number.isFinite(v),
      sign = reflected ? -1 : 1;
    g.ctx.fillStyle = C.ice + '0b';
    g.ctx.fillRect(100, y, 800, 165);
    g.line(100, y, 900, y, C.ice);
    g.line(x, 150, x, 430, C.dim, 1, [4, 6]);
    const start: [number, number] = [x - Math.sin(a) * 130, y - Math.cos(a) * 130],
      end: [number, number] = [x + Math.sin(b) * 130, y + sign * Math.cos(b) * 130];
    g.path([start, [x, y], end], C.lime, 2);
    g.circle(x, y, 4, C.text, true);
    for (let i = 0; i < 12; i++) {
      const z = (t * 0.4 + i / 12) % 1;
      if (z < 0.5) {
        const u = z * 2;
        g.circle(start[0] + (x - start[0]) * u, start[1] + (y - start[1]) * u, 2, C.lime, true);
      } else {
        const u = (z - 0.5) * 2;
        g.circle(x + (end[0] - x) * u, y + (end[1] - y) * u, 2, C.ice, true);
      }
    }
    g.text(
      100,
      125,
      reflected
        ? 'TOTAL INTERNAL REFLECTION · NO TRANSMITTED RAY'
        : 'REFRACTION · ANGLES MEASURED FROM THE NORMAL',
      C.ice,
      14,
    );
    g.text(130, 195, `n₁ = ${number(p.n1)}`, C.lime, 20);
    g.text(130, 365, `n₂ = ${number(p.n2)}`, C.ice, 20);
    g.text(870, 195, `θ₁ = ${number(p.theta)}°`, C.lime, 20, 'right');
    g.text(870, 365, reflected ? 'TIR' : `θ₂ = ${number(v)}°`, C.ice, 20, 'right');
    return true;
  }
  if (id === 'lens') {
    const u = p.u,
      scale = 700 / (u + v),
      lens = 100 + u * scale,
      y = 275,
      h = (35 * v) / u;
    g.line(80, y, 920, y, C.dim, 1, [4, 6]);
    g.path(
      [
        [lens, 145],
        [lens - 12, 190],
        [lens - 16, 275],
        [lens - 12, 360],
        [lens, 405],
        [lens + 12, 360],
        [lens + 16, 275],
        [lens + 12, 190],
        [lens, 145],
      ],
      C.ice,
      1.5,
    );
    g.glow(lens, y, 130, C.ice);
    g.arrow(100, y, 100, y - 35, C.lime, 3);
    g.arrow(800, y, 800, y + h, C.ice, 3);
    const rays: [[number, number], [number, number], [number, number]][] = [
      [
        [100, y - 35],
        [lens, y - 35],
        [800, y + h],
      ],
      [
        [100, y - 35],
        [lens, y],
        [800, y + h],
      ],
    ];
    rays.forEach((points, i) => {
      g.path(points, i ? C.amber : C.lime, 1.5);
      for (let j = 0; j < 8; j++) {
        const k = (t * 0.25 + j / 8) % 1,
          index = k < 0.5 ? 0 : 1,
          part = (k % 0.5) * 2;
        const a = points[index],
          b = points[index + 1];
        g.circle(
          a[0] + (b[0] - a[0]) * part,
          a[1] + (b[1] - a[1]) * part,
          1.5,
          i ? C.amber : C.lime,
          true,
        );
      }
    });
    g.dimension(100, 420, lens, 'u');
    g.dimension(lens, 420, 800, 'v');
    g.text(100, 125, 'TWO PRINCIPAL RAYS MEET AT AN INVERTED REAL IMAGE', C.ice, 14);
    g.text(100, 190, `u = ${number(u)} cm`, C.lime, 18);
    g.text(900, 190, `v = ${number(v)} cm`, C.ice, 18, 'right');
    g.text(900, 390, `magnification = ${number(-v / u)}`, C.amber, 16, 'right');
    return true;
  }
  if (id === 'pythagoras') {
    const scale = 14,
      A = p.a * scale,
      B = p.b * scale,
      x = 400 - A / 2,
      y = 290;
    g.path(
      [
        [x, y],
        [x + A, y],
        [x, y - B],
        [x, y],
      ],
      C.lime,
      2,
    );
    g.path(
      [
        [x, y - 18],
        [x + 18, y - 18],
        [x + 18, y],
      ],
      C.ice,
      1,
    );
    g.rect(x, y + 8, A, A, C.lime, true);
    g.rect(x - B - 8, y - B, B, B, C.ice, true);
    const angle = -Math.atan2(B, A),
      midX = x + A / 2,
      midY = y - B / 2;
    g.glow(midX, midY, 120);
    g.line(x + A, y, x, y - B, C.amber, 3);
    g.text(100, 125, 'THE AREAS ON THE TWO LEGS ADD TO c²', C.ice, 14);
    g.text(800, 235, `a² = ${number(p.a * p.a)}`, C.lime, 20, 'right');
    g.text(800, 290, `b² = ${number(p.b * p.b)}`, C.ice, 20, 'right');
    g.text(800, 350, `c² = ${number(v * v)}`, C.amber, 20, 'right');
    g.text(500, 445, `a² + b² = ${number(p.a * p.a + p.b * p.b)} = c²`, C.text, 18, 'center');
    void angle;
    return true;
  }
  if (id === 'circle') {
    const r = 25 + p.r * 12,
      cx = 360,
      cy = 280;
    g.body(cx, cy, r);
    g.arrow(cx, cy, cx + r, cy, C.amber);
    g.circle(cx, cy, r, C.lime);
    g.text(100, 125, 'RADIUS DOUBLES · AREA QUADRUPLES', C.ice, 14);
    g.text(800, 225, `r = ${number(p.r)} units`, C.amber, 20, 'right');
    g.text(800, 290, `A = ${number(v)} units²`, C.lime, 22, 'right');
    if (reference) {
      const rr = 45 + reference.r * 13;
      g.circle(cx, cy, rr, C.amber, false, 0.5);
    }
    g.text(800, 370, 'Area ∝ radius²', C.dim, 16, 'right');
    return true;
  }
  if (['quadratic', 'quadratic-roots', 'exponential', 'compound', 'logistic'].includes(id)) {
    const d = f.params[0],
      x1 = 120,
      x2 = 880,
      top = 170,
      bottom = 405,
      points = Array.from({ length: 241 }, (_, i) => {
        const x = d.min + ((d.max - d.min) * i) / 240;
        return { x, y: f.calculate({ ...p, [d.id]: x }) };
      }),
      finite = points.filter((pt) => Number.isFinite(pt.y));
    let lo = Math.min(0, ...finite.map((pt) => pt.y)),
      hi = Math.max(0, ...finite.map((pt) => pt.y));
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
    const xx = (x: number) => x1 + ((x - d.min) / (d.max - d.min)) * (x2 - x1),
      yy = (y: number) => bottom - ((y - lo) / (hi - lo)) * (bottom - top);
    g.line(x1, bottom, x2, bottom, C.dim);
    g.line(x1, top, x1, bottom, C.dim);
    for (let i = 0; i <= 4; i++) {
      const y = lo + ((hi - lo) * i) / 4;
      g.line(x1, yy(y), x2, yy(y), C.rule, 0.6);
      g.text(
        x1 - 10,
        yy(y) + 4,
        Math.abs(y) >= 1e4 ? y.toExponential(1) : number(Number(y.toPrecision(3))),
        C.dim,
        12,
        'right',
      );
      const x = d.min + ((d.max - d.min) * i) / 4;
      g.text(xx(x), 435, number(x), C.dim, 12, 'center');
    }
    const draw = (values: typeof p, color: string, width: number) => {
      g.ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 240; i++) {
        const x = d.min + ((d.max - d.min) * i) / 240,
          y = f.calculate({ ...values, [d.id]: x });
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        if (!pen) {
          g.ctx.moveTo(xx(x), yy(y));
          pen = true;
        } else g.ctx.lineTo(xx(x), yy(y));
      }
      g.ctx.strokeStyle = color;
      g.ctx.lineWidth = width;
      g.ctx.stroke();
    };
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.rect(x1, top, x2 - x1, bottom - top);
    g.ctx.clip();
    if (reference) draw(reference, C.amber, 1);
    draw(p, C.lime, 2.5);
    g.ctx.restore();
    if (Number.isFinite(v)) {
      g.line(xx(p[d.id]), bottom, xx(p[d.id]), yy(v), C.ice, 1, [4, 5]);
      g.body(xx(p[d.id]), yy(v), 5, C.ice);
    }
    const trace = d.min + (d.max - d.min) * ((t / 9) % 1),
      traceValue = f.calculate({ ...p, [d.id]: trace });
    if (Number.isFinite(traceValue)) g.circle(xx(trace), yy(traceValue), 3, C.amber, true);
    g.text(
      100,
      125,
      id === 'quadratic'
        ? 'CURVATURE, SLOPE AND OFFSET'
        : id === 'quadratic-roots'
          ? 'THE DISCRIMINANT CONTROLS THE REAL ROOTS'
          : id === 'exponential'
            ? 'A CONSTANT FRACTIONAL RATE COMPOUNDS'
            : id === 'compound'
              ? 'INTEREST EARNS INTEREST'
              : 'GROWTH SLOWS NEAR THE CARRYING CAPACITY',
      C.ice,
      14,
    );
    g.text(900, 155, `${d.symbol} = ${number(p[d.id])} → ${number(v)}`, C.ice, 16, 'right');
    if (id === 'logistic') g.line(x1, yy(p.K), x2, yy(p.K), C.amber, 1, [4, 5]);
    if (id === 'quadratic-roots')
      g.text(
        500,
        450,
        `discriminant = ${number(p.b * p.b - 4 * p.a * p.c)} · x− = ${number((-p.b - Math.sqrt(p.b * p.b - 4 * p.a * p.c)) / (2 * p.a))}`,
        C.amber,
        14,
        'center',
      );
    else
      g.text(
        500,
        455,
        `Amber cursor traces the input range · selected ${d.symbol} stays fixed`,
        C.dim,
        13,
        'center',
      );
    return true;
  }
  return false;
}
