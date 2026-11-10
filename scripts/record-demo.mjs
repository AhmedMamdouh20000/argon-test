// سكريبت تصوير وإنتاج فيديو الديمو (2560×1440 @ 60fps — Deterministic Frame Stepping + Audio Mix)
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { routeLocal } from './serve.mjs';

const ffprobePath = ffprobeStatic.path;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORK_DIR = path.join(ROOT, 'demo_work');
const FRAMES_DIR = path.join(WORK_DIR, 'frames');
const AUDIO_DIR = path.join(WORK_DIR, 'audio');
const FINAL_MP4 = path.join(ROOT, 'mukhattati-demo.mp4');

await fs.rm(FRAMES_DIR, { recursive: true, force: true });
await fs.mkdir(FRAMES_DIR, { recursive: true });

const scriptData = JSON.parse(await fs.readFile(path.join(ROOT, 'script.json'), 'utf8'));
const audioMeta = JSON.parse(await fs.readFile(path.join(AUDIO_DIR, 'audio_meta.json'), 'utf8'));
const audioDurMap = Object.fromEntries(audioMeta.map((m) => [m.id, Number(m.duration)]));

const BASE_URL = 'http://localhost:8123';

console.log('🎬 بدء تصوير فيديو الديمو فريم بفريم (Deterministic 2560×1440 @ 60fps)...');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2, // ينتج 2560×1440 بالظبط
  locale: 'ar-EG',
  timezoneId: 'Africa/Cairo'
});

await routeLocal(context, BASE_URL);
const page = await context.newPage();

// تثبيت الساعة المزيفة على الساعة 11:25 صباحاً يوم 2026-11-10 (قبل صلاة الظهر 11:39)
const initialTime = new Date('2026-11-10T11:25:00+02:00');
await page.clock.install({ time: initialTime });
await page.clock.pauseAt(initialTime);

await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });

// حقن الأوفرلاي (الكابشن #__cap، المؤشر #__cur، الموجة #__rip، وكروت المقدمة/الخاتمة #__title) ودالة __frame(dt, x, y)
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = `
    #__title, #__cap, #__cur, #__rip {
      border: none;
      margin: 0;
      padding: 0;
      background: transparent;
      pointer-events: none;
      overflow: visible;
    }
    /* الفخ المهم في البند 10.4: إخفاء البوب-أوفر عند إغلاقه حتى مع وجود display:grid أو flex */
    #__title:not(:popover-open),
    #__cap:not(:popover-open),
    #__cur:not(:popover-open),
    #__rip:not(:popover-open) {
      display: none !important;
    }

    #__title {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 50% 35%, #114B4F 0%, #071417 75%);
      color: #E5F2F0;
      z-index: 2147483640;
      font-family: 'Readex', sans-serif;
    }
    .__title-inner {
      text-align: center;
      transform: translateY(0) scale(1);
    }
    .__title-badge {
      width: 86px;
      height: 86px;
      border-radius: 26px;
      background: #0B7F7A;
      color: #fff;
      font-family: 'Ruqaa', serif;
      font-size: 3.3rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 14px 38px rgba(11, 127, 122, 0.55);
      margin-bottom: 14px;
      border: 2px solid rgba(255,255,255,0.22);
    }
    .__title-h1 {
      font-family: 'Ruqaa', serif;
      font-size: 4.2rem;
      color: #41C9BE;
      margin: 0 0 10px;
      line-height: 1.2;
    }
    .__title-sub {
      font-size: 1.5rem;
      color: #EAF1EF;
      opacity: 0.92;
      margin: 0;
    }
    .__title-pills {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 22px;
    }
    .__title-pill {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 0.95rem;
      color: #F2B454;
    }

    #__cap {
      position: fixed;
      inset: auto;
      top: auto;
      right: auto;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: 90vw;
      z-index: 2147483645;
      background: rgba(7, 20, 23, 0.9);
      color: #FFFFFF;
      border: 1.5px solid #41C9BE;
      padding: 10px 28px;
      border-radius: 99px;
      font-family: 'Readex', sans-serif;
      font-size: 1.08rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      white-space: nowrap;
      direction: rtl;
    }

    #__cur {
      position: fixed;
      inset: auto;
      top: 0;
      left: 0;
      width: 28px;
      height: 28px;
      z-index: 2147483647;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));
    }

    #__rip {
      position: fixed;
      inset: auto;
      top: 0;
      left: 0;
      width: 48px;
      height: 48px;
      margin-left: -24px;
      margin-top: -24px;
      border-radius: 50%;
      border: 3px solid #E9A23B;
      background: rgba(233, 162, 59, 0.28);
      z-index: 2147483646;
      opacity: 0;
      transform: scale(0.2);
    }
  `;
  document.head.appendChild(style);

  const mkPopover = (id) => {
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('popover', 'manual');
    document.body.appendChild(el);
    return el;
  };

  const titleEl = mkPopover('__title');
  const capEl = mkPopover('__cap');
  const ripEl = mkPopover('__rip');
  const curEl = mkPopover('__cur');

  curEl.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L23 13.5L14.5 16L10.5 24.5L5 3Z" fill="#E9A23B" stroke="#071417" stroke-width="2.2" stroke-linejoin="round"/>
    </svg>
  `;

  window.__demoState = {
    x: 640,
    y: 360,
    rippleAge: -1,
    rippleX: 640,
    rippleY: 360,
    titleOpen: false,
    capOpen: false
  };

  window.__ensureDemoPopoversTop = () => {
    try {
      if (window.__demoState.titleOpen) {
        titleEl.hidePopover();
        titleEl.showPopover();
      }
      if (window.__demoState.capOpen) {
        capEl.hidePopover();
        capEl.showPopover();
      }
      ripEl.hidePopover();
      ripEl.showPopover();
      curEl.hidePopover();
      curEl.showPopover();
    } catch {}
  };

  window.__setTitleCard = (open, h1 = 'مُخطّطي', sub = 'مخطّط يومي بالعربي', pills = []) => {
    window.__demoState.titleOpen = open;
    if (open) {
      const pillsHtml = pills.map((p) => `<span class="__title-pill">${p}</span>`).join('');
      titleEl.innerHTML = `
        <div class="__title-inner">
          <div class="__title-badge">م</div>
          <h1 class="__title-h1">${h1}</h1>
          <p class="__title-sub">${sub}</p>
          ${pills.length ? `<div class="__title-pills">${pillsHtml}</div>` : ''}
        </div>
      `;
      titleEl.showPopover();
    } else {
      titleEl.hidePopover();
    }
    window.__ensureDemoPopoversTop();
  };

  window.__setCaption = (text) => {
    if (text) {
      window.__demoState.capOpen = true;
      capEl.textContent = text;
      capEl.showPopover();
    } else {
      window.__demoState.capOpen = false;
      capEl.hidePopover();
    }
    window.__ensureDemoPopoversTop();
  };

  window.__triggerRipple = (x, y) => {
    window.__demoState.rippleX = x;
    window.__demoState.rippleY = y;
    window.__demoState.rippleAge = 0;
  };

  // البند 10.3: دالة __frame(dt, x, y) للتحكم اليدوي في الـ Web Animations مع استثناء pseudo-elements اللي اسمها فيه group
  window.__frame = (dtMs, x, y) => {
    if (typeof x === 'number' && typeof y === 'number') {
      window.__demoState.x = x;
      window.__demoState.y = y;
    }
    curEl.style.transform = `translate(${window.__demoState.x}px, ${window.__demoState.y}px)`;

    if (window.__demoState.rippleAge >= 0) {
      window.__demoState.rippleAge += dtMs;
      const p = Math.min(1, window.__demoState.rippleAge / 420);
      ripEl.style.left = `${window.__demoState.rippleX}px`;
      ripEl.style.top = `${window.__demoState.rippleY}px`;
      ripEl.style.transform = `scale(${0.25 + p * 1.45})`;
      ripEl.style.opacity = String(1 - p);
      if (p >= 1) window.__demoState.rippleAge = -1;
    } else {
      ripEl.style.opacity = '0';
    }

    const anims = [
      ...(document.getAnimations ? document.getAnimations() : []),
      ...(document.documentElement.getAnimations ? document.documentElement.getAnimations({ subtree: true }) : [])
    ];
    const unique = new Set(anims);
    for (const anim of unique) {
      const pseudo = anim.effect?.pseudoElement || '';
      if (pseudo.includes('group')) continue; // استثناء ::view-transition-group كما في البند 10.3
      try {
        if (anim.playState === 'running') {
          anim.pause();
        }
        const curT = Number(anim.currentTime || 0);
        anim.currentTime = curT + dtMs;
      } catch {}
    }
  };

  curEl.showPopover();
  ripEl.showPopover();
});

let frameIdx = 0;
let virtualElapsedSec = 0;
const framesManifest = [];
let curPos = { x: 640, y: 360 };

async function captureStep(dtSec) {
  const dtMs = Math.round(dtSec * 1000);
  await page.clock.runFor(dtMs);
  await page.evaluate(
    ({ dt, x, y }) => {
      window.__frame(dt, x, y);
    },
    { dt: dtMs, x: curPos.x, y: curPos.y }
  );

  frameIdx++;
  const fileName = `f_${String(frameIdx).padStart(5, '0')}.jpg`;
  const filePath = path.join(FRAMES_DIR, fileName);
  await page.screenshot({
    path: filePath,
    type: 'jpeg',
    quality: 88
  });

  framesManifest.push({ file: fileName, duration: dtSec });
  virtualElapsedSec += dtSec;
}

// التحرك السلس للمؤشر بمعدل 60fps
async function moveCursorTo(targetX, targetY, durationSec = 0.55) {
  const steps = Math.max(1, Math.round(durationSec * 60));
  const dt = 1 / 60;
  const startX = curPos.x;
  const startY = curPos.y;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // easeInOutCubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    curPos.x = Math.round((startX + (targetX - startX) * ease) * 10) / 10;
    curPos.y = Math.round((startY + (targetY - startY) * ease) * 10) / 10;
    await captureStep(dt);
  }
}

async function moveToSelector(selector, durationSec = 0.55) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return curPos;
  const tx = box.x + box.width / 2;
  const ty = box.y + box.height / 2;
  await moveCursorTo(tx, ty, durationSec);
  return { x: tx, y: ty };
}

async function clickSelector(selector, { moveSec = 0.5, afterRipSec = 0.45 } = {}) {
  const pt = await moveToSelector(selector, moveSec);
  await page.evaluate(({ x, y }) => window.__triggerRipple(x, y), pt);
  await page.locator(selector).first().click();
  await page.evaluate(() => window.__ensureDemoPopoversTop());
  // تصوير موجات الضغطة بـ 60fps
  const steps = Math.max(1, Math.round(afterRipSec * 60));
  for (let i = 0; i < steps; i++) {
    await captureStep(1 / 60);
  }
}

async function typeIntoSelector(selector, text, { charSec = 0.05 } = {}) {
  await clickSelector(selector, { moveSec: 0.45, afterRipSec: 0.25 });
  const chars = [...text];
  let current = '';
  for (const ch of chars) {
    current += ch;
    await page.locator(selector).first().fill(current);
    // 3 فريمات بـ 60fps لكل حرف (0.05s)
    for (let f = 0; f < 3; f++) {
      await captureStep(1 / 60);
    }
  }
}

// انتظار ثابت بمعدل ~12fps لتوفير المساحة والوقت مع الحفاظ على التوقيت الدقيق
async function holdFor(seconds) {
  if (seconds <= 0.01) return;
  const step = 1 / 12; // ~0.083333s
  let rem = seconds;
  while (rem > step) {
    await captureStep(step);
    rem -= step;
  }
  if (rem > 0.002) {
    await captureStep(rem);
  }
}

const sceneStartTimes = {};

async function runScene(id, actionFn) {
  const sc = scriptData.scenes.find((s) => s.id === id);
  const voiceDur = audioDurMap[id] || 7.0;
  // البند 12: مدة كل مشهد = max(مدة الحركة الفعلية, مدة الجملة + 0.9 ثانية)
  const minSceneDur = voiceDur + 0.9;
  const startSec = virtualElapsedSec;
  sceneStartTimes[id] = startSec;

  console.log(`🎥 تصوير مشهد ${id} (${sc.cap}) — مدة الصوت ${voiceDur.toFixed(2)}s...`);
  await page.evaluate((cap) => window.__setCaption(cap), sc.cap);

  await actionFn();

  const elapsed = virtualElapsedSec - startSec;
  if (elapsed < minSceneDur) {
    await holdFor(minSceneDur - elapsed);
  }
}

// ============================================================================
// تسلسل المشاهد (المقدمة + s1..s12 + الخاتمة)
// ============================================================================

// 0) المقدمة (5 ثواني)
console.log('🎥 تصوير بطاقة المقدمة (5.0s)...');
await page.evaluate(() => {
  window.__setCaption('');
  window.__setTitleCard(true, 'مُخطّطي', 'مخطّط يومي بالعربي', ['المهام والتنبيهات', 'مواقيت الصلاة والأذان', 'الميزانية وتقرير اليوم']);
});
await moveCursorTo(640, 540, 0.6);
await holdFor(4.4);
await page.evaluate(() => window.__setTitleCard(false));

// s1: فتح التطبيق لأول مرة
await runScene('s1', async () => {
  await typeIntoSelector('#ob-name', 'أحمد');
  await moveToSelector('#btn-ob-cloud', 0.6);
  await holdFor(1.2);
  await moveToSelector('#btn-ob-local', 0.6);
});

// s2: اختيار مكان التخزين
await runScene('s2', async () => {
  await moveToSelector('#btn-ob-cloud', 0.55);
  await holdFor(1.0);
  await clickSelector('#btn-ob-local', { moveSec: 0.6, afterRipSec: 0.5 });
});

// s3: قوس اليوم ومواقيت الصلاة
await runScene('s3', async () => {
  await moveToSelector('.arc-svg', 0.65);
  await holdFor(1.5);
  await moveToSelector('#hero-countdown', 0.6);
});

// s4: إضافة مهمة بجملة عادية («مذاكرة الساعة 11:50»)
await runScene('s4', async () => {
  await typeIntoSelector('#quick-input', 'مذاكرة الساعة 11:50');
  await holdFor(0.8);
  await clickSelector('#quick-submit', { moveSec: 0.45, afterRipSec: 0.45 });
});

// s5: تاريخ تلقائي (بكرة) («اجتماع بكرة 5 مساءً»)
await runScene('s5', async () => {
  await typeIntoSelector('#quick-input', 'اجتماع بكرة 5 مساءً');
  await holdFor(0.7);
  await clickSelector('#quick-submit', { moveSec: 0.45, afterRipSec: 0.45 });
});

// s6: تعليم المهمة كمنجزة
await runScene('s6', async () => {
  await clickSelector('[data-action="toggle-done"]', { moveSec: 0.55, afterRipSec: 0.6 });
  await moveToSelector('.progress-ring-box', 0.6);
});

// s7: تنبيه قبل الميعاد بربع ساعة
await runScene('s7', async () => {
  // نرجع المهمة لـ pending عشان يظهر لها منبه ربع ساعة، ونقدم الساعة لـ 11:35 (قبل 11:50 بـ 15 دقيقة)
  await clickSelector('[data-action="toggle-done"]', { moveSec: 0.4, afterRipSec: 0.35 });
  const alertTime = new Date('2026-11-10T11:35:05+02:00');
  await page.clock.setFixedTime(alertTime);
  await page.evaluate(() => {
    window.__runChecksNow(new Date('2026-11-10T11:35:05+02:00'));
    window.__ensureDemoPopoversTop();
  });
  await holdFor(1.6);
  await clickSelector('#al-btn-done', { moveSec: 0.55, afterRipSec: 0.45 });
});

// s8: الأذان وحوار الصلاة الإجباري
await runScene('s8', async () => {
  // تقديم الساعة لوقت أذان الظهر في القاهرة (11:39)
  const dhuhrTime = new Date('2026-11-10T11:39:05+02:00');
  await page.clock.setFixedTime(dhuhrTime);
  await page.evaluate(() => {
    window.__runChecksNow(new Date('2026-11-10T11:39:05+02:00'));
    window.__ensureDemoPopoversTop();
  });
  await moveToSelector('#prayer-modal .modal-title', 0.6);
  await holdFor(4.0);
  await clickSelector('#btn-prayer-prayed', { moveSec: 0.6, afterRipSec: 0.5 });
});

// s9: الميزانية
await runScene('s9', async () => {
  await clickSelector('#nav-money', { moveSec: 0.55, afterRipSec: 0.45 });
  await typeIntoSelector('#inp-salary', '12000');
  await page.dispatchEvent('#inp-salary', 'change');
  await typeIntoSelector('#inp-transport', '50');
  await page.dispatchEvent('#inp-transport', 'change');
  await clickSelector('#chk-save-on', { moveSec: 0.45, afterRipSec: 0.35 });
  await typeIntoSelector('#need-name', 'إيجار وفواتير');
  await typeIntoSelector('#need-price', '3200');
  await clickSelector('#need-submit', { moveSec: 0.45, afterRipSec: 0.45 });
  await moveToSelector('#daily-spend-val', 0.55);
});

// s10: لوحتي وتقرير اليوم
await runScene('s10', async () => {
  await clickSelector('#nav-reports', { moveSec: 0.55, afterRipSec: 0.45 });
  await moveToSelector('.report-kpi-grid', 0.55);
  await holdFor(1.2);
  await moveToSelector('.week-chart', 0.55);
});

// s11: تبديل الفاتح/الداكن بدايرة (60fps طوال الحركة)
await runScene('s11', async () => {
  await clickSelector('#nav-today', { moveSec: 0.5, afterRipSec: 0.4 });
  const pt = await moveToSelector('#btn-theme-toggle', 0.55);
  await page.evaluate(({ x, y }) => window.__triggerRipple(x, y), pt);
  // نطلق الضغطة بدون انتظار انتهاء الـ transition عشان نصور الـ 45 فريم أثناء توسع الدائرة!
  const clickPromise = page.locator('#btn-theme-toggle').first().click();
  await page.waitForTimeout(30);
  await page.evaluate(() => window.__ensureDemoPopoversTop());
  // تصوير توسع الدائرة بالكامل بـ 60fps (1.0 ثانية = 60 فريم)
  for (let i = 0; i < 60; i++) {
    await captureStep(1 / 60);
  }
  await clickPromise.catch(() => {});
  await page.evaluate(() => window.__ensureDemoPopoversTop());
});

// s12: مخطّطي — جرّبه من الرابط
await runScene('s12', async () => {
  await moveToSelector('.hero-card', 0.65);
  await holdFor(1.2);
});

// 13) الخاتمة (4.5 ثانية)
console.log('🎥 تصوير بطاقة الخاتمة (4.5s)...');
await page.evaluate(() => {
  window.__setCaption('');
  window.__setTitleCard(true, 'مُخطّطي', 'جرّبه الآن — شغّال على الموبايل واللاب', ['مجاناً وبالعربي', 'يعمل بدون إنترنت PWA']);
});
await moveCursorTo(640, 560, 0.6);
await holdFor(3.9);

await context.close();
await browser.close();

// كتابة ملف frames.txt لـ ffmpeg concat demuxer
const concatLines = [];
for (const f of framesManifest) {
  concatLines.push(`file '${f.file}'`);
  concatLines.push(`duration ${f.duration.toFixed(6)}`);
}
// تكرار آخر فريم لضمان قراءة آخر مدة في concat demuxer
const lastFrame = framesManifest[framesManifest.length - 1];
concatLines.push(`file '${lastFrame.file}'`);

const framesTxtPath = path.join(FRAMES_DIR, 'frames.txt');
await fs.writeFile(framesTxtPath, concatLines.join('\n'), 'utf8');

console.log(`✅ تم تصوير ${framesManifest.length} فريم بإجمالي مدة ${virtualElapsedSec.toFixed(2)} ثانية.`);

// ============================================================================
// البند 12: مكساج الصوت (التعليق الصوتي لكل مشهد بتأخير +0.3s + صوت الأذان في s8 بمستوى ~0.16 وتلاشي)
// ============================================================================
console.log('🎚️ جاري عمل مكساج الصوت (Voiceover + Adhan under s8 + loudnorm)...');

const audioMixPath = path.join(WORK_DIR, 'audio_mix.m4a');
const adhanMp3Path = path.join(ROOT, 'assets', 'adhan.mp3');

const ffInputs = [];
const filterParts = [];
const mixLabels = [];

// إدخال صمت بطول الفيديو بالكامل كقاعدة للمكساج
ffInputs.push('-f', 'lavfi', '-t', virtualElapsedSec.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo');
mixLabels.push('[0:a]');

scriptData.scenes.forEach((sc, idx) => {
  const wavPath = path.join(AUDIO_DIR, `${sc.id}.wav`);
  ffInputs.push('-i', wavPath);
  const inputIdx = idx + 1;
  const delayMs = Math.round((sceneStartTimes[sc.id] + 0.3) * 1000);
  const lbl = `[vo${inputIdx}]`;
  filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=1.0${lbl}`);
  mixLabels.push(lbl);
});

// إضافة صوت الأذان تحت مشهد s8 بصوت منخفض (~0.16) وتلاشي قبل المشهد التالي (s9)
const adhanInputIdx = scriptData.scenes.length + 1;
ffInputs.push('-i', adhanMp3Path);
const s8Start = sceneStartTimes.s8;
const s9Start = sceneStartTimes.s9;
const s8Dur = Math.max(4, s9Start - s8Start - 0.4);
const adhanDelayMs = Math.round(s8Start * 1000);
const fadeOutStart = Math.max(1, s8Dur - 1.8).toFixed(2);
filterParts.push(
  `[${adhanInputIdx}:a]atrim=0:${s8Dur.toFixed(2)},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.6,volume=0.16,adelay=${adhanDelayMs}|${adhanDelayMs}[adhan]`
);
mixLabels.push('[adhan]');

const totalInputs = mixLabels.length;
filterParts.push(
  `${mixLabels.join('')}amix=inputs=${totalInputs}:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`
);

const mixRes = spawnSync(
  ffmpegPath,
  [
    '-y',
    ...ffInputs,
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[aout]',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '44100',
    audioMixPath
  ],
  { stdio: 'inherit' }
);
if (mixRes.status !== 0) {
  throw new Error('فشل مكساج الصوت في ffmpeg');
}

// ============================================================================
// تجميع الفيديو من الفريمات (2560×1440 @ 60fps، libx264 -crf 19) ودمج الصوت
// ============================================================================
console.log('🎞️ جاري تجميع الفيديو النهائي (2560×1440 @ 60fps، H.264 CRF 19 + AAC 192k)...');

const videoOnlyPath = path.join(WORK_DIR, 'video_only.mp4');
const encRes = spawnSync(
  ffmpegPath,
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    framesTxtPath,
    '-vf',
    'fps=60,scale=2560:1440:flags=lanczos,format=yuv420p',
    '-r',
    '60',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    videoOnlyPath
  ],
  { stdio: 'inherit' }
);
if (encRes.status !== 0) {
  throw new Error('فشل تشفير الفيديو في ffmpeg');
}

const muxRes = spawnSync(
  ffmpegPath,
  [
    '-y',
    '-i',
    videoOnlyPath,
    '-i',
    audioMixPath,
    '-c:v',
    'copy',
    '-c:a',
    'copy',
    '-shortest',
    FINAL_MP4
  ],
  { stdio: 'inherit' }
);
if (muxRes.status !== 0) {
  throw new Error('فشل دمج الصوت والفيديو في mukhattati-demo.mp4');
}

// حفظ التوقيتات لاستخراج فريمات الفحص البصري في البند 13
await fs.writeFile(
  path.join(WORK_DIR, 'scene_times.json'),
  JSON.stringify({ sceneStartTimes, totalDuration: virtualElapsedSec }, null, 2),
  'utf8'
);

console.log(`🎉 تم إنتاج الفيديو النهائي بنجاح: ${FINAL_MP4}`);
