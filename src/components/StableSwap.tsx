import type { ReactNode } from 'react';

/**
 * Shows one of several variants without changing layout when the variant changes.
 * Every variant is laid out in the same grid cell, so the container is always as tall as the
 * tallest one; inactive variants are hidden from sight, focus and assistive technology.
 * Use for panels that swap on hover or focus: a height change there can move the very
 * control under the pointer and set off a hover feedback loop (a visibly shaking panel).
 */
export function StableSwap({ active, items, className = '' }: { active: string; items: { key: string; node: ReactNode }[]; className?: string }) {
  return (
    <div className={`stable-swap ${className}`}>
      {items.map(({ key, node }) => {
        const on = key === active;
        return (
          <div key={key} className="stable-swap-item" data-active={on || undefined} aria-hidden={on ? undefined : true} {...(on ? {} : { inert: '' as unknown as boolean })}>
            {node}
          </div>
        );
      })}
    </div>
  );
}
