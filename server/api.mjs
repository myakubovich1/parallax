import http from 'node:http';
import { providerConfig, providerStatus, generationRequest, readLesson, providerFailure } from './providers.mjs';
import { instructions } from './lesson-instructions.mjs';

// Use the platform's trusted proxy route, including injected secret bindings.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) http.setGlobalProxyFromEnv?.();

export function createApi({ getConfig = () => process.env, fetchImpl = fetch } = {}) {
  const buckets = new Map();
  let active = 0;
  return async (req, res, next = () => { res.writeHead(404).end(); }) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const config = getConfig();
    let provider;
    try { provider = providerConfig(config); } catch (error) { return send(503, { error: error.message }); }
    if (path === '/api/status' && req.method === 'GET') return send(200, providerStatus(config, provider));
    if (path !== '/api/generate') return send(404, { error: 'Unknown endpoint.' });
    if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
    const hosts = [req.headers.host, req.headers['x-forwarded-host']].flatMap(h => h ? String(h).split(',').map(s => s.trim()) : []);
    if (req.headers.origin && !hosts.some(host => req.headers.origin === `http://${host}` || req.headers.origin === `https://${host}`)) return send(403, { error: 'Request origin rejected.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
    if (!provider.key) return send(503, { error: provider.missing });
    const now = Date.now();
    for (const [key, bucket] of buckets) if (now > bucket.until) buckets.delete(key);
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const bucket = buckets.get(ip) ?? { count: 0, until: now + 60000 };
    buckets.set(ip, bucket);
    if (++bucket.count > 10 || active >= 3) return send(429, { error: 'Too many requests. Please try again shortly.' });
    let body = '';
    try {
      if (req.body !== undefined && req.body !== null) {
        const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
        if (Buffer.byteLength(raw) > 16000) return send(413, { error: 'Request too large.' });
        body = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(raw.toString());
      } else {
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16000) return send(413, { error: 'Request too large.' });
        }
        body = JSON.parse(body);
      }
    } catch { return send(400, { error: 'Invalid JSON request.' }); }
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 4000 || !['quick', 'explore', 'basics'].includes(body.mode)) return send(400, { error: 'Enter a question up to 4,000 characters and a valid learning mode.' });
    active++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    let phase = 'request';
    try {
      let request = generationRequest(provider, instructions, body, controller.signal);
      let upstream = await fetchImpl(request.url, request.options);
      if (!upstream.ok) {
        // Never forward provider messages: authentication errors can contain key fragments.
        const failure = await upstream.json().catch(() => null);
        return send(upstream.status === 429 ? 429 : 502, { error: providerFailure(provider, upstream.status, failure) });
      }
      let lesson;
      phase = 'validation';
      try { lesson = readLesson(provider, await upstream.json()); }
      catch {
        // One bounded repair attempt, using the same provider and no untrusted error text.
        request = generationRequest(provider, instructions + '\nYour last response failed schema, dimensional, domain or reference checks. Rebuild a complete lesson carefully; use a shared renderer and independently recompute units and reference values.', body, controller.signal);
        phase = 'request';
        upstream = await fetchImpl(request.url, request.options);
        if (!upstream.ok) return send(upstream.status === 429 ? 429 : 502, {error: providerFailure(provider, upstream.status, await upstream.json().catch(() => null))});
        phase = 'validation';
        lesson = readLesson(provider, await upstream.json());
      }
      send(200, { lesson });
    } catch {
      if (!res.destroyed) send(502, { error: controller.signal.aborted ? 'Generation timed out. Please try again.' : phase === 'request' ? 'The server could not connect to the AI provider. Check the server’s outbound connection and try again.' : 'The AI service could not produce a lesson that passed the numerical and lesson-structure checks. Please try again.' });
    } finally {
      clearTimeout(timeout);
      res.off('close', cancel);
      active--;
    }
  };
}
