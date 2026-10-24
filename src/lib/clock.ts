import { useEffect, useRef, useState, type RefObject } from 'react';

/** Simulated time, shared by a stage and its renderer without re-rendering React each frame. */
export class SimClock {
  t = 0;
  private listeners = new Set<() => void>();
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  set(t: number) {
    this.t = t;
    this.listeners.forEach((fn) => fn());
  }
}

/** Advances the clock while playing, visible on screen, and the tab is shown. */
export function useSimClock(playing: boolean, speed: number, active: boolean): SimClock {
  const clock = useRef(new SimClock()).current;
  const pageVisible = usePageVisible();
  useEffect(() => {
    if (!playing || !active || !pageVisible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000); // rAF time can precede performance.now(); cap so a stalled tab doesn't jump
      last = now;
      clock.set(clock.t + dt * speed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, playing, speed, active, pageVisible]);
  return clock;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

export function useOnScreen(ref: RefObject<Element>): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Calls draw() whenever the clock ticks or deps change. */
export function useClockDraw(clock: SimClock, draw: () => void, deps: unknown[]) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => clock.subscribe(() => drawRef.current()), [clock]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => drawRef.current(), deps);
}
