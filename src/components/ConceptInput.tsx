import { forwardRef, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  disabled?: boolean;
}

export const ConceptInput = forwardRef<HTMLTextAreaElement, Props>(function ConceptInput({ value, onChange, onSubmit, error, disabled }, ref) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const helpButton = useRef<HTMLButtonElement>(null);
  const closeHelp = () => {
    setHelpOpen(false);
    helpButton.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className={`concept-input ${error ? 'has-error' : ''}`} onKeyDown={(event) => {
      if (event.key === 'Escape' && helpOpen) {
        event.stopPropagation();
        closeHelp();
      }
    }}>
      <div className="concept-label-row">
        <label htmlFor="concept" className="field-label">What about the world would you like to understand?</label>
        <button
          ref={helpButton}
          type="button"
          className="icon-btn concept-help-button"
          aria-label="What can I enter and what will I get?"
          aria-expanded={helpOpen}
          aria-controls={helpId}
          title="What can I enter and what will I get?"
          onClick={() => setHelpOpen(open => !open)}
        >
          <Icon name="info" size={20} />
        </button>
      </div>
      {helpOpen && (
        <section id={helpId} className="concept-help" aria-label="How to create an experiment">
          <div className="concept-help-heading">
            <h3>What to enter</h3>
            <button type="button" className="icon-btn" aria-label="Close input help" onClick={closeHelp}><Icon name="close" size={16} /></button>
          </div>
          <p>Type a question, name a scientific concept, or paste a formula you want to understand. Keep it focused on one idea. Plain language is enough.</p>
          <ul className="concept-help-examples">
            <li>“Why do waves cancel each other out?”</li>
            <li>“Kinetic energy”</li>
            <li>“E = mc²”</li>
          </ul>
          <h3>What you’ll get</h3>
          <p>A visual experiment with an explanation, controls to change key values, and results that show what changes and why. Try a prediction, compare outcomes, or save the experiment to return to it.</p>
          <p className="concept-help-mode">Choose <strong>Quick intuition</strong> for the main idea, <strong>Explain &amp; explore</strong> for hands-on discovery, or <strong>Build from basics</strong> for a guided explanation.</p>
        </section>
      )}
      <div className="textarea-wrap">
        <span className="reg tl" aria-hidden="true" />
        <span className="reg br" aria-hidden="true" />
        <textarea
          id="concept"
          ref={ref}
          rows={3}
          value={value}
          disabled={disabled}
          placeholder="Try kinetic energy, E = mc², or a scientific question…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          aria-invalid={!!error}
          aria-describedby={`${error ? 'concept-error concept-hint' : 'concept-hint'}${helpOpen ? ` ${helpId}` : ''}`}
          spellCheck
        />
      </div>
      <div className="field-foot">
        {error ? (
          <p id="concept-error" className="field-error" role="alert">{error}</p>
        ) : (
          <span />
        )}
        <span id="concept-hint" className="kbd-hint"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> + <kbd>Enter</kbd> to create</span>
      </div>
    </div>
  );
});
