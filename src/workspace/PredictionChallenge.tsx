import { useState } from 'react';
import type { LessonSpec, Prediction } from '../lib/lessons/types';
import { Icon } from '../components/Icon';

interface Props {
  lesson: LessonSpec;
  onSetup: (q: Prediction) => void;
  onReveal: (q: Prediction) => void;
}

type Phase = 'intro' | 'ask' | 'revealed';

export function PredictionChallenge({ lesson, onSetup, onReveal }: Props) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [choice, setChoice] = useState<string | null>(null);
  const q = lesson.predictions[idx];
  const total = lesson.predictions.length;

  const start = () => {
    onSetup(q);
    setPhase('ask');
    setChoice(null);
  };
  const choose = (id: string) => {
    setChoice(id);
    setPhase('revealed');
    onReveal(q);
  };
  const retry = () => start();
  const next = () => {
    setIdx((i) => (i + 1) % total);
    setPhase('intro');
    setChoice(null);
  };
  const correct = choice === q.correct;

  return (
    <div className="challenge">
      <div className="challenge-head">
        <span className="instrument-label">Prediction {idx + 1} / {total}</span>
        <div className="challenge-dots" aria-hidden="true">
          {lesson.predictions.map((p, i) => <span key={p.id} className={i === idx ? 'on' : ''} />)}
        </div>
      </div>
      <p className="challenge-q">{q.question}</p>

      {phase === 'intro' && (
        <>
          <p className="muted small">Predict first, then watch the experiment. Setting up changes the stage to the starting configuration and pins it as a reference.</p>
          <button className="btn primary" onClick={start}>Set up and predict</button>
        </>
      )}

      {phase !== 'intro' && (
        <div className="challenge-options" role="radiogroup" aria-label="Your prediction">
          {q.options.map((o) => {
            const state = phase === 'revealed' ? (o.id === q.correct ? 'right' : o.id === choice ? 'wrong' : '') : '';
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={choice === o.id}
                className={`option ${state}`}
                disabled={phase === 'revealed'}
                onClick={() => choose(o.id)}
              >
                <span className="option-mark" aria-hidden="true">{state === 'right' ? '✓' : state === 'wrong' ? '✕' : '○'}</span>
                {o.label}
                {state === 'right' && <span className="sr-only"> (correct answer)</span>}
                {state === 'wrong' && <span className="sr-only"> (your answer)</span>}
              </button>
            );
          })}
        </div>
      )}

      {phase === 'revealed' && choice && (
        <div className={`challenge-result ${correct ? 'right' : 'wrong'}`} role="status">
          <strong>{correct ? '✓ Your prediction matches.' : '↺ Not quite. Here’s what happened.'}</strong>
          <p>{q.explain(choice)}</p>
          <div className="row">
            <button className="btn" onClick={retry}><Icon name="retry" size={16} /> Try again</button>
            <button className="btn primary" onClick={next}>Next prediction →</button>
          </div>
        </div>
      )}
    </div>
  );
}
