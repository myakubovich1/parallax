/** Two offset viewpoints whose sight lines converge on one point. */
export function ParallaxMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <path d="M5.5 9.5 L16 23" stroke="var(--violet)" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M26.5 9.5 L16 23" stroke="var(--lime)" strokeWidth="2.2" strokeLinecap="square" />
      <rect x="2.5" y="4.5" width="6" height="6" fill="none" stroke="var(--violet)" strokeWidth="1.8" />
      <rect x="23.5" y="4.5" width="6" height="6" fill="none" stroke="var(--lime)" strokeWidth="1.8" />
      <circle cx="16" cy="24.5" r="3.2" fill="var(--text)" />
    </svg>
  );
}

/** `mark` replaces the logo mark, e.g. with the docked observer head. */
export function Wordmark({ mark }: { mark?: React.ReactNode }) {
  return (
    <span className="wordmark">
      {mark ?? <ParallaxMark />}
      <span className="wordmark-text">PARALLAX</span>
    </span>
  );
}
