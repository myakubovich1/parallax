import { Icon } from './Icon';
import { Wordmark } from './Logo';

interface Props { onHome: () => void; onNew: () => void; onSaved: () => void; onSettings: () => void; savedCount: number }

export function TopBar({ onHome, onNew, onSaved, onSettings, savedCount }: Props) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Parallax home">
        <Wordmark />
      </button>
      <span className="brand-line">Turn ideas into intuition.</span>
      <nav className="topnav" aria-label="Main">
        <button className="btn ghost" onClick={onNew}>
          <Icon name="plus" size={16} /> <span className="nav-text">New experiment</span>
        </button>
        <button className="btn ghost" onClick={onSaved}>
          <Icon name="saved" size={16} /> <span className="nav-text">Saved experiments</span>
          {savedCount > 0 && <span className="count" aria-label={`${savedCount} saved`}>{savedCount}</span>}
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="Settings">
          <Icon name="settings" />
        </button>
      </nav>
    </header>
  );
}
