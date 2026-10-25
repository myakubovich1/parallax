import { Icon } from './Icon';
import { Wordmark } from './Logo';
import { RobotHelpLauncher } from './RobotHelpLauncher';

interface Props { onHome: () => void; onNew: () => void; onSaved: () => void; onSettings: () => void; savedCount: number; docked: boolean; helpOpen: boolean; onHelp: (trigger: HTMLElement) => void }

export function TopBar({ onHome, onNew, onSaved, onSettings, savedCount, docked, helpOpen, onHelp }: Props) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Parallax home">
        <Wordmark />
      </button>
      <span className="brand-line">An open mind. An interactive world.</span>
      <nav className="topnav" aria-label="Main">
        <RobotHelpLauncher open={helpOpen} docked={docked} onOpen={onHelp} />
        <button className="btn ghost" onClick={onNew} aria-label="New experiment">
          <Icon name="plus" size={16} /> <span className="nav-text">New experiment</span>
        </button>
        <button className="btn ghost" onClick={onSaved} aria-label="Saved experiments">
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
