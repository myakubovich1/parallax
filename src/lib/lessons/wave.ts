import { fixed } from '../format';
import {
  WAVELENGTH_M,
  WAVE_NUMBER,
  classify,
  phaseOffsetMeters,
  resultantAmplitude,
  resultantPhaseDeg,
  type WaveParams,
} from '../physics/wave';
import type { LessonSpec, Params } from './types';

const wp = (p: Params) => p as unknown as WaveParams;
const AR = (p: Params) => resultantAmplitude(wp(p));

function describeState(p: Params): string {
  const kind = classify(wp(p));
  const phi = fixed(p.phi, 0);
  switch (kind) {
    case 'cancellation':
      return `At φ = ${phi}° every crest of wave 1 meets a trough of wave 2 of the same size, so the sum is flat everywhere.`;
    case 'constructive':
      return `At φ = ${phi}° the crests line up, so the sum reaches A₁ + A₂ = ${fixed(AR(p))}.`;
    case 'destructive':
      return `At φ = ${phi}° crests meet troughs, but the waves are unequal, so a smaller wave of amplitude |A₁ − A₂| = ${fixed(AR(p))} remains.`;
    default:
      return `At φ = ${phi}° the waves partly reinforce: the sum has amplitude ${fixed(AR(p))}, between |A₁ − A₂| = ${fixed(Math.abs(p.A1 - p.A2))} and A₁ + A₂ = ${fixed(p.A1 + p.A2)}.`;
  }
}

export const waveLesson: LessonSpec = {
  id: 'wave-interference',
  title: 'Wave interference',
  kicker: 'Superposition of two waves',
  renderer: 'wave',
  animated: true,
  stepSeconds: (p) => 1 / (8 * p.f), // one eighth of a period
  stageTitle: 'Idealized 1D waves · equal frequency',
  equations: [
    { id: 'y1', label: 'Wave 1', parts: [{ term: 'y1' }, ' = ', { term: 'A1' }, ' sin(', { term: 'k' }, { term: 'x' }, ' − 2π', { term: 'f' }, { term: 't' }, ')'] },
    { id: 'y2', label: 'Wave 2', parts: [{ term: 'y2' }, ' = ', { term: 'A2' }, ' sin(', { term: 'k' }, { term: 'x' }, ' − 2π', { term: 'f' }, { term: 't' }, ' + ', { term: 'phi' }, ')'] },
    { id: 'sum', label: 'Sum', parts: [{ term: 'y' }, ' = ', { term: 'y1' }, ' + ', { term: 'y2' }] },
  ],
  terms: {
    y1: { id: 'y1', symbol: 'y_1', name: 'Wave 1 displacement', meaning: 'How far wave 1 moves each point of the medium up or down.', unit: 'relative units', tone: 'lime' },
    y2: { id: 'y2', symbol: 'y_2', name: 'Wave 2 displacement', meaning: 'How far wave 2 moves each point of the medium up or down.', unit: 'relative units', tone: 'ice' },
    y: { id: 'y', symbol: 'y', name: 'Total displacement', meaning: 'What the medium actually does: the two displacements added point by point.', unit: 'relative units', tone: 'white', value: (p) => `amplitude ${fixed(AR(p))}` },
    A1: { id: 'A1', symbol: 'A_1', name: 'Amplitude of wave 1', meaning: 'The height of wave 1’s crests.', unit: 'relative units', tone: 'lime', param: 'A1', value: (p) => fixed(p.A1) },
    A2: { id: 'A2', symbol: 'A_2', name: 'Amplitude of wave 2', meaning: 'The height of wave 2’s crests.', unit: 'relative units', tone: 'ice', param: 'A2', value: (p) => fixed(p.A2) },
    f: { id: 'f', symbol: 'f', name: 'Frequency', meaning: 'Oscillations per second, shared by both waves. It changes how fast the pattern moves, not how the waves combine.', unit: 'Hz', tone: 'violet', param: 'f', value: (p) => `${fixed(p.f)} Hz` },
    phi: { id: 'phi', symbol: 'φ', name: 'Phase difference', meaning: 'How far wave 2 is shifted along its cycle relative to wave 1. 360° is one full cycle.', unit: '°', tone: 'amber', param: 'phi', value: (p) => `${fixed(p.phi, 0)}° = ${fixed(phaseOffsetMeters(p.phi))} m of offset` },
    k: { id: 'k', symbol: 'k', name: 'Wave number', meaning: `2π / λ. The wavelength is fixed at λ = ${fixed(WAVELENGTH_M)} m in this model.`, unit: 'rad/m', tone: 'neutral', value: () => `${fixed(WAVE_NUMBER)} rad/m` },
    x: { id: 'x', symbol: 'x', name: 'Position', meaning: 'Where along the medium you look. The stage spans 0 to 3 m.', unit: 'm', tone: 'neutral' },
    t: { id: 't', symbol: 't', name: 'Time', meaning: 'Simulated time. Playback speed changes how quickly t advances on screen, not the physics.', unit: 's', tone: 'neutral' },
  },
  params: [
    { id: 'A1', label: 'Amplitude 1', symbol: 'A_1', unit: 'rel.', min: 0, max: 1.5, step: 0.05, default: 1, digits: 2, term: 'A1', hint: 'Height of wave 1' },
    { id: 'A2', label: 'Amplitude 2', symbol: 'A_2', unit: 'rel.', min: 0, max: 1.5, step: 0.05, default: 1, digits: 2, term: 'A2', hint: 'Height of wave 2' },
    { id: 'phi', label: 'Phase difference', symbol: 'φ', unit: '°', min: 0, max: 360, step: 5, default: 60, digits: 0, term: 'phi', hint: 'Shift of wave 2 along its cycle' },
    { id: 'f', label: 'Frequency', symbol: 'f', unit: 'Hz', min: 0.2, max: 2, step: 0.05, default: 0.5, digits: 2, term: 'f', hint: 'Shared by both waves' },
  ],
  presets: [
    { id: 'constructive', label: 'Constructive', params: { A1: 1, A2: 1, phi: 0 }, note: 'Equal amplitudes, φ = 0°' },
    { id: 'cancel', label: 'Complete cancellation', params: { A1: 1, A2: 1, phi: 180 }, note: 'Equal amplitudes, φ = 180°' },
    { id: 'partial', label: 'Partial', params: { A1: 1, A2: 0.6, phi: 120 }, note: 'Unequal amplitudes, φ = 120°' },
  ],
  assumptions: [
    `Idealized one-dimensional waves with the same frequency and a fixed wavelength λ = ${fixed(WAVELENGTH_M)} m.`,
    'Amplitudes are in relative units; this model does not represent sound pressure or loudness.',
    'No damping, dispersion or reflection. Each dot is a point of the medium, moved only vertically.',
  ],
  quick:
    'Two waves passing through the same place simply add. Where crests meet crests, the medium moves more; where crests meet troughs, the motions cancel. The phase difference φ decides which happens.',
  understand: [
    'Each point of the medium feels both waves at once. Its displacement is the sum y = y₁ + y₂.',
    'Because both waves share one frequency, their sum is another wave of the same frequency. Only its height changes, and that height depends on the amplitudes and on φ.',
    'φ = 0° lines crests up (constructive). φ = 180° puts crests on troughs (destructive); with equal amplitudes, the sum vanishes.',
  ],
  basics: {
    background: [
      'A wave is a pattern of motion that travels. In this model, each point of a long string moves up and down while the pattern slides to the right.',
      'Amplitude is the height of the crests. Frequency is how many times per second each point goes up and down. Wavelength is the distance from crest to crest; here it is fixed at 1 m.',
      'When two waves travel through the same medium, each point moves by the sum of what each wave asks of it. That is the principle of superposition.',
    ],
    model: [
      'Wave 1 is y₁ = A₁ sin(kx − 2πft). Wave 2 is the same, shifted by the phase difference φ.',
      'Focus each term in the equation to see where it lives in the picture: amplitudes set the height of the lime and blue ribbons, φ sets the gap between their crests.',
      'The white wave is their sum. Its amplitude is A_R = √(A₁² + A₂² + 2A₁A₂ cos φ).',
    ],
    tryIt: 'Change φ and watch the gap between the crest markers. Find the setting that makes the white wave flat.',
  },
  caption: (p) => describeState(p),
  consequence: (prev, next) => {
    const before = fixed(AR(prev));
    const after = fixed(AR(next));
    if (prev.phi !== next.phi) return describeState(next);
    if (prev.A1 !== next.A1 || prev.A2 !== next.A2)
      return `With A₁ = ${fixed(next.A1)} and A₂ = ${fixed(next.A2)}, the sum’s amplitude is now ${after} (was ${before}).`;
    if (prev.f !== next.f)
      return `Frequency changes how fast every point oscillates, but both waves share it, so the sum’s amplitude stays ${after}.`;
    return null;
  },
  readouts: (p) => [
    { id: 'AR', label: 'Sum amplitude A_R', value: fixed(AR(p)), term: 'y', emphasis: true },
    { id: 'kind', label: 'Interference', value: { cancellation: 'Complete cancellation', constructive: 'Constructive', destructive: 'Destructive', partial: 'Partial' }[classify(wp(p))] },
    { id: 'offset', label: 'Crest offset', value: `${fixed(phaseOffsetMeters(p.phi))} m`, term: 'phi' },
    { id: 'sumphase', label: 'Sum phase vs wave 1', value: `${fixed(resultantPhaseDeg(wp(p)), 0)}°` },
    { id: 'T', label: 'Period T = 1/f', value: `${fixed(1 / p.f)} s`, term: 'f' },
    { id: 'lambda', label: 'Wavelength λ (fixed)', value: `${fixed(WAVELENGTH_M)} m`, term: 'k' },
  ],
  compare: (p, ref) => `Sum amplitude ${fixed(AR(p))} vs ${fixed(AR(ref))} pinned`,
  predictions: [
    {
      id: 'half-cycle',
      question: 'What happens when these equal waves are half a cycle apart?',
      setup: { A1: 1, A2: 1, phi: 0 },
      reveal: { phi: 180 },
      options: [
        { id: 'double', label: 'The sum gets twice as tall' },
        { id: 'cancel', label: 'The sum flattens to zero' },
        { id: 'shift', label: 'The sum keeps its height and just shifts' },
      ],
      correct: 'cancel',
      explain: (c) =>
        c === 'cancel'
          ? 'Yes. Half a cycle is φ = 180°: every crest of wave 1 sits on a trough of wave 2 of the same depth, so they cancel at every point.'
          : 'Look at the crest markers: half a cycle (φ = 180°) puts each crest of wave 1 over a trough of wave 2. With equal amplitudes they cancel everywhere, so the white wave is flat.',
    },
    {
      id: 'unequal',
      question: 'Wave 2 is now half as tall. When the waves are half a cycle apart, what is left?',
      setup: { A1: 1, A2: 0.5, phi: 0 },
      reveal: { phi: 180 },
      options: [
        { id: 'zero', label: 'Nothing. They still cancel' },
        { id: 'half', label: 'A wave of amplitude 0.5' },
        { id: 'onehalf', label: 'A wave of amplitude 1.5' },
      ],
      correct: 'half',
      explain: (c) =>
        c === 'half'
          ? 'Right. Wave 2 removes 0.5 of wave 1’s height, leaving |A₁ − A₂| = 0.5. Complete cancellation needs equal amplitudes.'
          : 'Wave 2 can only cancel as much height as it has. The troughs of 0.5 take 0.5 off crests of 1.0, leaving a wave of amplitude |A₁ − A₂| = 0.5.',
    },
    {
      id: 'frequency',
      question: 'The waves are lined up (φ = 0°). If you double the frequency, what happens to the height of the sum?',
      setup: { A1: 1, A2: 1, phi: 0, f: 0.5 },
      reveal: { f: 1 },
      options: [
        { id: 'taller', label: 'It gets taller' },
        { id: 'same', label: 'It stays the same' },
        { id: 'shorter', label: 'It gets shorter' },
      ],
      correct: 'same',
      explain: (c) =>
        c === 'same'
          ? 'Correct. Both waves share f, so doubling it makes everything oscillate faster but keeps the crests aligned. The sum’s amplitude stays 2.00.'
          : 'Height depends on the amplitudes and φ only. Doubling f speeds up the motion of both waves equally; they stay aligned and the sum’s amplitude stays 2.00.',
    },
  ],
  followUps: [
    {
      label: 'Make the waves cancel',
      match: /cancel|destructive|flat|zero|silence/i,
      run: (p) => {
        const A = Math.max(0.5, Math.round(((p.A1 + p.A2) / 2) * 20) / 20);
        return { setParams: { A1: A, A2: A, phi: 180 }, highlight: 'phase', message: `Set A₁ = A₂ = ${fixed(A)} and φ = 180°. Crests meet equal troughs, so the white sum is flat.` };
      },
    },
    {
      label: 'Highlight the phase difference',
      match: /phase|offset|shift|gap/i,
      run: (p) => ({ highlight: 'phase', message: `The amber bracket marks φ = ${fixed(p.phi, 0)}°: wave 2’s crest sits ${fixed(phaseOffsetMeters(p.phi))} m from wave 1’s.` }),
    },
    {
      label: 'Line the crests up',
      match: /constructive|line\s*up|align|reinforce|biggest|largest|max/i,
      run: () => ({ setParams: { phi: 0 }, highlight: 'resultant', message: 'Set φ = 0°. Crests line up, so the sum’s amplitude is A₁ + A₂.' }),
    },
    {
      label: 'Show the sum’s amplitude',
      match: /amplitude|height|resultant|envelope|sum/i,
      run: (p) => ({ highlight: 'resultant', message: `The dashed white lines mark ±A_R = ±${fixed(AR(p))}, the height of the sum.` }),
    },
    {
      label: 'Double the frequency',
      match: /frequen|faster oscill/i,
      run: (p) => ({ setParams: { f: Math.min(2, p.f * 2) }, message: `Frequency is now ${fixed(Math.min(2, p.f * 2))} Hz. The pattern moves faster; the sum’s amplitude is unchanged.` }),
    },
  ],
  annotations: [
    { id: 'phase', label: 'Phase difference' },
    { id: 'resultant', label: 'Sum amplitude' },
  ],
  matchers: [/interfer/i, /superpos/i, /\bwaves?\b/i, /phase\s*(difference|shift)/i, /sin\s*\(\s*k\s*x/i, /constructive|destructive/i, /y_?1\s*\+\s*y_?2/i],
  examplePrompt: 'Explain wave interference.',
};
