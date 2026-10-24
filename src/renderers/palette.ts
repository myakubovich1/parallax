import type { TermTone } from '../lib/lessons/types';

/** Mirrors the CSS tokens for canvas/SVG drawing. */
export const C = {
  bg: '#080D0B',
  panel: '#0D1511',
  text: '#E0EBE0',
  dim: '#A3B2A6',
  rule: '#354C3D',
  lime: '#C3F86B',
  violet: '#C3C0F2',
  ice: '#B9E1CF',
  amber: '#EACB8D',
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
