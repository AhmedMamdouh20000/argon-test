// يولّد أيقونات PWA (شعار «م» بخط رقعة على teal) بـ Playwright
// node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const font = (await readFile(new URL('../assets/fonts/ruqaa.woff2', import.meta.url))).toString('base64');
const svg = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<style>@font-face{font-family:R;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700}</style>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E918B"/><stop offset="1" stop-color="#0A6763"/></linearGradient></defs>
<rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#g)"/>
<g transform="${maskable ? 'translate(51 51) scale(.8)' : ''}">
<circle cx="360" cy="146" r="44" fill="#E9A23B"/>
<path d="M${maskable ? -64 : 0} 404 Q130 364 256 396 T${maskable ? 576 : 512} 388 V${maskable ? 576 : 512} H${maskable ? -64 : 0}Z" fill="#085754"/>
<text x="256" y="350" text-anchor="middle" font-family="R" font-weight="700" font-size="310" fill="#fff">م</text></g></svg>`;

await writeFile(new URL('../icons/icon.svg', import.meta.url), svg(false));
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(mask).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({ path: fileURLToPath(new URL(`../icons/${name}`, import.meta.url)), omitBackground: !mask });
  console.log(name);
}
await b.close();
