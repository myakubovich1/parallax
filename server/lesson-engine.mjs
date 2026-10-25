// Small arithmetic language shared by the server and UI. No eval or generated code.
const BASE = {
  1: [1, [0, 0, 0]],
  '': [1, [0, 0, 0]],
  rad: [1, [0, 0, 0]],
  kg: [1, [1, 0, 0]],
  g: [0.001, [1, 0, 0]],
  mg: [0.000001, [1, 0, 0]],
  m: [1, [0, 1, 0]],
  cm: [0.01, [0, 1, 0]],
  mm: [0.001, [0, 1, 0]],
  km: [1000, [0, 1, 0]],
  s: [1, [0, 0, 1]],
  ms: [0.001, [0, 0, 1]],
  min: [60, [0, 0, 1]],
  Hz: [1, [0, 0, -1]],
  N: [1, [1, 1, -2]],
  J: [1, [1, 2, -2]],
  W: [1, [1, 2, -3]],
  Pa: [1, [1, -1, -2]],
  kJ: [1e3, [1, 2, -2]],
  MJ: [1e6, [1, 2, -2]],
  GJ: [1e9, [1, 2, -2]],
  TJ: [1e12, [1, 2, -2]],
  PJ: [1e15, [1, 2, -2]],
  EJ: [1e18, [1, 2, -2]],
  kW: [1e3, [1, 2, -3]],
  MW: [1e6, [1, 2, -3]],
  K: [1, [0, 0, 0, 0, 1, 0, 0]],
  mol: [1, [0, 0, 0, 0, 0, 1, 0]],
  cd: [1, [0, 0, 0, 0, 0, 0, 1]],
  A: [1, [0, 0, 0, 1, 0, 0, 0]],
  C: [1, [0, 0, 1, 1, 0, 0, 0]],
  V: [1, [1, 2, -3, -1, 0, 0, 0]],
  ohm: [1, [1, 2, -3, -2, 0, 0, 0]],
  F: [1, [-1, -2, 4, 2, 0, 0, 0]],
  T: [1, [1, 0, -2, -1, 0, 0, 0]],
  deg: [Math.PI / 180, [0, 0, 0]],
};
for (const value of Object.values(BASE)) value[1] = Array.from({ length: 7 }, (_, i) => value[1][i] ?? 0);
const same = (a, b) =>
  Array.from({ length: 7 }, (_, i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0)) < 1e-9).every(Boolean);
const combine = (a, b, sign = 1) => Array.from({ length: 7 }, (_, i) => (a[i] ?? 0) + sign * (b[i] ?? 0));
export function unitInfo(unit) {
  if (Object.hasOwn(BASE, unit)) return { scale: BASE[unit][0], dimensions: BASE[unit][1] };
  if (typeof unit !== 'string' || unit.length > 40) throw new Error('Unsupported unit');
  let scale = 1,
    dimensions = [0, 0, 0, 0, 0, 0, 0],
    divide = false;
  const parts = unit.replaceAll(' ', '').split(/([*/])/);
  for (const part of parts) {
    if (part === '*') {
      divide = false;
      continue;
    }
    if (part === '/') {
      divide = true;
      continue;
    }
    const match = /^([a-zA-Z]+|1)(?:\^(-?\d+))?$/.exec(part);
    if (!match || !Object.hasOwn(BASE, match[1])) throw new Error(`Unsupported unit: ${unit}`);
    const power = Number(match[2] ?? 1) * (divide ? -1 : 1);
    if (Math.abs(power) > 6) throw new Error('Unit exponent too large');
    scale *= BASE[match[1]][0] ** power;
    dimensions = combine(
      dimensions,
      BASE[match[1]][1].map((v) => v * power),
    );
  }
  return { scale, dimensions };
}

export function evaluateFormula(tokens, variables) {
  if (!Array.isArray(tokens) || !tokens.length || tokens.length > 80)
    throw new Error('Formula must contain 1–80 postfix tokens');
  const stack = [];
  const pop = () => {
    const v = stack.pop();
    if (!v) throw new Error('Incomplete formula');
    return v;
  };
  for (const token of tokens) {
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
      stack.push({ value: Number(token), dimensions: [0, 0, 0, 0, 0, 0, 0] });
    } else if (Object.hasOwn(variables, token)) {
      stack.push(variables[token]);
    } else if (['+', '-', '*', '/', '^'].includes(token)) {
      const b = pop(),
        a = pop();
      let value, dimensions;
      if (token === '+' || token === '-') {
        if (!same(a.dimensions, b.dimensions)) throw new Error('Cannot add quantities with different units');
        value = a.value + (token === '+' ? b.value : -b.value);
        dimensions = a.dimensions;
      } else if (token === '*' || token === '/') {
        if (token === '/' && b.value === 0) throw new Error('Division by zero');
        value = token === '*' ? a.value * b.value : a.value / b.value;
        dimensions = combine(a.dimensions, b.dimensions, token === '*' ? 1 : -1);
      } else {
        if (!same(b.dimensions, [0, 0, 0]) || Math.abs(b.value) > 12) throw new Error('Invalid exponent');
        value = a.value ** b.value;
        dimensions = a.dimensions.map((v) => v * b.value);
      }
      stack.push({ value, dimensions });
    } else if (['sqrt', 'abs', 'sin', 'cos', 'exp', 'log', 'neg'].includes(token)) {
      const a = pop();
      if (['sin', 'cos', 'exp', 'log'].includes(token) && !same(a.dimensions, [0, 0, 0]))
        throw new Error(`${token} needs a dimensionless input`);
      stack.push({
        value: token === 'neg' ? -a.value : Math[token](a.value),
        dimensions: token === 'sqrt' ? a.dimensions.map((v) => v / 2) : a.dimensions,
      });
    } else throw new Error(`Unknown formula token: ${String(token).slice(0, 40)}`);
    if (!Number.isFinite(stack.at(-1)?.value)) throw new Error('Formula is outside its finite domain');
  }
  if (stack.length !== 1) throw new Error('Formula must produce one result');
  return { ...stack[0], value: Object.is(stack[0].value, -0) ? 0 : stack[0].value };
}

export function evaluateLesson(lesson, params) {
  const variables = Object.create(null);
  for (const p of lesson.params) {
    const value = params[p.id] ?? p.default;
    if (!Number.isFinite(value) || value < p.min || value > p.max)
      throw new Error(`${p.label} is outside its allowed range`);
    const u = unitInfo(p.unit);
    variables[p.id] = { value: value * u.scale, dimensions: u.dimensions };
  }
  for (const c of lesson.constants) {
    const u = unitInfo(c.unit);
    variables[c.id] = { value: c.value * u.scale, dimensions: u.dimensions };
  }
  const result = Object.create(null);
  for (const output of lesson.outputs) {
    const computed = evaluateFormula(output.formula, variables);
    const canonical = unitInfo(output.unit),
      display = unitInfo(output.displayUnit);
    if (!same(computed.dimensions, canonical.dimensions) || !same(canonical.dimensions, display.dimensions))
      throw new Error(`Unit mismatch for ${output.label}`);
    variables[output.id] = computed;
    result[output.id] = {
      si: computed.value,
      value: computed.value / display.scale,
      unit: output.displayUnit,
    };
  }
  return result;
}

export function parameterValues(lesson, values) {
  if (values.length !== lesson.params.length) throw new Error('Parameter set has the wrong length');
  return Object.fromEntries(lesson.params.map((p, i) => [p.id, values[i]]));
}

export function checkExperiment(lesson) {
  const ids = [...lesson.params, ...lesson.constants, ...lesson.outputs].map((p) => p.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => ['__proto__', 'constructor', 'prototype'].includes(id))
  )
    throw new Error('Quantity identifiers must be unique and safe');
  const defaults = Object.fromEntries(lesson.params.map((p) => [p.id, p.default]));
  const outputIds = lesson.outputs.map((o) => o.id);
  if (!lesson.outputs.length || !lesson.params.length)
    throw new Error('An experiment needs an input and a computed output');
  for (const c of lesson.constants) {
    if (
      /speed of light/i.test(c.label) &&
      (!same(unitInfo(c.unit).dimensions, [0, 1, -1]) || c.value * unitInfo(c.unit).scale !== 299792458)
    )
      throw new Error('The vacuum speed of light must equal 299792458 m/s');
  }
  const probes = [defaults];
  for (let mask = 0; mask < 2 ** lesson.params.length; mask++)
    probes.push(Object.fromEntries(lesson.params.map((p, i) => [p.id, mask & (1 << i) ? p.max : p.min])));
  for (const p of lesson.params)
    for (const value of [
      p.min,
      p.max,
      Math.max(p.min, p.default - p.step),
      Math.min(p.max, p.default + p.step),
      ...Array.from({ length: 17 }, (_, i) => p.min + ((p.max - p.min) * i) / 16),
    ])
      probes.push({ ...defaults, [p.id]: value });
  for (const probe of probes) evaluateLesson(lesson, probe);
  for (const p of lesson.params) {
    const low = evaluateLesson(lesson, { ...defaults, [p.id]: p.min });
    const high = evaluateLesson(lesson, { ...defaults, [p.id]: p.max });
    if (
      !outputIds.some(
        (id) =>
          Math.abs(low[id].si - high[id].si) >
          Math.max(Math.abs(low[id].si), Math.abs(high[id].si), 1e-30) * 1e-10,
      )
    ) {
      // A symmetric function may have equal endpoints; sample its interior too.
      const middle = evaluateLesson(lesson, { ...defaults, [p.id]: (p.min + p.max) / 2 });
      if (!outputIds.some((id) => low[id].si !== middle[id].si))
        throw new Error(`${p.label} does not affect an output`);
    }
  }
  for (const preset of lesson.presets) evaluateLesson(lesson, parameterValues(lesson, preset.values));
  const prediction = lesson.prediction;
  if (!outputIds.includes(prediction.outputId) || prediction.correctIndex >= prediction.options.length)
    throw new Error('Invalid prediction');
  const setup = evaluateLesson(lesson, parameterValues(lesson, prediction.setup));
  const reveal = evaluateLesson(lesson, parameterValues(lesson, prediction.reveal));
  if (setup[prediction.outputId].si === reveal[prediction.outputId].si)
    throw new Error('Prediction must reveal a change');
  for (const part of lesson.equationParts)
    if (part.termId && !ids.includes(part.termId)) throw new Error('Equation references an unknown quantity');
  if (
    !lesson.params.some((p) => p.id === lesson.renderer.inputId) ||
    !outputIds.includes(lesson.renderer.outputId)
  )
    throw new Error('Renderer references unknown quantities');
  if (
    lesson.renderer.kind === 'spring' &&
    (!same(
      unitInfo(lesson.params.find((p) => p.id === lesson.renderer.inputId).unit).dimensions,
      unitInfo('m').dimensions,
    ) ||
      !same(
        unitInfo(lesson.outputs.find((o) => o.id === lesson.renderer.outputId).unit).dimensions,
        unitInfo('N').dimensions,
      ))
  )
    throw new Error('The spring renderer needs displacement and force quantities');
  if (lesson.renderer.kind === 'custom' && !lesson.stageHtml.trim())
    throw new Error('Custom visualization is missing');
  if (lesson.renderer.kind !== 'custom' && lesson.stageHtml.trim())
    throw new Error('Use the shared renderer without custom HTML');
  for (const check of lesson.checks) {
    const actual = evaluateLesson(lesson, parameterValues(lesson, check.values))[check.outputId];
    if (
      !actual ||
      Math.abs(actual.si - check.expectedSI) >
        Math.max(Math.abs(check.expectedSI) * check.relativeTolerance, 1e-20)
    )
      throw new Error('A numerical reference check failed');
  }
  if (
    new Set(lesson.checks.map((c) => JSON.stringify(c.values))).size < 2 ||
    !lesson.checks.some((c) => c.values.every((v, i) => v === lesson.params[i].default))
  )
    throw new Error('Reference checks need a default and a contrasting case');
  // These reference laws are calculated independently of the generated formula/checks.
  const normalizedEquation = lesson.equation.toLowerCase().replaceAll(' ', '');
  if (/mass.?energy/i.test(lesson.title) || /e(?:_0)?=m\*?c(?:\^2|²)/.test(normalizedEquation)) {
    const mass = lesson.params.find((p) => same(unitInfo(p.unit).dimensions, unitInfo('kg').dimensions));
    const energy = lesson.outputs.find((o) => same(unitInfo(o.unit).dimensions, unitInfo('J').dimensions));
    if (!mass || !energy) throw new Error('Mass–energy lesson needs mass and energy quantities');
    for (const amount of [mass.min, mass.default, mass.max]) {
      const expected = amount * unitInfo(mass.unit).scale * 299792458 ** 2;
      const actual = evaluateLesson(lesson, { ...defaults, [mass.id]: amount })[energy.id].si;
      if (Math.abs(actual - expected) > Math.max(Math.abs(expected) * 1e-9, 1e-20))
        throw new Error('Independent mass–energy reference failed');
    }
  }
  if (/hooke/i.test(lesson.title)) {
    const displacement = lesson.params.find((p) =>
      same(unitInfo(p.unit).dimensions, unitInfo('m').dimensions),
    );
    const stiffness = lesson.constants.find((c) =>
      same(unitInfo(c.unit).dimensions, unitInfo('N/m').dimensions),
    );
    const force = lesson.outputs.find((o) => same(unitInfo(o.unit).dimensions, unitInfo('N').dimensions));
    if (!displacement || !stiffness || !force)
      throw new Error('Hooke’s law needs displacement, stiffness and signed restoring force');
    for (const amount of [displacement.min, displacement.default, displacement.max]) {
      const expected =
        -amount * unitInfo(displacement.unit).scale * stiffness.value * unitInfo(stiffness.unit).scale;
      const actual = evaluateLesson(lesson, { ...defaults, [displacement.id]: amount })[force.id].si;
      if (Math.abs(actual - expected) > Math.max(Math.abs(expected) * 1e-9, 1e-20))
        throw new Error('Independent spring-force reference failed');
    }
  }
  return { probes: probes.length, references: lesson.checks.length };
}
