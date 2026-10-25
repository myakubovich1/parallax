import { useMemo, useState } from 'react';
import { FORMULAS } from '../lib/catalog/formulas';
import { LESSONS } from '../lib/lessons/registry';
export function FormulaLibrary({ onSelect }: { onSelect: (prompt: string) => void }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All');
  const entries = useMemo(
    () => [
      ...LESSONS.map((l) => ({
        id: l.id,
        title: l.title,
        equation: l.equations
          .map((e) =>
            e.parts
              .map((p) => (typeof p === 'string' ? p : (p.text ?? l.terms[p.term]?.symbol ?? '')))
              .join(''),
          )
          .join(' · '),
        category:
          l.id === 'gradient-descent'
            ? 'Mathematics'
            : l.id === 'wave-interference'
              ? 'Waves'
              : 'Mechanics',
        prompt: l.examplePrompt,
      })),
      ...FORMULAS.map((f) => ({ ...f, prompt: f.title })),
    ],
    [],
  );
  const filtered = entries.filter(
    (f) =>
      (category === 'All' || f.category === category) &&
      `${f.title} ${f.equation}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="formula-library" aria-label="Preloaded formula library">
      <button
        type="button"
        className="library-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="instrument-label">The formula collection</span>
          <strong>50 experiments. Ready to explore.</strong>
        </span>
        <span>{open ? 'Close −' : 'Browse library +'}</span>
      </button>
      {open && (
        <div className="library-content">
          <div className="library-filters">
            <label>
              Find a formula
              <input
                type="search"
                placeholder="e.g. kinetic energy, Ohm’s law"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Subject
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {[
                  'All',
                  'Mechanics',
                  'Waves',
                  'Electricity',
                  'Thermodynamics',
                  'Fluids',
                  'Optics',
                  'Mathematics',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="instrument-label">{filtered.length} experiments · no API key needed</p>
          <div className="library-cards">
            {filtered.map((f, i) => (
              <button
                type="button"
                key={f.id}
                className="library-card"
                onClick={() => onSelect(f.id)}
              >
                <span className="instrument-label">
                  {String(i + 1).padStart(2, '0')} / {f.category}
                </span>
                <strong>{f.title}</strong>
                <span className="mono">{f.equation}</span>
                <span className="library-card-open">Explore →</span>
              </button>
            ))}
          </div>
          {!filtered.length && <p>No formulas match. Try another name or choose All subjects.</p>}
        </div>
      )}
    </section>
  );
}
