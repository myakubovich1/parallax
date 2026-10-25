import { EGGS, foundEggs } from '../lib/eggs';
import { useSettings, type MotionPref } from '../lib/settings';
import { Dialog } from './Dialog';

export function SettingsDialog({ open, onClose, onHelp }: { open: boolean; onClose: () => void; onHelp?: (trigger: HTMLElement) => void }) {
  const { effects, setEffects, motion, setMotion, reducedMotion } = useSettings();
  const motions: { id: MotionPref; label: string; desc: string }[] = [
    { id: 'system', label: 'Follow system', desc: `Currently ${reducedMotion && motion === 'system' ? 'reduced' : 'full'}` },
    { id: 'reduce', label: 'Reduce motion', desc: 'Experiments start paused; step through manually' },
    { id: 'full', label: 'Full motion', desc: 'Experiments play automatically' },
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Settings" meta="Stored in this browser">
      <div className="setting">
        <div>
          <p className="setting-name" id="fx-label">Visual effects</p>
          <p className="muted small" id="fx-desc">Dithered backgrounds, hover depth, scanlines and phosphor glow across the app.</p>
        </div>
        <button role="switch" aria-checked={effects} aria-labelledby="fx-label" aria-describedby="fx-desc" className={`switch ${effects ? 'on' : ''}`} onClick={() => setEffects(!effects)}>
          <span className="switch-knob" />
          <span className="switch-text">{effects ? 'On' : 'Off'}</span>
        </button>
      </div>
      <fieldset className="setting stack">
        <legend className="setting-name">Motion</legend>
        {motions.map((m) => (
          <label key={m.id} className={`radio-row ${motion === m.id ? 'selected' : ''}`}>
            <input type="radio" name="motion" checked={motion === m.id} onChange={() => setMotion(m.id)} />
            <span>{m.label}</span>
            <span className="muted small">{m.desc}</span>
          </label>
        ))}
      </fieldset>
      <div className="setting stack">
        <p className="setting-name">Your lessons</p>
        <p className="muted small">
          Your input may be processed by the configured AI service. Saved experiments and preferences stay in this browser.
        </p>
      </div>
      {foundEggs().length > 0 && (
        <p className="muted small egg-count">◆ Easter eggs found: {foundEggs().length} of {Object.keys(EGGS).length}</p>
      )}
      {onHelp && <button type="button" className="link-btn" onClick={event => onHelp(event.currentTarget)}>Ask Parallax about settings →</button>}
    </Dialog>
  );
}
