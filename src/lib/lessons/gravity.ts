import { fixed, sci } from '../format';
import { G, LEAD_DENSITY, force, minSeparation, sphereRadius, type GravityParams } from '../physics/gravity';
import type { LessonSpec, Params } from './types';

const gp = (p: Params) => p as unknown as GravityParams;
const F = (p: Params) => force(gp(p));
const N = (v: number) => `${sci(v)} N`;

const ratioText = (r: number) => (Math.abs(r - Math.round(r)) < 1e-9 ? fixed(r, 0) : r >= 0.01 ? fixed(r, 3).replace(/0+$/, '').replace(/\.$/, '') : sci(r));

export const gravityLesson: LessonSpec = {
  id: 'gravitational-attraction',
  title: 'Gravitational attraction',
  kicker: 'Newton’s law of gravitation',
  renderer: 'gravity',
  animated: false,
  stepSeconds: () => 0,
  stageTitle: 'Force model · bodies held fixed',
  equations: [
    { id: 'newton', label: 'Newton’s law', parts: [{ term: 'F' }, ' = ', { term: 'G' }, ' ', { term: 'm1' }, ' ', { term: 'm2' }, ' / ', { term: 'r', text: 'r^2' }] },
  ],
  terms: {
    F: { id: 'F', symbol: 'F', name: 'Gravitational force', meaning: 'The pull each body feels toward the other. Both pulls have the same size and point in opposite directions.', unit: 'N', tone: 'white', value: (p) => N(F(p)) },
    G: { id: 'G', symbol: 'G', name: 'Gravitational constant', meaning: 'A universal constant that sets how strong gravity is. It is tiny, which is why everyday objects barely attract each other.', unit: 'N·m²/kg²', tone: 'neutral', value: () => `${sci(G, 4)} N·m²/kg²` },
    m1: { id: 'm1', symbol: 'm_1', name: 'Mass of body 1', meaning: 'Doubling one mass doubles the force.', unit: 'kg', tone: 'lime', param: 'm1', value: (p) => `${fixed(p.m1, 0)} kg` },
    m2: { id: 'm2', symbol: 'm_2', name: 'Mass of body 2', meaning: 'Doubling one mass doubles the force.', unit: 'kg', tone: 'ice', param: 'm2', value: (p) => `${fixed(p.m2, 0)} kg` },
    r: { id: 'r', symbol: 'r', name: 'Separation', meaning: 'The distance between the centres of the bodies. It is squared, so doubling r divides the force by four.', unit: 'm', tone: 'amber', param: 'r', value: (p) => `${fixed(p.r)} m, r² = ${fixed(p.r * p.r)} m²` },
  },
  params: [
    { id: 'm1', label: 'Mass 1', symbol: 'm_1', unit: 'kg', min: 1, max: 1000, step: 1, default: 500, digits: 0, term: 'm1', hint: 'Left sphere' },
    { id: 'm2', label: 'Mass 2', symbol: 'm_2', unit: 'kg', min: 1, max: 1000, step: 1, default: 200, digits: 0, term: 'm2', hint: 'Right sphere' },
    { id: 'r', label: 'Separation', symbol: 'r', unit: 'm', min: 0.2, max: 5, step: 0.01, default: 1.5, digits: 2, term: 'r', hint: 'Centre to centre' },
  ],
  presets: [
    { id: 'near', label: 'r = 1.5 m', params: { m1: 500, m2: 200, r: 1.5 }, note: 'Reference spacing' },
    { id: 'far', label: 'r = 3 m', params: { m1: 500, m2: 200, r: 3 }, note: 'Double the spacing' },
    { id: 'unequal', label: 'Heavy and light', params: { m1: 1000, m2: 10, r: 1.5 }, note: 'Unequal masses, equal forces' },
  ],
  normalize: (p) => {
    const min = Math.ceil(minSeparation(p.m1, p.m2) * 100) / 100;
    return p.r < min ? { ...p, r: min } : p;
  },
  constraintNote: (p) => {
    const min = Math.ceil(minSeparation(p.m1, p.m2) * 100) / 100;
    return p.r <= min + 1e-9 ? `The spheres are almost touching. Separation can’t go below ${fixed(min)} m for these masses.` : null;
  },
  assumptions: [
    'The bodies are held fixed: this shows the force, not the motion that would follow.',
    `Bodies are solid lead spheres (${LEAD_DENSITY.toLocaleString('en-US')} kg/m³), drawn to scale; spheres smaller than a few pixels are drawn at a minimum visible size.`,
    'Force arrows use a logarithmic length scale so values across nine orders of magnitude stay visible. Compare exact values with the pinned reference.',
    'Each sphere acts as a point mass at its centre, which is exact for uniform spheres that don’t overlap.',
  ],
  quick:
    'Every mass pulls on every other mass. The pull grows with both masses and fades with the square of the distance: twice as far means one quarter of the force.',
  understand: [
    'The force is proportional to each mass: double m₁ and the force doubles.',
    'It falls off with the square of the separation. Twice as far gives ¼ of the force; three times as far gives ⅑.',
    'Both bodies feel the same size of force, in opposite directions, even when one is much heavier (Newton’s third law).',
  ],
  basics: {
    background: [
      'A force is a push or pull, measured in newtons (N). One newton is roughly the weight of a small apple.',
      'Gravity is a pull between any two masses. It is very weak unless at least one mass is huge, like a planet. Two lead spheres in a lab attract with a force millions of times smaller than an apple’s weight.',
    ],
    model: [
      'Newton’s law: F = G m₁ m₂ / r². G = 6.674 × 10⁻¹¹ N·m²/kg² is a constant of nature.',
      'The masses multiply on top; the distance is squared underneath. Focus each term to find it in the picture.',
    ],
    tryIt: 'Pin a reference, then drag one sphere until the separation doubles. Read the ratio: it should be 0.25.',
  },
  caption: (p) =>
    `Each sphere is pulled toward the other with ${N(F(p))}. The arrows are equal and opposite, even though m₁ = ${fixed(p.m1, 0)} kg and m₂ = ${fixed(p.m2, 0)} kg.`,
  consequence: (prev, next) => {
    const ratio = F(next) / F(prev);
    if (prev.r !== next.r && prev.m1 === next.m1 && prev.m2 === next.m2) {
      const k = next.r / prev.r;
      return `Separation ×${ratioText(k)} → force ×${ratioText(ratio)} (that is 1 / ${ratioText(k)}²). Now ${N(F(next))}.`;
    }
    if (prev.m1 !== next.m1 || prev.m2 !== next.m2) return `Mass changed → force ×${ratioText(ratio)}, proportional to the mass change. Now ${N(F(next))}.`;
    return null;
  },
  readouts: (p) => [
    { id: 'F', label: 'Force on each body', value: N(F(p)), term: 'F', emphasis: true },
    { id: 'r2', label: 'r²', value: `${fixed(p.r * p.r, 3)} m²`, term: 'r' },
    { id: 'R1', label: 'Radius of sphere 1', value: `${fixed(sphereRadius(p.m1) * 100, 1)} cm`, term: 'm1' },
    { id: 'R2', label: 'Radius of sphere 2', value: `${fixed(sphereRadius(p.m2) * 100, 1)} cm`, term: 'm2' },
    { id: 'a2', label: 'm₂ would accelerate at F/m₂', value: `${sci(F(p) / p.m2)} m/s²` },
  ],
  compare: (p, ref) => {
    const parts = [`r ×${ratioText(p.r / ref.r)}`, `m₁ ×${ratioText(p.m1 / ref.m1)}`, `m₂ ×${ratioText(p.m2 / ref.m2)}`];
    return `F / F_ref = ${ratioText(F(p) / F(ref))}  ·  ${parts.join(', ')}`;
  },
  predictions: [
    {
      id: 'double-r',
      question: 'The masses stay the same. If the separation doubles from 1.5 m to 3 m, what happens to the force?',
      setup: { m1: 500, m2: 200, r: 1.5 },
      reveal: { r: 3 },
      options: [
        { id: 'half', label: 'It halves' },
        { id: 'quarter', label: 'It drops to one quarter' },
        { id: 'same', label: 'It stays the same' },
      ],
      correct: 'quarter',
      explain: (c) =>
        c === 'quarter'
          ? 'Yes. r is squared: (2r)² = 4r², so the force is divided by 4. The ratio readout shows 0.25.'
          : 'The distance appears as r². Doubling r makes r² four times bigger, so the force drops to one quarter. Check the ratio readout: 0.25.',
    },
    {
      id: 'double-m',
      question: 'Now double m₁ from 500 kg to 1000 kg, keeping r fixed. How does the force change?',
      setup: { m1: 500, m2: 200, r: 1.5 },
      reveal: { m1: 1000 },
      options: [
        { id: 'double', label: 'It doubles' },
        { id: 'quad', label: 'It quadruples' },
        { id: 'only1', label: 'Only the pull on m₁ changes' },
      ],
      correct: 'double',
      explain: (c) =>
        c === 'double'
          ? 'Right. m₁ appears once, not squared, so the force doubles, and it doubles for both bodies.'
          : 'm₁ appears to the first power, so doubling it doubles F. The force is shared: both bodies feel the same new value.',
    },
    {
      id: 'third-law',
      question: 'm₁ = 1000 kg and m₂ = 10 kg. Which sphere feels the larger pull?',
      setup: { m1: 1000, m2: 10, r: 1.5 },
      reveal: {},
      options: [
        { id: 'heavy', label: 'The heavy sphere' },
        { id: 'light', label: 'The light sphere' },
        { id: 'equal', label: 'They feel equal pulls' },
      ],
      correct: 'equal',
      explain: (c) =>
        c === 'equal'
          ? 'Exactly. The same F = G m₁ m₂ / r² acts on both, in opposite directions. The light sphere would accelerate more because a = F / m.'
          : 'There is only one F in the formula, and it acts on both bodies in opposite directions. The light sphere would accelerate more (a = F / m), but the forces are equal.',
    },
  ],
  followUps: [
    {
      label: 'Double the distance',
      match: /double.*(distance|separation|\br\b)|twice as far|farther|further/i,
      run: (p) => {
        const r = Math.min(5, p.r * 2);
        return { pinReference: true, setParams: { r }, highlight: 'separation', message: `Pinned the current force, then set r = ${fixed(r)} m. Read the ratio: ${ratioText((p.r / r) ** 2)}.` };
      },
    },
    {
      label: 'Halve the distance',
      match: /halve|half.*(distance|separation)|closer/i,
      run: (p) => ({ pinReference: true, setParams: { r: p.r / 2 }, highlight: 'separation', message: 'Pinned the current force, then halved r. The force grows by up to 4×, unless the spheres touch first.' }),
    },
    {
      label: 'Double the first mass',
      match: /double.*mass|heavier|more mass/i,
      run: (p) => ({ pinReference: true, setParams: { m1: Math.min(1000, p.m1 * 2) }, message: 'Pinned the current force, then doubled m₁ (up to 1000 kg). Force scales by the same factor.' }),
    },
    {
      label: 'Why are the arrows equal?',
      match: /arrow|equal|third law|which.*(pull|force)/i,
      run: () => ({ highlight: 'arrows', message: 'Both arrows show the same F: one force acts on both bodies, in opposite directions (Newton’s third law).' }),
    },
  ],
  annotations: [
    { id: 'arrows', label: 'Force arrows' },
    { id: 'separation', label: 'Separation' },
  ],
  matchers: [/gravit/i, /newton'?s?\s+law/i, /\bF\s*=\s*G/i, /m_?1\s*[·*]?\s*m_?2/i, /inverse[-\s]square/i, /attract/i, /\bmasses\b/i],
  examplePrompt: 'F = G m1 m2 / r²',
};
