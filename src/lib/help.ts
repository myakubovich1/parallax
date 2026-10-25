export interface GuideControl {
  id: string;
  label: string;
  value: string;
  hint: string;
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
export function readGuideContext(savedCount: number): GuideContext {
  const main = document.getElementById('main');
  const modal = document.querySelector<HTMLDialogElement>('dialog.dialog[open]');
  const modalTitle = modal?.querySelector('.frame-title')?.textContent?.toLowerCase() ?? '';
  const error = clean(document.querySelector('#concept-error, .gen-status.failed')?.textContent);
  const screen = modalTitle.includes('saved')
    ? 'saved'
    : modalTitle.includes('settings')
      ? 'settings'
      : error
        ? 'error'
        : main?.classList.contains('entry')
          ? 'entry'
          : 'lesson';
  const controls =
    screen === 'lesson'
      ? [...(main?.querySelectorAll<HTMLInputElement>('input[type=range]') ?? [])]
          .slice(0, 10)
          .map((input) => {
            const label = main?.querySelector(`label[for="${CSS.escape(input.id)}"]`);
            const hintId = input.getAttribute('aria-describedby');
            return {
              id: input.id,
              label: clean(label?.textContent || input.getAttribute('aria-label') || input.id, 100),
              value: clean(input.getAttribute('aria-valuetext') || input.value, 80),
              hint: clean(hintId ? document.getElementById(hintId)?.textContent : '', 240),
            };
          })
      : [];
  return {
    screen,
    title: clean(main?.querySelector('h1')?.textContent, 160),
    mode: clean(main?.querySelector<HTMLInputElement>('.mode-selector input:checked')?.value, 30),
    summary: clean(main?.querySelector('.catalog-takeaway, .experiment-takeaway, .lead')?.textContent),
    error,
    controls,
    readouts: clean(
      main?.querySelector('.experiment-readouts, .readouts, .catalog-comparison')?.textContent,
      500,
    ),
    savedCount,
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
