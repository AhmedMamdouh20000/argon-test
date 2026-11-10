import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const mp4Path = path.join(ROOT, 'mukhattati-demo.mp4');
const qaDir = path.join(ROOT, 'demo_work', 'qa');
fs.mkdirSync(qaDir, { recursive: true });

const probe = spawnSync(
  ffprobe.path,
  [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,duration',
    '-of', 'json',
    mp4Path
  ],
  { encoding: 'utf8' }
);
console.log('=== ffprobe output ===');
console.log(probe.stdout);

const st = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo_work', 'scene_times.json'), 'utf8'));
const picks = {
  intro: 2.0,
  s3: st.sceneStartTimes.s3 + 2.0,
  s4: st.sceneStartTimes.s4 + 2.2,
  s7: st.sceneStartTimes.s7 + 1.2,
  s8: st.sceneStartTimes.s8 + 2.0,
  s9: st.sceneStartTimes.s9 + 6.5,
  s11: st.sceneStartTimes.s11 + 1.75,
  outro: st.totalDuration - 2.0
};

for (const [k, t] of Object.entries(picks)) {
  const outImg = path.join(qaDir, `${k}.jpg`);
  spawnSync(ffmpeg, ['-y', '-ss', t.toFixed(2), '-i', mp4Path, '-frames:v', '1', outImg]);
  console.log(`✅ Extracted ${k}.jpg at ${t.toFixed(2)}s`);
}
