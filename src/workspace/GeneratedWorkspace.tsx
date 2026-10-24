import { useState } from 'react';
import type { GeneratedLessonSpec } from '../lib/lessons/types';
import { SandboxedStage } from '../renderers/SandboxedStage';
import { MathText } from '../components/MathText';

export function GeneratedWorkspace({ lesson, onExit }: { lesson: GeneratedLessonSpec; onExit: () => void }) {
  const defaults = () => Object.fromEntries(lesson.params.map(p => [p.id, p.default]));
  const [params, setParams] = useState(defaults);
  return (
    <main id="main" className="generated-workspace">
      <button className="btn" onClick={onExit}>← Back to start</button>
      <p className="instrument-label">AI-generated experiment · Check assumptions and results</p>
      <h1>{lesson.title}</h1>
      <div className="generated-grid">
        <section aria-label="Interactive experiment">
          <div className="generated-stage"><SandboxedStage html={lesson.stageHtml} params={params} title={lesson.title} /></div>
          <div className="frame generated-controls">
            {lesson.params.map(p => <label key={p.id} className="generated-param" htmlFor={`generated-${p.id}`}>
              <span>{p.label}: <output>{params[p.id].toFixed(p.digits)} {p.unit}</output></span>
              <input id={`generated-${p.id}`} type="range" min={p.min} max={p.max} step={p.step} value={params[p.id]} onChange={e => setParams(v => ({ ...v, [p.id]: Number(e.target.value) }))} />
              <span className="muted small">{p.hint}</span>
            </label>)}
            <button className="btn" onClick={() => setParams(defaults())}>Reset values</button>
          </div>
        </section>
        <aside className="frame generated-explanation">
          <h2>Equation</h2>
          <p><MathText text={lesson.equation} /></p>
          <h2>What this shows</h2>
          {lesson.explanation.map((line, i) => <p key={i}>{line}</p>)}
          <h2>Assumptions and limits</h2>
          <ul>{lesson.assumptions.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </aside>
      </div>
    </main>
  );
}
