/**
 * Lesson specification. Built-in demo lessons implement this directly.
 * A future generation service should return a GeneratedLessonSpec (data only);
 * any generated code runs in SandboxedStage, never in the app's own context.
 */
export type ConceptId = 'wave-interference' | 'gravitational-attraction' | 'gradient-descent';
export type LearningMode = 'quick' | 'explore' | 'basics';
export type Params = Record<string, number>;

/** Colour role + a glyph, so association never depends on colour alone. */
export type TermTone = 'lime' | 'ice' | 'amber' | 'violet' | 'white' | 'neutral';
export const TONE_GLYPH: Record<TermTone, string> = { lime: '●', ice: '■', amber: '◆', violet: '▲', white: '◎', neutral: '' };

export interface EquationTerm {
  id: string;
  /** Mini-markup: A_1, r^2, w_{next}. */
  symbol: string;
  name: string;
  meaning: string;
  unit?: string;
  tone: TermTone;
  /** Live value text for the current parameters. */
  value?: (p: Params, ctx: LessonContext) => string;
  /** Parameter controlled by this term, if any. */
  param?: string;
}

/** Strings are literal text; objects reference a term. */
export type EquationPart = string | { term: string; text?: string };
export interface Equation { id: string; label: string; parts: EquationPart[] }

export interface ParamDef {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  digits: number;
  term: string;
  hint: string;
}

export interface Preset { id: string; label: string; params: Params; note: string }

export interface Readout { id: string; label: string; value: string; term?: string; emphasis?: boolean }

export interface Prediction {
  id: string;
  question: string;
  /** Parameters set up before the question is asked. */
  setup: Params;
  /** Parameters applied to reveal the answer. */
  reveal: Params;
  options: { id: string; label: string }[];
  correct: string;
  explain: (choice: string) => string;
}

export interface FollowUpAction {
  setParams?: Params;
  highlight?: string; // annotation id
  pinReference?: boolean;
  message: string;
}
export interface FollowUp { label: string; match: RegExp; run: (p: Params) => FollowUpAction }

/** Discrete-time state passed to lessons that step (gradient descent). */
export interface LessonContext { step: number }

export interface LessonSpec {
  id: ConceptId;
  title: string;
  kicker: string;
  renderer: 'wave' | 'gravity' | 'gradient';
  /** True when time evolves the model; false hides playback controls. */
  animated: boolean;
  /** Discrete iterations per simulated second (gradient descent). */
  stepRate?: number;
  /** One press of the "Step" control, in simulated seconds. */
  stepSeconds: (p: Params) => number;
  stageTitle: string;
  equations: Equation[];
  terms: Record<string, EquationTerm>;
  params: ParamDef[];
  presets: Preset[];
  normalize?: (p: Params) => Params;
  constraintNote?: (p: Params) => string | null;
  assumptions: string[];
  quick: string;
  understand: string[];
  basics: { background: string[]; model: string[]; tryIt: string };
  caption: (p: Params, ctx: LessonContext) => string;
  consequence: (prev: Params, next: Params) => string | null;
  readouts: (p: Params, ctx: LessonContext) => Readout[];
  compare?: (p: Params, ref: Params) => string;
  halt?: (p: Params, step: number) => string | null;
  predictions: Prediction[];
  followUps: FollowUp[];
  annotations: { id: string; label: string }[];
  /** Phrases the demo adapter accepts for this lesson. */
  matchers: RegExp[];
  examplePrompt: string;
}

/** Data-only lesson returned by the server; validated before rendering. */
export interface LegacyGeneratedLesson {
  title: string;
  equation: string;
  explanation: string[];
  /** Untrusted. Rendered only inside a sandboxed iframe. */
  stageHtml: string;
  params: Omit<ParamDef, 'term'>[];
  assumptions: string[];
}

export interface ExperimentLesson extends LegacyGeneratedLesson {
  version: 2;
  plan: { objective: string; takeaway: string; misconception: string; interaction: string; observation: string; visualReason: string };
  constants: {id: string; symbol: string; label: string; value: number; unit: string; meaning: string}[];
  outputs: {id: string; symbol: string; label: string; unit: string; displayUnit: string; formula: string[]; digits: number; meaning: string}[];
  equationParts: {text: string; termId: string}[];
  renderer: {kind: 'comparison' | 'spring' | 'custom'; inputId: string; outputId: string; caption: string};
  presets: {label: string; values: number[]; note: string}[];
  prediction: {question: string; setup: number[]; reveal: number[]; options: string[]; correctIndex: number; explanation: string; outputId: string};
  basics: {background: string; model: string; experiment: string};
  checks: {values: number[]; outputId: string; expectedSI: number; relativeTolerance: number}[];
}
export type GeneratedLessonSpec = LegacyGeneratedLesson | ExperimentLesson;
export const isExperiment = (lesson: GeneratedLessonSpec): lesson is ExperimentLesson => 'version' in lesson && lesson.version === 2;
