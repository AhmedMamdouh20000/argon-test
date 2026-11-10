// يحمّل خطوط Readex Pro وAref Ruqaa من Google Fonts (OFL) كـ woff2 محلية.
// تشغيل مرة واحدة: node scripts/fetch-fonts.mjs
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = new URL('../assets/fonts/', import.meta.url);
await mkdir(out, { recursive: true });

async function css(q) { return (await fetch(`https://fonts.googleapis.com/css2?${q}&display=swap`, { headers: { 'user-agent': UA } })).text(); }
function pick(text, subset) {
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{[^}]*?url\((https:[^)]+\.woff2)\)/g;
  for (const m of text.matchAll(re)) if (m[1] === subset) return m[2];
  throw new Error('subset not found: ' + subset);
}
async function save(url, name) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(new URL(name, out), buf); console.log(name, buf.length);
}
const readex = await css('family=Readex+Pro:wght@200..700');
await save(pick(readex, 'arabic'), 'readex-arabic.woff2');
await save(pick(readex, 'latin'), 'readex-latin.woff2');
const ruqaa = await css('family=Aref+Ruqaa:wght@700');
await save(pick(ruqaa, 'arabic'), 'ruqaa.woff2');
