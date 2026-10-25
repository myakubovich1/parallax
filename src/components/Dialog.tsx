import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; meta?: string }

/** Native modal dialog: focus containment, Escape and inert background come from the platform. */
export function Dialog({ open, onClose, title, children, meta }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog frame"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <span className="reg tl" aria-hidden="true" />
      <span className="reg tr" aria-hidden="true" />
      <span className="reg bl" aria-hidden="true" />
      <span className="reg br" aria-hidden="true" />
      <header className="frame-strip">
        <h2 id={titleId} className="frame-title">{title}</h2>
        {meta && <span className="frame-meta">{meta}</span>}
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-body">{open && children}</div>
    </dialog>
  );
}
