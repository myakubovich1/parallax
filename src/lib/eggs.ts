import { readPref, writePref } from './storage';

/**
 * Easter eggs. Each is brief, dismissed by any input, announced in text (so it reaches
 * screen readers), and never replaces lesson content. Discoveries are remembered locally.
 */
export const EGGS = {
  stare: 'Stare contest',
  poke: 'Don’t poke me',
  dizzy: 'Dizzy robot',
  sleepy: 'Sleepy observer',
  silence: 'Perfect silence',
  resonance: 'Resonance overload',
  beats: 'Beat frequency',
  coaster: 'Rollercoaster',
  overdrive: 'Phosphor overdrive',
  parallax: 'Parallax, literally',
  logo: 'Say my name',
  classic: 'A classic',
} as const;
export type EggId = keyof typeof EGGS;

export interface EggEvent { id: EggId; message: string }

const KEY = 'eggs';
export const foundEggs = (): EggId[] => readPref<EggId[]>(KEY, []).filter((id) => id in EGGS);

/** Records the discovery and asks the shell to announce it. */
export function revealEgg(id: EggId, message: string) {
  const found = foundEggs();
  if (!found.includes(id)) writePref(KEY, [...found, id]);
  window.dispatchEvent(new CustomEvent<EggEvent>('parallax:egg', { detail: { id, message } }));
}

/** Requests aimed at the observer heads (preview and docked miniature). */
export type RobotCue = 'nod' | 'resonance' | 'classic';
const robotListeners = new Set<(cue: RobotCue) => void>();
export function cueRobot(cue: RobotCue) {
  robotListeners.forEach((fn) => fn(cue));
}
export function onRobotCue(fn: (cue: RobotCue) => void) {
  robotListeners.add(fn);
  return () => void robotListeners.delete(fn);
}

/** Development-only: `?eggs-fast` shortens long idle timers so they can be verified. */
export const EGG_FAST = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('eggs-fast');

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Global key sequences: the Konami code and typing "parallax" outside any input.
 * Returns a cleanup function.
 */
export function listenForKeyEggs(handlers: { konami: () => void; parallax: () => void }) {
  let konami = 0;
  let typed = '';
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) {
      konami = 0;
      handlers.konami();
    }
    if (isTyping(e.target) || key.length !== 1) return;
    typed = (typed + key).slice(-8);
    if (typed === 'parallax') {
      typed = '';
      handlers.parallax();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/** "E=mc^2", "E = mc²", "e=m*c**2" … all count. */
export const isMassEnergy = (prompt: string) =>
  prompt.replace(/²/g, '^2').normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/\*\*/g, '^').replace(/[*·]/g, '') === 'e=mc^2';

/** Phosphor overdrive (Konami code): a temporary, app-wide CRT look. */
let overdrive = false;
const overdriveListeners = new Set<(on: boolean) => void>();
export const isOverdrive = () => overdrive;
export function setOverdrive(on: boolean) {
  overdrive = on;
  document.documentElement.dataset.overdrive = on ? 'on' : 'off';
  overdriveListeners.forEach((fn) => fn(on));
}
export function onOverdrive(fn: (on: boolean) => void) {
  overdriveListeners.add(fn);
  return () => void overdriveListeners.delete(fn);
}
