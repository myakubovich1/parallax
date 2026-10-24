import { MathText } from '../components/MathText';
import { InstrumentFrame } from '../components/InstrumentFrame';
import { TONE_GLYPH, type LessonContext, type LessonSpec, type Params } from '../lib/lessons/types';

interface Props {
  lesson: LessonSpec;
  params: Params;
  ctx: LessonContext;
  focused: string | null;
  pinned: string | null;
  onHover: (id: string | null) => void;
  onTogglePin: (id: string) => void;
  onJumpToControl: (paramId: string) => void;
}

export function EquationStrip({ lesson, params, ctx, focused, pinned, onHover, onTogglePin, onJumpToControl }: Props) {
  const term = focused ? lesson.terms[focused] : null;
  return (
    <InstrumentFrame className="equation-frame" title="Equation" meta="Select a term to trace it">
      <div className="equation-scroll" role="region" aria-label="Equations, scrollable" tabIndex={0}>
        {lesson.equations.map((eq) => (
          <div className="equation-row" key={eq.id}>
            <span className="eq-label">{eq.label}</span>
            <span className="eq-math">
              {eq.parts.map((part, i) => {
                if (typeof part === 'string') return <span key={i} className="eq-op">{part}</span>;
                const t = lesson.terms[part.term];
                const value = t.value?.(params, ctx);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`term tone-${t.tone} ${focused === t.id ? 'active' : ''}`}
                    aria-pressed={pinned === t.id}
                    aria-label={`${t.name}${value ? `, ${value}` : ''}${t.unit && !value ? `, in ${t.unit}` : ''}`}
                    onMouseEnter={() => onHover(t.id)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(t.id)}
                    onBlur={() => onHover(null)}
                    onClick={() => onTogglePin(t.id)}
                  >
                    <MathText text={part.text ?? t.symbol} />
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      <div className={`term-card ${term ? `tone-${term.tone}` : 'empty'}`}>
        {term ? (
          <>
            <div className="term-head">
              <span className="term-glyph" aria-hidden="true">{TONE_GLYPH[term.tone]}</span>
              <span className="term-sym"><MathText text={term.symbol} /></span>
              <span className="term-name">{term.name}</span>
              {term.value && <span className="term-value">{term.value(params, ctx)}</span>}
            </div>
            <p className="term-meaning">
              {term.meaning}
              {term.unit && <span className="term-unit"> Unit: {term.unit}.</span>}
            </p>
            {term.param && (
              <button type="button" className="link-btn" onClick={() => onJumpToControl(term.param!)}>
                Adjust <MathText text={term.symbol} /> →
              </button>
            )}
          </>
        ) : (
          <p className="term-meaning muted">Hover, tab to or select any term to see its meaning, unit and current value, and where it lives in the picture.</p>
        )}
      </div>
    </InstrumentFrame>
  );
}
