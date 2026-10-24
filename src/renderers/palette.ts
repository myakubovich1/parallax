import type { TermTone } from '../lib/lessons/types';

/** Mirrors the CSS tokens for canvas/SVG drawing. */
export const C = {
  bg: '#080A0D',
  panel: '#101319',
  text: '#EEF0FA',
  dim: '#ADB4C7',
  rule: '#353B50',
  lime: '#CBFF69',
  violet: '#C6BEFF',
  ice: '#A9E7FF',
  amber: '#FFC46B',
};

export const TONE_COLOR: Record<TermTone, string> = {
  lime: C.lime,
  ice: C.ice,
  amber: C.amber,
  violet: C.violet,
  white: C.text,
  neutral: C.dim,
};

export const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Deterministic pseudo-random sequence so textures don't shimmer between frames. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
