// سيرفر static صغير للتجربة المحلية (بديل python3 -m http.server)
// node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = +(process.argv[2] || process.env.PORT || 8123);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ics': 'text/calendar' };

export function serve(port = PORT) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(normalize(ROOT)) || /node_modules|[\\/]\.git/.test(file)) { res.writeHead(403).end(); return; }
      const s = await stat(file); if (!s.isFile()) throw 0;
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(await readFile(file));
    } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('مش موجود'); }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

/** يخدم الملفات لـ Playwright مباشرة من الديسك (من غير شبكة) على نفس عنوان localhost */
export async function routeLocal(context, base = `http://localhost:${PORT}`) {
  await context.route(`${base}/**`, async (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    try {
      if (!file.startsWith(normalize(ROOT))) throw 0;
      await route.fulfill({ status: 200, body: await readFile(file), headers: { 'content-type': TYPES[extname(file)] || 'application/octet-stream' } });
    } catch { await route.fulfill({ status: 404, body: 'not found' }); }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  serve().then(() => console.log(`مُخطّطي شغّال على http://localhost:${PORT}`));
}
