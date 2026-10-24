import { useEffect, useRef } from 'react';
import type { Params } from '../lib/lessons/types';

/**
 * Boundary for future AI-generated visuals. Generated HTML/JS is untrusted:
 * it runs in an opaque-origin iframe (no allow-same-origin), so it cannot read
 * app storage, cookies or the DOM. Parameters go in, and only typed messages come out.
 * Rendering successfully says nothing about scientific correctness; generated
 * lessons need their own validation before being presented as accurate.
 */
export function SandboxedStage({ html, params, title, onMessage }: { html: string; params: Params; title: string; onMessage?: (data: { type: 'ready' } | { type: 'value'; id: string; value: number }) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    ref.current?.contentWindow?.postMessage({ type: 'params', params }, '*');
  }, [params]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'ready') onMessage?.({ type: 'ready' });
      else if (d?.type === 'value' && typeof d.id === 'string' && Number.isFinite(d.value)) onMessage?.({ type: 'value', id: d.id, value: d.value });
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onMessage]);
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";
  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}">${html}`}
      className="sandboxed-stage"
    />
  );
}
