import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const clientFile = path.join(root, 'js', 'core', 'report-core.js');
const edgeFile = path.join(root, 'supabase', 'functions', '_shared', 'report-core.js');

const a = fs.readFileSync(clientFile, 'utf8').replace(/\r\n/g, '\n');
const b = fs.readFileSync(edgeFile, 'utf8').replace(/\r\n/g, '\n');

if (a !== b) {
  console.error('❌ خطأ: ملف report-core.js غير متطابق بين js/core/ و supabase/functions/_shared/');
  process.exit(1);
}

console.log('✅ check-shared: النسختان من report-core.js متطابقتان تماماً.');
