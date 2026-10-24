import type { ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'aside';
  label?: string;
  /** Plays a one-time line sweep when the frame first appears. */
  reveal?: boolean;
}

/** The shared panel: 1px rules, corner registration marks, an optional title strip. */
export function InstrumentFrame({ title, meta, actions, children, className = '', as: Tag = 'section', label, reveal = false }: Props) {
  return (
    <Tag className={`frame ${reveal ? 'reveal' : ''} ${className}`} aria-label={label}>
      <span className="reg tl" aria-hidden="true" />
      <span className="reg tr" aria-hidden="true" />
      <span className="reg bl" aria-hidden="true" />
      <span className="reg br" aria-hidden="true" />
      {(title || meta || actions) && (
        <header className="frame-strip">
          {title && <span className="frame-title">{title}</span>}
          {meta && <span className="frame-meta">{meta}</span>}
          {actions && <span className="frame-actions">{actions}</span>}
        </header>
      )}
      {children}
    </Tag>
  );
}
