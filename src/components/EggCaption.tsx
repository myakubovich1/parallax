import { useEffect, useState } from 'react';
import { EGGS, type EggEvent } from '../lib/eggs';

/** Announces an easter egg in text, so it reaches everyone, including screen-reader users. */
export function EggCaption() {
  const [egg, setEgg] = useState<EggEvent | null>(null);
  useEffect(() => {
    let timer = 0;
    const on = (e: Event) => {
      setEgg((e as CustomEvent<EggEvent>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setEgg(null), 4200);
    };
    window.addEventListener('parallax:egg', on);
    return () => {
      window.removeEventListener('parallax:egg', on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className={`egg-caption${egg ? ' show' : ''}`} role="status" aria-live="polite">
      {egg && (
        <>
          <span className="egg-kicker">◆ Easter egg · {EGGS[egg.id]}</span>
          <span>{egg.message}</span>
        </>
      )}
    </div>
  );
}
