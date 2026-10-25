import { useEffect, useRef } from 'react';
import { SVG_LABEL_LAYOUT } from './svgLabelLayout';
import { STAGE_HEALTH } from './stageHealth';
import type { Params } from '../lib/lessons/types';

/**
 * Boundary for future AI-generated visuals. Generated HTML/JS is untrusted:
 * it runs in an opaque-origin iframe (no allow-same-origin), so it cannot read
 * app storage, cookies or the DOM. Parameters go in, and only typed messages come out.
 * Rendering successfully says nothing about scientific correctness; generated
 * lessons need their own validation before being presented as accurate.
 */
export function SandboxedStage({ html, params, title, onMessage, focused, expected, onIssue, onChecked }: { html: string; params: Params; title: string; focused?: string | null; expected?: Record<string, {si: number}>; onIssue?: (issue: string) => void; onChecked?: () => void; onMessage?: (data: { type: 'ready' } | { type: 'value'; id: string; value: number }) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const expectedRef = useRef(expected);
  expectedRef.current = expected;
  const issueRef = useRef(onIssue);
  issueRef.current = onIssue;
  const reported = useRef(new Set<string>());
  const checkedRef = useRef(onChecked);
  checkedRef.current = onChecked;
  const accepted = useRef(false);
  const sendParams = () => ref.current?.contentWindow?.postMessage({ type: 'params', params: paramsRef.current }, '*');
  useEffect(() => {
    reported.current.clear();
    accepted.current = false;
    ref.current?.contentWindow?.postMessage({ type: 'params', params }, '*');
    if (!expected) return;
    const timer = setTimeout(() => {
      if (!accepted.current || Object.keys(expectedRef.current ?? {}).some(id => !reported.current.has(id))) issueRef.current?.('The scene did not confirm its calculations and layout.');
    }, 2500);
    return () => clearTimeout(timer);
  }, [params]);
  useEffect(() => { ref.current?.contentWindow?.postMessage({type: 'focus', id: focused}, '*'); }, [focused]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'ready') { sendParams(); onMessage?.({ type: 'ready' }); }
      else if (d?.type === 'value' && typeof d.id === 'string' && Number.isFinite(d.value)) {
        const target = expectedRef.current?.[d.id];
        if (target) {
          reported.current.add(d.id);
          if (Math.abs(target.si - d.value) > Math.max(Math.abs(target.si) * 1e-6, 1e-20)) issueRef.current?.('The scene’s numbers disagree with the shared calculation.');
        }
        onMessage?.({ type: 'value', id: d.id, value: d.value });
      }
      else if (d?.type === 'stage-issue' && typeof d.issue === 'string' && expectedRef.current) issueRef.current?.(d.issue.slice(0, 160));
      else if (d?.type === 'stage-checked' && expectedRef.current && !accepted.current && Object.keys(expectedRef.current).every(id => reported.current.has(id))) {
        accepted.current = true;
        checkedRef.current?.();
      }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onMessage]);
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";
  return (
    <iframe
      ref={ref}
      onLoad={sendParams}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:auto;background:#10201a;color:#e0ebe0;font:14px system-ui}*{box-sizing:border-box}body>svg,body>canvas{display:block;max-width:100%;max-height:100%}</style><script>${STAGE_HEALTH}</script>${html}<script>${SVG_LABEL_LAYOUT}</script>`}
      className="sandboxed-stage"
    />
  );
}
