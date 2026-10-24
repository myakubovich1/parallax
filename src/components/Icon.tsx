const PATHS: Record<string, string> = {
  play: 'M7 5l12 7-12 7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  reset: 'M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4',
  step: 'M6 5l9 7-9 7zM17 5h2v14h-2z',
  full: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitfull: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  close: 'M6 6l12 12M18 6L6 18',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  saved: 'M6 3h12v18l-6-4-6 4z',
  save: 'M6 3h12v18l-6-4-6 4zM12 7v6M9 10h6',
  send: 'M4 12h14M13 6l6 6-6 6',
  rail: 'M4 5h16v14H4zM9 5v14',
  panel: 'M4 5h16v14H4zM15 5v14',
  pin: 'M12 3v10M7 8l5 5 5-5M5 21h14',
  check: 'M5 12l5 5 9-10',
  retry: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  wave: 'M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2',
  gravity: 'M7 12a3 3 0 1 0 0 .01M17 12a2 2 0 1 0 0 .01M10 12h4',
  gradient: 'M3 5c3 14 15 14 18 0M8 13l3 3',
  info: 'M12 8v.01M11 11h1v6h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter">
      <path d={PATHS[name]} fill={name === 'play' || name === 'pause' || name === 'step' ? 'currentColor' : 'none'} />
    </svg>
  );
}
