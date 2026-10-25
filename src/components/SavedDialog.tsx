import { fixed } from '../lib/format';
import { LESSON_BY_ID } from '../lib/lessons/registry';
import type { SavedExperiment } from '../lib/storage';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { MODES } from './ModeSelector';

interface Props { open: boolean; onClose: () => void; items: SavedExperiment[]; onOpen: (e: SavedExperiment) => void; onDelete: (id: string) => void }

export function SavedDialog({ open, onClose, items, onOpen, onDelete }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Saved experiments" meta="This browser only">
      {items.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 120 64" width="120" height="64" aria-hidden="true">
            <rect x="1" y="1" width="118" height="62" fill="none" stroke="var(--rule)" strokeDasharray="3 3" />
            <path d="M8 40 C 20 16, 32 16, 44 40 S 68 64, 80 40 S 104 16, 112 32" fill="none" stroke="var(--violet)" strokeOpacity="0.5" />
            <circle cx="60" cy="40" r="2" fill="var(--lime)" />
          </svg>
          <p className="setting-name">No saved experiments yet</p>
          <p className="muted small">Use <strong>Save</strong> in any lesson to keep its settings here. Saved experiments are stored in this browser only and aren’t synced.</p>
        </div>
      ) : (
        <ul className="saved-list">
          {items.map((e) => {
            const lesson = e.generatedLesson ?? (e.conceptId ? LESSON_BY_ID[e.conceptId] : undefined);
            if (!lesson) return null;
            const summary = lesson.params.map((d) => `${d.symbol.replace(/_(\w)/, '$1')} ${fixed(e.params[d.id] ?? d.default, d.digits)}${d.unit && d.unit !== 'rel.' ? ` ${d.unit}` : ''}`).join(' · ');
            return (
              <li key={e.id} className="saved-item">
                <div className="saved-info">
                  <p className="saved-title">{e.title}</p>
                  <p className="mono small">{summary}</p>
                  <p className="muted small">{MODES.find((m) => m.id === e.mode)?.label} · {new Date(e.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="saved-actions">
                  <button className="btn primary small" onClick={() => onOpen(e)}>Open</button>
                  <button className="icon-btn" onClick={() => onDelete(e.id)} aria-label={`Delete ${e.title}`}><Icon name="trash" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
