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
  // Path anchors: rise first, then sweep across, so the arc reads as the head lifting off.
  const anchors = [
    { o: 0, x: 0, y: 0, k: 1 },
    { o: 0.45, x: dx * 0.32, y: dy * 0.68 - 36, k: 1 + (s - 1) * 0.6 },
    { o: 1, x: dx, y: dy, k: s },
  ];
  const at = (o: number) => {
    const i = o <= anchors[1].o ? 0 : 1;
    const a = anchors[i], b = anchors[i + 1];
    const u = (o - a.o) / (b.o - a.o);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, k: a.k + (b.k - a.k) * u };
  };
  // Motion blur and glow peak mid-flight and clear before landing. Filters apply before the
  // transform scales the element, so on-screen pixels are divided by the current scale.
  const frames = [
    { o: 0, blur: 0, glow: 0, alpha: 0 },
    { o: 0.18, blur: 4, glow: 10, alpha: 0.4 },
    { o: 0.45, blur: 7, glow: 16, alpha: 0.55 },
    { o: 0.78, blur: 3.5, glow: 10, alpha: 0.45 },
    { o: 1, blur: 0, glow: 6, alpha: 0.35 },
  ];
  const travel = image.animate(
    frames.map((f) => {
      const p = at(f.o);
      return {
        offset: f.o,
        transform: `translate(${p.x}px, ${p.y}px) scale(${p.k})`,
        filter: `blur(${(f.blur / p.k).toFixed(2)}px) drop-shadow(0 0 ${(f.glow / p.k).toFixed(2)}px rgba(195,248,107,${f.alpha}))`,
      };
    }),
    { duration, easing: 'cubic-bezier(0.55, 0.05, 0.25, 1)', fill: 'forwards' },
  );
  return travel.finished
    .catch(() => undefined)
    .then(() => {
      const fade = image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      fade.finished.catch(() => undefined).then(() => image.remove());
    });
}
