import { Suspense, lazy, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '../components/Icon';
import { InstrumentFrame } from '../components/InstrumentFrame';
import type { LessonSpec } from '../lib/lessons/types';
import type { RendererProps } from '../renderers/types';

const RENDERERS = {
  wave: lazy(() => import('../renderers/WaveRenderer')),
  gravity: lazy(() => import('../renderers/GravityRenderer')),
  gradient: lazy(() => import('../renderers/GradientRenderer')),
};

export const SPEEDS = [0.25, 0.5, 1, 2, 4];

interface Props {
  lesson: LessonSpec;
  frameRef: RefObject<HTMLDivElement>;
  renderer: RendererProps;
  playing: boolean;
  speed: number;
  halt: string | null;
  onPlayPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeed: (s: number) => void;
  overlay?: ReactNode;
}

export function SimulationStage({ lesson, frameRef, renderer, playing, speed, halt, onPlayPause, onStep, onReset, onSpeed, overlay }: Props) {
  const Renderer = RENDERERS[lesson.renderer];
  const [isFull, setFull] = useState(false);
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [frameRef]);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen().catch(() => undefined);
  };

  return (
    <div ref={frameRef} className={`stage-wrap ${isFull ? 'is-full' : ''}`}>
      <InstrumentFrame
        className="stage-frame"
        title={<><span className={`live-dot ${playing ? 'on' : ''}`} aria-hidden="true" />{lesson.title}</>}
        meta={lesson.stageTitle}
        reveal
      >
        <div className="stage-body">
          <Suspense fallback={<div className="stage-loading">Loading model…</div>}>
            <Renderer {...renderer} />
          </Suspense>
          {overlay}
          {halt && (
            <div className="halt-banner" role="status">
              <Icon name="info" size={16} />
              <span>{halt}</span>
            </div>
          )}
        </div>
        <div className="stage-controls" role="toolbar" aria-label="Playback">
          {lesson.animated ? (
            <>
              <button className="btn icon-text" onClick={onPlayPause} aria-label={playing ? 'Pause' : 'Play'}>
                <Icon name={playing ? 'pause' : 'play'} size={16} />
                <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button className="btn icon-only" onClick={onStep} aria-label={lesson.stepRate ? 'Advance one step' : 'Advance one eighth of a period'} title={lesson.stepRate ? 'One step' : '⅛ period'}>
                <Icon name="step" size={16} />
              </button>
              <button className="btn icon-only" onClick={onReset} aria-label="Reset time" title="Reset">
                <Icon name="reset" size={16} />
              </button>
              <label className="speed">
                <span className="instrument-label">Playback speed</span>
                <select value={speed} onChange={(e) => onSpeed(parseFloat(e.target.value))}>
                  {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              <button className="btn icon-text" onClick={onReset}>
                <Icon name="reset" size={16} /> <span>Reset values</span>
              </button>
              <span className="instrument-label static-note">Static force model · no time evolution</span>
            </>
          )}
          <span className="spacer" />
          {canFull && (
            <button className="btn icon-only" onClick={toggleFull} aria-label={isFull ? 'Exit fullscreen' : 'Fullscreen'} title={isFull ? 'Exit fullscreen' : 'Fullscreen'}>
              <Icon name={isFull ? 'exitfull' : 'full'} size={16} />
            </button>
          )}
        </div>
      </InstrumentFrame>
    </div>
  );
}
