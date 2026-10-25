import { useMemo, useState } from 'react';
import { evaluateLesson } from '../../server/lesson-engine.mjs';
import type { ExperimentLesson, Params } from '../lib/lessons/types';
import { SandboxedStage } from './SandboxedStage';

/** Check defaults and every endpoint combination before exposing generated pixels. */
export function CheckedCustomStage({
  lesson,
  params,
  focused,
  onIssue,
}: {
  lesson: ExperimentLesson;
  params: Params;
  focused: string | null;
  onIssue: (issue: string) => void;
}) {
  const probes = useMemo(() => {
    const defaults = Object.fromEntries(lesson.params.map((p) => [p.id, p.default]));
    return [
      defaults,
      ...Array.from({ length: 2 ** lesson.params.length }, (_, mask) =>
        Object.fromEntries(lesson.params.map((p, i) => [p.id, mask & (1 << i) ? p.max : p.min])),
      ),
    ];
  }, [lesson]);
  const [index, setIndex] = useState(0);
  const checking = index <= probes.length;
  const values = index < probes.length ? probes[index] : params;
  const expected = useMemo(() => evaluateLesson(lesson, values), [lesson, values]);
  return (
    <div
      className={`generated-stage checked-custom-stage ${checking ? 'checking' : ''}`}
      aria-busy={checking}
    >
      {checking && (
        <p className="custom-stage-progress" role="status">
          Checking the scene at different settings… {index + 1}/{probes.length + 1}
        </p>
      )}
      <div className="checked-custom-content" aria-hidden={checking}>
        <SandboxedStage
          html={lesson.stageHtml}
          params={values}
          title={lesson.title}
          focused={focused}
          expected={expected}
          onIssue={onIssue}
          onChecked={() => setIndex((i) => Math.min(i + 1, probes.length + 1))}
        />
      </div>
    </div>
  );
}
