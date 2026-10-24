import { fixed, signed } from '../format';
import { CONVERGED_TOL, DISPLAY_BOUND, MAX_STEPS, haltAt, loss, regime, slope, wAt } from '../physics/gradient';
import type { LessonSpec, Params } from './types';

const factor = (eta: number) => 1 - 2 * eta;

function regimeText(p: Params): string {
  const c = fixed(Math.abs(factor(p.eta)));
  switch (regime(p.eta)) {
    case 'slow':
      return `With η = ${fixed(p.eta)} each step keeps ${c} of the distance to the minimum, so w creeps in from one side.`;
    case 'direct':
      return `With η = ${fixed(p.eta)} each step removes most of the remaining distance (×${c}), so w settles quickly from one side.`;
    case 'oscillating':
      return `With η = ${fixed(p.eta)} each step jumps past the minimum: the distance flips sign and shrinks ×${c}, so w zigzags inward.`;
    case 'periodic':
      return `With η = ${fixed(p.eta)} each step lands exactly as far on the other side (×1.00), so w bounces forever.`;
    case 'unstable':
      return `With η = ${fixed(p.eta)} each step lands farther away on the other side (×${c}), so w runs away from the minimum.`;
  }
}

export const gradientLesson: LessonSpec = {
  id: 'gradient-descent',
  title: 'Gradient descent',
  kicker: 'Why learning rates overshoot',
  renderer: 'gradient',
  animated: true,
  stepRate: 1.5,
  stepSeconds: () => 1 / 1.5,
  stageTitle: 'Loss curve · one parameter',
  equations: [
    { id: 'loss', label: 'Loss', parts: [{ term: 'L', text: 'L(w)' }, ' = (', { term: 'w' }, ' − ', { term: 'min', text: '3' }, ')²'] },
    { id: 'update', label: 'Update', parts: [{ term: 'wnext' }, ' = ', { term: 'w' }, ' − ', { term: 'eta' }, ' · ', { term: 'grad', text: '2(w − 3)' }] },
  ],
  terms: {
    L: { id: 'L', symbol: 'L', name: 'Loss', meaning: 'How wrong the current guess w is. Lower is better; the best value is 0.', tone: 'white', value: (p, c) => fixed(loss(wAt(p.w0, p.eta, c.step)), 3) },
    w: { id: 'w', symbol: 'w', name: 'Current parameter', meaning: 'The value being adjusted. The glowing point on the curve.', tone: 'lime', value: (p, c) => fixed(wAt(p.w0, p.eta, c.step), 3) },
    min: { id: 'min', symbol: '3', name: 'Location of the minimum', meaning: 'Loss is lowest at w = 3. Gradient descent doesn’t know this; it only sees the slope.', tone: 'neutral' },
    grad: { id: 'grad', symbol: "L'(w)", name: 'Slope (gradient)', meaning: 'dL/dw = 2(w − 3). Its sign says which way is uphill; its size says how steep.', tone: 'ice', value: (p, c) => signed(slope(wAt(p.w0, p.eta, c.step)), 3) },
    eta: { id: 'eta', symbol: 'η', name: 'Learning rate', meaning: 'How far to move per unit of slope. Too small is slow; too large overshoots or diverges.', tone: 'amber', param: 'eta', value: (p) => fixed(p.eta) },
    wnext: { id: 'wnext', symbol: 'w_{next}', name: 'Next parameter', meaning: 'Where the point lands after one step: move against the slope by η × slope.', tone: 'violet', value: (p, c) => fixed(wAt(p.w0, p.eta, c.step + 1), 3) },
    w0: { id: 'w0', symbol: 'w_0', name: 'Starting position', meaning: 'Where the descent begins.', tone: 'lime', param: 'w0', value: (p) => fixed(p.w0, 1) },
  },
  params: [
    { id: 'eta', label: 'Learning rate', symbol: 'η', unit: '', min: 0.01, max: 1.2, step: 0.01, default: 0.3, digits: 2, term: 'eta', hint: 'Step size per unit slope' },
    { id: 'w0', label: 'Starting position', symbol: 'w_0', unit: '', min: -3, max: 9, step: 0.1, default: -2, digits: 1, term: 'w0', hint: 'Where descent begins' },
  ],
  presets: [
    { id: 'slow', label: 'Slow', params: { eta: 0.05 }, note: 'η = 0.05 · creeps in' },
    { id: 'overshoot', label: 'Overshooting', params: { eta: 0.85 }, note: 'η = 0.85 · zigzags, converges' },
    { id: 'unstable', label: 'Unstable', params: { eta: 1.05 }, note: 'η = 1.05 · diverges' },
  ],
  assumptions: [
    'One parameter and a perfect bowl-shaped loss. Real models have millions of parameters and bumpier surfaces, but the overshoot mechanism is the same.',
    `Playback pauses if |w − 3| exceeds ${DISPLAY_BOUND} (the edge of the chart), when w is within ${CONVERGED_TOL} of the minimum, or after ${MAX_STEPS} steps.`,
    'Steps are discrete. The point glides between them only to make each jump easy to follow.',
  ],
  quick:
    'Gradient descent walks downhill by stepping against the slope. The learning rate η scales each step. Steep slope × large η = a jump so big it lands past the minimum, on the other side.',
  understand: [
    'At each step, measure the slope 2(w − 3) and move by −η × slope. Steeper ground means a bigger step.',
    'For this bowl, every step multiplies the distance to the minimum by (1 − 2η). Between 0 and 1 in size, the distance shrinks.',
    'If η > 0.5 the factor is negative: the point overshoots and zigzags. If η > 1 the factor is bigger than 1 in size: each overshoot is larger than the last.',
  ],
  basics: {
    background: [
      'Training a model means adjusting a number, w, so that a loss, how wrong the model is, gets as small as possible.',
      'Imagine standing on a hillside in fog. You can’t see the valley, but you can feel which way the ground slopes. Step downhill, feel again, repeat.',
    ],
    model: [
      'The loss here is L(w) = (w − 3)², a bowl with its lowest point at w = 3.',
      'The slope is 2(w − 3). The update w_next = w − η · 2(w − 3) moves against the slope, scaled by the learning rate η.',
    ],
    tryIt: 'Try the three presets. Then find the η that reaches the minimum in a single step.',
  },
  caption: (p) => regimeText(p),
  consequence: (prev, next) => {
    if (prev.eta !== next.eta) return regimeText(next);
    if (prev.w0 !== next.w0) return `Starting at w₀ = ${fixed(next.w0, 1)}. The first step is ${signed(-next.eta * slope(next.w0))}, larger when farther from the minimum.`;
    return null;
  },
  readouts: (p, c) => {
    const w = wAt(p.w0, p.eta, c.step);
    return [
      { id: 'n', label: 'Step', value: String(c.step) },
      { id: 'w', label: 'w', value: fixed(w, 3), term: 'w', emphasis: true },
      { id: 'L', label: 'Loss L(w)', value: fixed(loss(w), 3), term: 'L' },
      { id: 'slope', label: 'Slope 2(w − 3)', value: signed(slope(w), 3), term: 'grad' },
      { id: 'step', label: 'Next step −η·slope', value: signed(-p.eta * slope(w), 3), term: 'wnext' },
      { id: 'factor', label: 'Distance factor 1 − 2η', value: signed(factor(p.eta), 2), term: 'eta' },
    ];
  },
  halt: (p, n) => {
    const h = haltAt(p.w0, p.eta, n);
    if (!h) return null;
    if (h.kind === 'converged') return `Converged after ${h.n} steps: w is within ${CONVERGED_TOL} of the minimum at 3.`;
    if (h.kind === 'max-steps') return `Stopped after ${h.n} steps. At η = ${fixed(p.eta)} the distance factor is ${signed(factor(p.eta))}, so w never settles.`;
    return `Paused at step ${h.n}: w = ${fixed(h.w, 2)} left the chart (|w − 3| > ${DISPLAY_BOUND}). Each step multiplied the distance to the minimum by ${fixed(Math.abs(factor(p.eta)))}, so it grew instead of shrinking.`;
  },
  predictions: [
    {
      id: 'overshoot',
      question: 'With η = 0.85, starting at w = −2, what will the point do?',
      setup: { eta: 0.85, w0: -2 },
      reveal: {},
      options: [
        { id: 'creep', label: 'Slide slowly down one side' },
        { id: 'zigzag', label: 'Jump across the minimum, then settle' },
        { id: 'escape', label: 'Bounce farther and farther away' },
      ],
      correct: 'zigzag',
      explain: (c) =>
        c === 'zigzag'
          ? 'Yes. The factor 1 − 2η = −0.70: negative means it lands on the other side; magnitude below 1 means each jump is smaller.'
          : 'The step is so large it lands past the minimum (1 − 2η = −0.70 is negative), but each landing is 70% as far as the last, so it zigzags inward.',
    },
    {
      id: 'unstable',
      question: 'Raise η slightly, to 1.05. What happens now?',
      setup: { eta: 1.05, w0: -2 },
      reveal: {},
      options: [
        { id: 'zigzag', label: 'Zigzags and settles, just slower' },
        { id: 'escape', label: 'Bounces farther away each step' },
        { id: 'stop', label: 'Stops at the minimum in one step' },
      ],
      correct: 'escape',
      explain: (c) =>
        c === 'escape'
          ? 'Right. 1 − 2η = −1.10: each overshoot is 10% larger than the last, so w runs off the chart and playback pauses.'
          : 'The factor is now −1.10: bigger than 1 in size. Every overshoot is 10% farther than the last, so the descent diverges.',
    },
    {
      id: 'slow',
      question: 'With η = 0.05, roughly how many steps until w is within 0.001 of the minimum?',
      setup: { eta: 0.05, w0: -2 },
      reveal: {},
      options: [
        { id: '10', label: 'About 10' },
        { id: '80', label: 'About 80' },
        { id: 'never', label: 'It never gets there' },
      ],
      correct: '80',
      explain: (c) =>
        c === '80'
          ? 'Yes, 81 steps. Each step keeps 90% of the distance: 5 × 0.9ⁿ < 0.001 needs n ≈ 81. Speed up playback to watch it finish.'
          : 'Each step keeps 90% of the distance (1 − 2η = 0.90). Shrinking 5 to 0.001 takes 81 steps: slow, but it does arrive.',
    },
  ],
  followUps: [
    { label: 'Show overshooting', match: /overshoot|zig\s*zag|oscillat|bounce/i, run: () => ({ setParams: { eta: 0.85 }, highlight: 'step', message: 'Set η = 0.85. Watch each step jump past w = 3 and shrink.' }) },
    { label: 'Make it diverge', match: /unstable|diverg|explod|blow|too (big|large)/i, run: () => ({ setParams: { eta: 1.05 }, highlight: 'step', message: 'Set η = 1.05. Each overshoot is larger than the last; playback pauses when w leaves the chart.' }) },
    { label: 'Reach the minimum in one step', match: /one step|single step|fastest|best (rate|η)|optimal/i, run: () => ({ setParams: { eta: 0.5 }, highlight: 'minimum', message: 'Set η = 0.5. Then 1 − 2η = 0, so the first step lands exactly on w = 3.' }) },
    { label: 'Make it slow', match: /slow|small(er)? (rate|η|step)/i, run: () => ({ setParams: { eta: 0.05 }, message: 'Set η = 0.05. Each step keeps 90% of the distance; try 4× playback.' }) },
    { label: 'Show the slope', match: /slope|tangent|gradient|steep/i, run: () => ({ highlight: 'tangent', message: 'The blue line is the tangent: its slope 2(w − 3) sets the size of the next step.' }) },
  ],
  annotations: [
    { id: 'tangent', label: 'Slope' },
    { id: 'step', label: 'Step' },
    { id: 'minimum', label: 'Minimum' },
  ],
  matchers: [/gradient\s*descent/i, /learning\s*rate/i, /\bloss\b/i, /overshoot/i, /w_?\s*next/i, /optimi[sz]/i, /\bgradient\b/i, /\(w\s*[−-]\s*3\)/i],
  examplePrompt: 'Why does gradient descent sometimes overshoot?',
};
