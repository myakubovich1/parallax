import { useEffect, useRef, useState } from 'react';
import { MiniObserver } from '../renderers/MiniObserver';

export function RobotHelpLauncher({
  open,
  docked,
  onOpen,
}: {
  open: boolean;
  docked: boolean;
  onOpen: (trigger: HTMLElement) => void;
}) {
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const clear = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div
      className="robot-help-launcher"
      ref={wrapper}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && !open) {
          clear();
          timer.current = setTimeout(() => setPreview(true), 300);
        }
      }}
      onPointerLeave={() => {
        clear();
        timer.current = setTimeout(() => setPreview(false), 180);
      }}
      onBlur={(event) => {
        if (!wrapper.current?.contains(event.relatedTarget as Node | null)) setPreview(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={`robot-help-trigger ${open ? 'active' : ''}`}
        aria-label="Ask Parallax"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="parallax-help-dialog"
        onFocus={() => {
          if (!open && button.current?.matches(':focus-visible')) setPreview(true);
        }}
        onClick={(event) => {
          clear();
          setPreview(false);
          onOpen(event.currentTarget);
        }}
      >
        <MiniObserver key={docked ? 'docked' : 'welcome'} flight={docked} />
        <span className="robot-help-dot" aria-hidden="true">
          ?
        </span>
      </button>
      {preview && !open && (
        <div className="robot-help-preview" role="region" aria-label="Meet your Parallax guide">
          <strong>Need a hand?</strong>
          <p>I can help you choose a question, understand the controls, or find your way around.</p>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setPreview(false);
              if (button.current) onOpen(button.current);
            }}
          >
            Ask Parallax →
          </button>
        </div>
      )}
    </div>
  );
}
