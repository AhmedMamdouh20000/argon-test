import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, 'demo_work', 'mukhattati');
const ZIP_LOCAL = path.join(ROOT, 'mukhattati.zip');
const ZIP_DOWNLOADS = 'C:\\Users\\Mobi lap\\Downloads\\mukhattati.zip';
const MP4_LOCAL = path.join(ROOT, 'mukhattati-demo.mp4');
const MP4_DOWNLOADS = 'C:\\Users\\Mobi lap\\Downloads\\mukhattati-demo.mp4';

await fs.rm(STAGE, { recursive: true, force: true });
await fs.mkdir(STAGE, { recursive: true });

// الملفات والفولدرات الخاصة بالرفع على Vercel / GitHub فقط (بدون لقطات الاختبار الثقيلة أو node_modules)
const DEPLOY_ITEMS = [
  'index.html',
  'config.js',
  'sw.js',
  'manifest.webmanifest',
  'README.md',
  'SETUP.md',
  'vercel.json',
  '.gitignore',
  '.vercelignore',
  'css',
  'js',
  'assets',
  'icons',
  'supabase',
  'scripts/check-shared.mjs'
];

for (const item of DEPLOY_ITEMS) {
  const src = path.join(ROOT, item);
  if (!existsSync(src)) continue;
  const dest = path.join(STAGE, item);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

if (existsSync(ZIP_LOCAL)) {
  await fs.rm(ZIP_LOCAL, { force: true });
}

const res = spawnSync('tar.exe', ['-a', '-c', '-f', ZIP_LOCAL, '-C', STAGE, '.'], { stdio: 'inherit' });
if (res.status !== 0) {
  throw new Error('Failed to create mukhattati.zip');
}

try {
  await fs.copyFile(ZIP_LOCAL, ZIP_DOWNLOADS);
  if (existsSync(MP4_LOCAL)) {
    await fs.copyFile(MP4_LOCAL, MP4_DOWNLOADS);
  }
} catch {}

console.log(`✅ تم إنشاء الملف المضغوط بنجاح في:\n- ${ZIP_LOCAL}\n- ${ZIP_DOWNLOADS}`);

