const text = { type: 'string', minLength: 1, maxLength: 12000 };
const strings = { type: 'array', items: text, minItems: 1, maxItems: 12 };
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
export const lessonSchema = {
  type: 'object', additionalProperties: false,
  properties: { title: text, equation: text, explanation: strings, stageHtml: text,
    params: { type: 'array', items: parameter, maxItems: 8 }, assumptions: strings },
  required: ['title', 'equation', 'explanation', 'stageHtml', 'params', 'assumptions'],
};
export function validateLesson(value) {
  const check = (v, s) => {
    if (s.type === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v)
      && s.required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => s.properties[k] && check(v[k], s.properties[k]));
    if (s.type === 'array') return Array.isArray(v) && v.length >= (s.minItems ?? 0) && v.length <= s.maxItems && v.every(x => check(x, s.items));
    if (s.type === 'string') return typeof v === 'string' && v.length >= (s.minLength ?? 0) && v.length <= (s.maxLength ?? Infinity) && (!s.pattern || new RegExp(s.pattern).test(v));
    return typeof v === 'number' && Number.isFinite(v) && (s.type !== 'integer' || Number.isInteger(v)) && v >= (s.minimum ?? -Infinity) && v <= (s.maximum ?? Infinity);
  };
  if (!check(value, lessonSchema) || new Set(value.params.map(p => p.id)).size !== value.params.length
    || value.params.some(p => p.min >= p.max || p.step <= 0 || p.step > p.max - p.min || p.default < p.min || p.default > p.max)) {
    throw new Error('Invalid generated lesson');
  }
  return value;
}
