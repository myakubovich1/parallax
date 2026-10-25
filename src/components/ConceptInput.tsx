import { forwardRef, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  disabled?: boolean;
}

export const ConceptInput = forwardRef<HTMLTextAreaElement, Props>(function ConceptInput({ value, onChange, onSubmit, error, disabled }, ref) {
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className={`concept-input ${error ? 'has-error' : ''}`}>
      <label htmlFor="concept" className="field-label">What about the world would you like to understand?</label>
      <div className="textarea-wrap">
        <span className="reg tl" aria-hidden="true" />
        <span className="reg br" aria-hidden="true" />
        <textarea
          id="concept"
          ref={ref}
          rows={3}
          value={value}
          disabled={disabled}
          placeholder="Ask how something in the world works…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          aria-invalid={!!error}
          aria-describedby={error ? 'concept-error concept-hint' : 'concept-hint'}
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
