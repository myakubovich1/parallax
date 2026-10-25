import { checkExperiment } from './lesson-engine.mjs';
const text = { type: 'string', minLength: 1, maxLength: 1800 };
const legacyText = {type: 'string', minLength: 1, maxLength: 12000};
const strings = { type: 'array', items: legacyText, minItems: 1, maxItems: 12 };
const parameter = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,31}$' },
    label: text, symbol: text, unit: { type: 'string', maxLength: 100 },
    min: { type: 'number' }, max: { type: 'number' }, step: { type: 'number' },
    default: { type: 'number' }, digits: { type: 'integer', minimum: 0, maximum: 6 }, hint: text,
  },
};
parameter.required = Object.keys(parameter.properties);
const legacySchema = {
  type: 'object', additionalProperties: false,
  properties: { title: legacyText, equation: legacyText, explanation: strings, stageHtml: legacyText,
    params: { type: 'array', items: {...parameter, properties: Object.fromEntries(Object.entries(parameter.properties).map(([key, schema]) => [key, schema === text ? legacyText : schema]))}, maxItems: 8 }, assumptions: strings },
  required: ['title', 'equation', 'explanation', 'stageHtml', 'params', 'assumptions'],
};
const object = properties => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const array = (items, minItems = 1, maxItems = 8) => ({ type: 'array', items, minItems, maxItems });
const id = { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,31}$', maxLength: 32 };
const number = { type: 'number' };
const values = array(number, 1, 4);
const experimentSchema = object({
  version: {type: 'integer', enum: [2]},
  title: {...text, maxLength: 100}, equation: {...text, maxLength: 300},
  explanation: array({...text, maxLength: 500}, 1, 4),
  stageHtml: {type: 'string', maxLength: 14000},
  params: array(parameter, 1, 4), assumptions: array({...text, maxLength: 350}, 1, 5),
  plan: object({objective: text, takeaway: {...text, maxLength: 250}, misconception: text, interaction: text, observation: text, visualReason: text}),
  constants: array(object({id, symbol: text, label: text, value: number, unit: text, meaning: text}), 0, 6),
  outputs: array(object({id, symbol: text, label: text, unit: text, displayUnit: text, formula: array({...text, maxLength: 40}, 1, 80), digits: {type: 'integer', minimum: 0, maximum: 6}, meaning: text}), 1, 4),
  equationParts: array(object({text: {...text, minLength: 0}, termId: {type: 'string', maxLength: 32}}), 1, 24),
  renderer: object({kind: {type: 'string', enum: ['comparison', 'spring', 'custom']}, inputId: id, outputId: id, caption: {...text, maxLength: 300}}),
  presets: array(object({label: {...text, maxLength: 80}, values, note: {...text, maxLength: 250}}), 2, 4),
  prediction: object({question: {...text, maxLength: 300}, setup: values, reveal: values, options: array({...text, maxLength: 160}, 2, 4), correctIndex: {type: 'integer', minimum: 0, maximum: 3}, explanation: {...text, maxLength: 500}, outputId: id}),
  basics: object({background: {...text, maxLength: 500}, model: {...text, maxLength: 500}, experiment: {...text, maxLength: 500}}),
  checks: array(object({values, outputId: id, expectedSI: number, relativeTolerance: {type: 'number', minimum: 1e-12, maximum: 0.01}}), 2, 6),
});
// Keep the model's planning and calculations ahead of presentation in its output order.
export const lessonSchema = {...experimentSchema, properties: Object.fromEntries(['version', 'plan', 'title', 'equation', 'params', 'constants', 'outputs', 'equationParts', 'renderer', 'presets', 'prediction', 'basics', 'explanation', 'assumptions', 'checks', 'stageHtml'].map(key => [key, experimentSchema.properties[key]]))};
// Old saved lessons remain readable. New provider responses must use the experiment schema.
export function validateLesson(value, requireExperiment = false) {
  const check = (v, s) => {
    if (s.type === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v)
      && s.required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => s.properties[k] && check(v[k], s.properties[k]));
    if (s.type === 'array') return Array.isArray(v) && v.length >= (s.minItems ?? 0) && v.length <= s.maxItems && v.every(x => check(x, s.items));
    if (s.type === 'string') return typeof v === 'string' && v.length >= (s.minLength ?? 0) && v.length <= (s.maxLength ?? Infinity) && (!s.enum || s.enum.includes(v)) && (!s.pattern || new RegExp(s.pattern).test(v));
    return typeof v === 'number' && Number.isFinite(v) && (s.type !== 'integer' || Number.isInteger(v)) && (!s.enum || s.enum.includes(v)) && v >= (s.minimum ?? -Infinity) && v <= (s.maximum ?? Infinity);
  };
  const modern = value?.version === 2;
  // Legacy HTML has a larger limit than prose; keep old saves compatible.
  const old = {...legacySchema, properties: {...legacySchema.properties, stageHtml: {type: 'string', minLength: 1, maxLength: 30000}}};
  if ((requireExperiment && !modern) || !check(value, modern ? lessonSchema : old) || new Set(value.params.map(p => p.id)).size !== value.params.length
    || value.params.some(p => p.min >= p.max || p.step <= 0 || p.step > p.max - p.min || p.default < p.min || p.default > p.max)) {
    throw new Error('Invalid generated lesson');
  }
  if (modern) checkExperiment(value);
  return value;
}
