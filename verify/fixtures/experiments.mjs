// Reviewed regression fixtures. These are not substituted for live provider responses.
export const massEnergy = {
  version: 2,
  title: 'Mass–energy equivalence',
  equation: 'E_0 = mc^2',
  explanation: [
    'Mass and rest energy describe the same physical quantity in different units.',
    'With the speed of light fixed, doubling mass doubles rest energy.',
  ],
  stageHtml: '',
  params: [
    {
      id: 'm',
      label: 'Mass',
      symbol: 'm',
      unit: 'g',
      min: 0,
      max: 1000,
      step: 0.1,
      default: 1,
      digits: 1,
      hint: 'Change the mass and watch its corresponding rest energy.',
    },
  ],
  assumptions: [
    'Rest energy is not the amount of energy that can necessarily be extracted.',
    'The object is described in its rest frame; c is the vacuum speed of light.',
  ],
  plan: {
    objective: 'Understand how rest energy scales with mass.',
    takeaway: 'Double the mass. Double the rest energy.',
    misconception: 'E = mc² does not mean ordinary objects will release all of their rest energy.',
    interaction: 'Try 1 g, predict what doubling it will do, then compare the two states.',
    observation: 'The energy meter and numerical result grow in direct proportion to mass.',
    visualReason:
      'A symbolic mass tile and energy meter make the ratio visible; the graph is another view of the same calculation.',
  },
  constants: [
    {
      id: 'c',
      symbol: 'c',
      label: 'Vacuum speed of light',
      value: 299792458,
      unit: 'm/s',
      meaning: 'A fixed physical constant. Squaring c converts kilograms to joules.',
    },
  ],
  outputs: [
    {
      id: 'E',
      symbol: 'E_0',
      label: 'Rest energy',
      unit: 'J',
      displayUnit: 'TJ',
      formula: ['m', 'c', '2', '^', '*'],
      digits: 2,
      meaning: 'The total energy associated with the object’s mass in its rest frame.',
    },
  ],
  equationParts: [
    { text: 'E_0', termId: 'E' },
    { text: ' = ', termId: '' },
    { text: 'm', termId: 'm' },
    { text: 'c', termId: 'c' },
    { text: '^2', termId: '' },
  ],
  renderer: {
    kind: 'comparison',
    inputId: 'm',
    outputId: 'E',
    caption:
      'Change mass; compare the rest-energy meter with your pinned reference. This is a symbolic comparison, not a conversion process.',
  },
  presets: [
    { label: '1 g', values: [1], note: 'One gram corresponds to approximately 89.88 TJ of rest energy.' },
    {
      label: 'Double the mass',
      values: [2],
      note: 'Mass doubled from 1 g to 2 g. Rest energy doubled to approximately 179.75 TJ.',
    },
    { label: '1 kg', values: [1000], note: '1000 g is 1 kg: approximately 89.88 PJ, or 0.08988 EJ.' },
  ],
  prediction: {
    question: 'If mass doubles from 1 g to 2 g, what happens to rest energy?',
    setup: [1],
    reveal: [2],
    options: ['It doubles', 'It quadruples', 'It stays the same'],
    correctIndex: 0,
    explanation: 'c² stays fixed, so multiplying the mass by two multiplies rest energy by two.',
    outputId: 'E',
  },
  basics: {
    background: 'Mass measures the rest energy a system has, using kilograms instead of joules.',
    model: 'E₀ = mc². Mass can change; c is fixed. The exponent belongs to c, not to mass.',
    experiment: 'Start at 1 g. Predict the effect of doubling mass, then reveal the result and compare.',
  },
  checks: [
    { values: [1], outputId: 'E', expectedSI: 89875517873681.77, relativeTolerance: 1e-10 },
    { values: [1000], outputId: 'E', expectedSI: 89875517873681760, relativeTolerance: 1e-10 },
  ],
};

export const spring = {
  ...massEnergy,
  title: 'Hooke’s law',
  equation: 'F = -kx',
  explanation: ['Force points back toward equilibrium and grows with displacement.'],
  params: [
    {
      id: 'x',
      label: 'Displacement',
      symbol: 'x',
      unit: 'm',
      min: -2,
      max: 2,
      step: 0.1,
      default: 1,
      digits: 1,
      hint: 'Move the spring away from equilibrium.',
    },
  ],
  constants: [
    {
      id: 'k',
      symbol: 'k',
      label: 'Spring stiffness',
      unit: 'N/m',
      value: 2,
      meaning: 'Force per metre of stretch.',
    },
  ],
  outputs: [
    {
      id: 'F',
      symbol: 'F',
      label: 'Restoring force',
      unit: 'N',
      displayUnit: 'N',
      formula: ['k', 'x', '*', 'neg'],
      digits: 1,
      meaning: 'The signed force toward equilibrium.',
    },
  ],
  equationParts: [
    { text: 'F', termId: 'F' },
    { text: ' = −', termId: '' },
    { text: 'k', termId: 'k' },
    { text: 'x', termId: 'x' },
  ],
  plan: {
    objective: 'Connect displacement to restoring force.',
    takeaway: 'Stretch farther. Feel a stronger pull back.',
    misconception: 'The force opposes displacement; it does not push a stretched spring farther outward.',
    interaction: 'Compare a 1 m stretch with a 2 m stretch.',
    observation: 'The force grows in magnitude and always points toward equilibrium.',
    visualReason: 'A spring diagram shows displacement and force direction together.',
  },
  renderer: {
    kind: 'spring',
    inputId: 'x',
    outputId: 'F',
    caption: 'Stretch the spring and watch the direction and magnitude of the restoring force.',
  },
  presets: [
    { label: 'Stretch 1 m', values: [1], note: 'Force is −2 N.' },
    { label: 'Stretch 2 m', values: [2], note: 'Force doubles in magnitude to −4 N.' },
    { label: 'Compress', values: [-1], note: 'The direction reverses: force is +2 N.' },
  ],
  prediction: {
    question: 'What happens to restoring force when displacement doubles?',
    setup: [1],
    reveal: [2],
    options: ['Its magnitude doubles', 'Its magnitude halves', 'Its direction reverses'],
    correctIndex: 0,
    explanation: 'F = −kx with fixed k: force doubles in magnitude while still pointing toward equilibrium.',
    outputId: 'F',
  },
  basics: {
    background: 'An ideal spring pulls toward its equilibrium position.',
    model: 'F = −kx: stiffness k is fixed, displacement x changes, and the minus sign gives direction.',
    experiment: 'Predict what doubling displacement does to force, then compare.',
  },
  assumptions: [
    'An ideal linear spring within its elastic range; k = 2 N/m.',
    'The picture is a schematic; no time evolution is simulated.',
  ],
  checks: [
    { values: [1], outputId: 'F', expectedSI: -2, relativeTolerance: 1e-8 },
    { values: [2], outputId: 'F', expectedSI: -4, relativeTolerance: 1e-8 },
  ],
};
