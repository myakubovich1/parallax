import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createApi } from './api.mjs';

const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const api = createApi();
createServer((req, res) => api(req, res, async () => {
  if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) return res.writeHead(403).end();
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404).end('Not found'); }
})).listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Parallax server started.'));
