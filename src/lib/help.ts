export interface GuideControl {
  id: string;
  label: string;
  value: string;
  hint: string;
  symbol?: string;
  available?: boolean;
}
export interface GuideExperiment {
  id: string;
  kind: 'authored' | 'catalog' | 'generated' | 'legacy' | 'preview';
  equation: string;
  terms: { symbol: string; label: string; meaning: string; value: string }[];
  assumptions: string[];
  state: string;
  reference: string;
}
export interface GuideSnapshot extends GuideExperiment {
  title: string;
  mode: string;
  summary: string;
  controls: GuideControl[];
  readouts: string;
}
export interface GuideContext {
  screen: 'entry' | 'lesson' | 'saved' | 'settings' | 'error';
  title: string;
  mode: string;
  summary: string;
  error: string;
  controls: GuideControl[];
  readouts: string;
  savedCount: number;
  experiment?: GuideExperiment | null;
  focusedControlId?: string | null;
}
export type GuideAction =
  | { type: 'fill-question'; question: string }
  | { type: 'open-library' | 'open-saved' | 'open-settings' | 'show-modes' }
  | { type: 'highlight-control'; controlId: string };
export interface GuideReply {
  answer: string;
  actions: GuideAction[];
  source: 'guide' | 'gemma';
}
export interface GuideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: GuideAction[];
  source?: 'guide' | 'gemma';
}

const clean = (text: string | null | undefined, limit = 500) =>
  (text ?? '')
    .replace(/sk-[\w-]{12,}|AIza[\w-]{25,}/g, '[redacted key]')
    .trim()
    .slice(0, limit);
export function readGuideContext(
  savedCount: number,
  snapshot: GuideSnapshot | null,
  focusedId: string | null,
): GuideContext {
  const modal = document.querySelector<HTMLDialogElement>('dialog.dialog[open]');
  const modalTitle = modal?.querySelector('.frame-title')?.textContent?.toLowerCase() ?? '';
  const error = clean(document.querySelector('#concept-error, .gen-status.failed')?.textContent);
  const screen = modalTitle.includes('saved')
    ? 'saved'
    : modalTitle.includes('settings')
      ? 'settings'
      : error
        ? 'error'
        : snapshot && snapshot.kind !== 'preview'
          ? 'lesson'
          : 'entry';
  const controls = (snapshot?.controls ?? []).slice(0, 10).map((control) => {
    const input = document.getElementById(control.id);
    return {
      ...control,
      label: clean(control.label, 100),
      value: clean(control.value, 80),
      hint: clean(control.hint, 240),
      available: Boolean(input && input.getClientRects().length && !input.closest('[inert]')),
    };
  });
  const experiment: GuideExperiment | null = snapshot
    ? {
        id: clean(snapshot.id, 100),
        kind: snapshot.kind,
        equation: clean(snapshot.equation, 1800),
        terms: snapshot.terms
          .slice(0, 24)
          .map((term) => ({
            symbol: clean(term.symbol, 60),
            label: clean(term.label, 100),
            meaning: clean(term.meaning, 300),
            value: clean(term.value, 100),
          })),
        assumptions: snapshot.assumptions.slice(0, 8).map((line) => clean(line, 300)),
        state: clean(snapshot.state, 1000),
        reference: clean(snapshot.reference, 700),
      }
    : null;
  return {
    screen,
    title: clean(snapshot?.title, 160),
    mode: clean(
      snapshot?.mode || document.querySelector<HTMLInputElement>('.mode-selector input:checked')?.value,
      30,
    ),
    summary: clean(snapshot?.summary, 1000),
    error,
    controls,
    readouts: clean(snapshot?.readouts, 1400),
    savedCount,
    experiment,
    focusedControlId: controls.some((c) => c.id === focusedId) ? focusedId : null,
  };
}
export function guideSuggestions(context: GuideContext): string[] {
  if (context.screen === 'saved')
    return [
      'Where are my experiments saved?',
      'Can I open them on another device?',
      'How do I start a new experiment?',
    ];
  if (context.screen === 'settings')
    return [
      'What does reduced motion do?',
      'How do I turn visual effects off?',
      'Which learning mode should I choose?',
    ];
  if (context.screen === 'error')
    return ['Why couldn’t this open?', 'How can I rephrase my question?', 'Can I explore without AI?'];
  if (context.screen === 'lesson')
    return ['What should I try first?', 'What does this control change?', 'Explain what just happened'];
  return ['What can I enter?', 'Show me a good example', 'Which learning mode should I choose?'];
}
export function guideActionLabel(action: GuideAction): string {
  return action.type === 'fill-question'
    ? 'Use this question'
    : action.type === 'open-library'
      ? 'Browse the library'
      : action.type === 'open-saved'
        ? 'Open saved experiments'
        : action.type === 'open-settings'
          ? 'Open settings'
          : action.type === 'show-modes'
            ? 'Show learning modes'
            : 'Highlight this control';
}
