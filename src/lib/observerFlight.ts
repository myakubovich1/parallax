import type { WaveParams } from './physics/wave';

/**
 * Hand-off between the entry preview's observer head and its docked miniature in the
 * top bar. Whichever side unmounts records where the head was; the side that mounts in
 * the same commit claims it and flies a snapshot across. Stale hand-offs are ignored.
 */
export interface FlightRect { x: number; y: number; w: number; h: number }
type Kind = 'dock' | 'undock';

let pending: { kind: Kind; from: FlightRect; image?: HTMLCanvasElement; at: number } | null = null;

export function leaveFlight(kind: Kind, from: FlightRect, image?: HTMLCanvasElement) {
  pending = { kind, from, image, at: performance.now() };
}

export function claimFlight(kind: Kind) {
  const p = pending;
  if (!p || p.kind !== kind || performance.now() - p.at > 1000) return null;
  pending = null;
  return p;
}

/** Last phase the learner set in the preview; the docked head keeps showing it. */
export const observerParams: WaveParams = { A1: 1, A2: 1, f: 0.5, phi: 60 };

/**
 * Flies `image` from one viewport rect to another along a gentle arc, then fades it out
 * while the destination fades in. Resolves when the destination should become visible.
 */
export function fly(image: HTMLCanvasElement, from: FlightRect, to: FlightRect, duration = 760): Promise<void> {
  Object.assign(image.style, {
    position: 'fixed',
    left: `${from.x}px`,
    top: `${from.y}px`,
    width: `${from.w}px`,
    height: `${from.h}px`,
    transformOrigin: '0 0',
    zIndex: '90',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  });
  image.setAttribute('aria-hidden', 'true');
  document.body.appendChild(image);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const s = to.w / from.w;
  const travel = image.animate(
    [
      { transform: 'translate(0, 0) scale(1)', filter: 'drop-shadow(0 0 0 rgba(195,248,107,0))' },
      // Rise first, then sweep across: the arc reads as the head lifting off the preview.
      { offset: 0.45, transform: `translate(${dx * 0.32}px, ${dy * 0.68 - 36}px) scale(${1 + (s - 1) * 0.6})`, filter: 'drop-shadow(0 0 16px rgba(195,248,107,0.55))' },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, filter: 'drop-shadow(0 0 6px rgba(195,248,107,0.35))' },
    ],
    { duration, easing: 'cubic-bezier(0.55, 0.05, 0.25, 1)', fill: 'forwards' },
  );
  return travel.finished
    .catch(() => undefined)
    .then(() => {
      const fade = image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      fade.finished.catch(() => undefined).then(() => image.remove());
    });
}
