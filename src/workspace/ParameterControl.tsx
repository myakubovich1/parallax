import { useEffect, useState } from 'react';
import { MathText } from '../components/MathText';
import { fixed } from '../lib/format';
import { TONE_GLYPH, type ParamDef, type TermTone } from '../lib/lessons/types';

interface Props {
  def: ParamDef;
  value: number;
  tone: TermTone;
  active: boolean;
  onChange: (v: number) => void;
  onFocusTerm: (id: string | null) => void;
}

export function ParameterControl({ def, value, tone, active, onChange, onFocusTerm }: Props) {
  const [draft, setDraft] = useState(fixed(value, def.digits));
  useEffect(() => setDraft(fixed(value, def.digits)), [value, def.digits]);
  const unitText = def.unit ? ` ${def.unit}` : '';
  const commit = () => {
    const v = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v);
    else setDraft(fixed(value, def.digits));
  };
  return (
    <div
      className={`param tone-${tone} ${active ? 'active' : ''}`}
      id={`param-${def.id}`}
      onMouseEnter={() => onFocusTerm(def.term)}
      onMouseLeave={() => onFocusTerm(null)}
    >
      <div className="param-head">
        <label htmlFor={`range-${def.id}`} className="param-label">
          <span className="term-glyph" aria-hidden="true">{TONE_GLYPH[tone]}</span>
          <span className="param-sym"><MathText text={def.symbol} /></span>
          {def.label}
        </label>
        <span className="param-number">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${def.label} value${def.unit ? ` in ${def.unit}` : ''}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            onFocus={() => onFocusTerm(def.term)}
          />
          {def.unit && <span className="param-unit">{def.unit}</span>}
        </span>
      </div>
      <input
        id={`range-${def.id}`}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        aria-valuetext={`${fixed(value, def.digits)}${unitText}`}
        aria-describedby={`hint-${def.id}`}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onFocus={() => onFocusTerm(def.term)}
        onBlur={() => onFocusTerm(null)}
        style={{ '--fill': `${((value - def.min) / (def.max - def.min)) * 100}%` } as React.CSSProperties}
      />
      <div className="param-foot" id={`hint-${def.id}`}>
        <span>{def.hint}</span>
        <span>{fixed(def.min, def.digits)}–{fixed(def.max, def.digits)}{unitText}</span>
      </div>
    </div>
  );
}
