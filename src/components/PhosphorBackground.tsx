import { useEffect, useRef } from 'react';
import { usePageVisible } from '../lib/clock';
import { useSettings } from '../lib/settings';

// Ordered dithering keeps the grain stable as the surface bends under the pointer.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
interface Grain { x: number; y: number; height: number; threshold: number; ice: boolean }

/** Shared decorative surface. Draws on demand, sleeps when idle, never handles clicks. */
export function PhosphorBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { effects, reducedMotion } = useSettings();
  const visible = usePageVisible();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !effects || !visible) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let grain: Grain[] = [];
    let frame = 0;
    let last = 0;
    let strength = 0;
    let targetStrength = 0;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(280, width * 0.42);
      const radiusSquared = radius * radius;
      for (const point of grain) {
        const dx = point.x - x;
        const dy = point.y - y;
        const proximity = Math.max(0, 1 - (dx * dx + dy * dy) / radiusSquared);
        const lift = proximity * proximity * strength;
        const ridge = (Math.sin(point.height * 25 + lift * 5) + 1) * 0.5;
        const density = 0.14 + point.height * 0.36 + ridge * 0.2 + lift * 0.23;
        if (point.threshold > density) continue;

        const offsetX = dx * lift * 0.1;
        const offsetY = -lift * 34;
        const px = Math.round(point.x + offsetX);
        const py = Math.round(point.y + offsetY);
        ctx.fillStyle = point.ice ? '#9bd4d5' : '#b2dc6d';
        ctx.globalAlpha = 0.05 + point.height * 0.18 + ridge * 0.1 + lift * 0.24;
        const size = lift > 0.4 ? 3 : 2;
        ctx.fillRect(px, py, size, size);

        // Sparse vertical edges give the raised region volume instead of a flat glow.
        if (lift > 0.12 && point.threshold < 0.15) {
          ctx.globalAlpha = lift * 0.09;
          ctx.fillRect(px, py + size + 2, 1, Math.max(1, Math.round(lift * 23)));
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      // Limit animation work to 30 fps; the eased surface settles and stops entirely.
      if (last && now - last < 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const easing = 1 - Math.exp(-Math.min(64, now - (last || now - 32)) / 110);
      last = now;
      x += (targetX - x) * easing;
      y += (targetY - y) * easing;
      strength += (targetStrength - strength) * easing;
      paint();
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2 || Math.abs(targetStrength - strength) > 0.002) {
        frame = requestAnimationFrame(tick);
      } else {
        x = targetX;
        y = targetY;
        strength = targetStrength;
        paint();
        last = 0;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // CSS-pixel resolution is intentional: crisp bitmap grain, bounded on large screens.
      canvas.width = width;
      canvas.height = height;
      const step = Math.max(6, Math.ceil(Math.sqrt(width * height / 44000) / 2) * 2);
      grain = [];
      for (let row = 0, gy = -36; gy < height + 40; row++, gy += step) {
        for (let col = 0, gx = -step; gx < width + step; col++, gx += step) {
          const u = gx / width;
          const v = gy / height;
          const left = Math.exp(-(((u - 0.04) / 0.32) ** 2 + ((v - 0.6) / 0.55) ** 2));
          const right = Math.exp(-(((u - 0.93) / 0.4) ** 2 + ((v - 0.22) / 0.5) ** 2));
          const wave = Math.sin(u * 8 + v * 5) * 0.09;
          grain.push({
            x: gx,
            y: gy,
            height: Math.max(0, left * 0.8 + right * 0.65 + wave),
            threshold: (BAYER[(row % 4) * 4 + (col % 4)] + 0.5) / 16,
            ice: u > 0.57,
          });
        }
      }
      paint();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion) return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!strength && !targetStrength) { x = targetX; y = targetY; }
      targetStrength = 1;
      schedule();
    };
    const leave = () => { targetStrength = 0; schedule(); };

    resize();
    window.addEventListener('resize', resize);
    if (!reducedMotion) {
      window.addEventListener('pointermove', move, { passive: true });
      document.documentElement.addEventListener('pointerleave', leave);
      window.addEventListener('blur', leave);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, [effects, reducedMotion, visible]);

  return effects ? <canvas ref={ref} className="phosphor-background" aria-hidden="true" /> : null;
}
