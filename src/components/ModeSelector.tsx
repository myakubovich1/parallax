import type { LearningMode } from '../lib/lessons/types';

export const MODES: { id: LearningMode; label: string; desc: string }[] = [
  { id: 'quick', label: 'Quick intuition', desc: 'A concise visual explanation' },
  { id: 'explore', label: 'Explain & explore', desc: 'A short explanation plus an interactive experiment' },
  { id: 'basics', label: 'Build from basics', desc: 'Background, step-by-step model, then experiment' },
];

interface Props { value: LearningMode; onChange: (m: LearningMode) => void; compact?: boolean; name?: string }

export function ModeSelector({ value, onChange, compact = false, name = 'mode' }: Props) {
  return (
    <fieldset className={`mode-selector ${compact ? 'compact' : ''}`}>
      <legend className={compact ? 'sr-only' : 'field-label'}>Learning mode</legend>
      <div className="mode-options">
        {MODES.map((m) => (
          <label key={m.id} className={`mode-option ${value === m.id ? 'selected' : ''}`} title={m.desc}>
            <input type="radio" name={name} value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} />
            <span className="mode-name">{m.label}</span>
            {!compact && <span className="mode-desc">{m.desc}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
