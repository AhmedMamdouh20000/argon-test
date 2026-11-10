// سكريبت تصوير فيديو الديمو المتزامن بالمللي ثانية مع ملف الصوت المرفوع (2560×1440 @ 60fps)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { routeLocal } from './serve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORK_DIR = path.join(ROOT, 'demo_work');
const FRAMES_DIR = path.join(WORK_DIR, 'frames');
const AUDIO_DIR = path.join(WORK_DIR, 'audio');
const PYTHON_EXE = 'C:\\Users\\Mobi lap\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

await fs.rm(FRAMES_DIR, { recursive: true, force: true });
await fs.mkdir(FRAMES_DIR, { recursive: true });

const scriptData = JSON.parse(await fs.readFile(path.join(ROOT, 'script.json'), 'utf8'));
const audioMeta = JSON.parse(await fs.readFile(path.join(AUDIO_DIR, 'audio_meta.json'), 'utf8'));
const audioDurMap = Object.fromEntries(audioMeta.map((m) => [m.id, Number(m.duration)]));

const BASE_URL = 'http://localhost:8123';

console.log('🎬 بدء تصوير فيديو الديمو المتزامن مع الصوت المرفوع (2560×1440 @ 60fps)...');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2, // 2560×1440
  locale: 'ar-EG',
  timezoneId: 'Africa/Cairo'
});

await routeLocal(context, BASE_URL);
const page = await context.newPage();

// تثبيت الساعة قبل صلاة الظهر بدقائق (11:25 صباحاً يوم 2026-11-10)
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
      if (pseudo.includes('group')) continue;
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

async function moveCursorTo(targetX, targetY, durationSec = 0.5) {
  const steps = Math.max(1, Math.round(durationSec * 60));
  const dt = 1 / 60;
  const startX = curPos.x;
  const startY = curPos.y;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    curPos.x = Math.round((startX + (targetX - startX) * ease) * 10) / 10;
    curPos.y = Math.round((startY + (targetY - startY) * ease) * 10) / 10;
    await captureStep(dt);
  }
}

async function moveToSelector(selector, durationSec = 0.5) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return curPos;
  const tx = box.x + box.width / 2;
  const ty = box.y + box.height / 2;
  await moveCursorTo(tx, ty, durationSec);
  return { x: tx, y: ty };
}

async function clickSelector(selector, { moveSec = 0.45, afterRipSec = 0.42 } = {}) {
  const pt = await moveToSelector(selector, moveSec);
  await page.evaluate(({ x, y }) => window.__triggerRipple(x, y), pt);
  await page.locator(selector).first().click();
  await page.evaluate(() => window.__ensureDemoPopoversTop());
  const steps = Math.max(1, Math.round(afterRipSec * 60));
  for (let i = 0; i < steps; i++) {
    await captureStep(1 / 60);
  }
}

async function typeIntoSelector(selector, text, { framesPerChar = 2 } = {}) {
  await clickSelector(selector, { moveSec: 0.4, afterRipSec: 0.22 });
  const chars = [...text];
  let current = '';
  for (const ch of chars) {
    current += ch;
    await page.locator(selector).first().fill(current);
    for (let f = 0; f < framesPerChar; f++) {
      await captureStep(1 / 60);
    }
  }
}

async function holdFor(seconds) {
  if (seconds <= 0.01) return;
  const step = 1 / 12;
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
  const voiceDur = audioDurMap[id] || 6.5;
  // مدة كل مشهد = max(مدة الحركة الفعلية, مدة الجملة + 0.9 ثانية)
  const minSceneDur = voiceDur + 0.9;
  const startSec = virtualElapsedSec;
  sceneStartTimes[id] = startSec;

  console.log(`🎥 تصوير مشهد ${id} (${sc.cap}) — مدة الجملة في صوتك ${voiceDur.toFixed(2)}s...`);
  await page.evaluate((cap) => window.__setCaption(cap), sc.cap);

  await actionFn();

  const elapsed = virtualElapsedSec - startSec;
  if (elapsed < minSceneDur) {
    await holdFor(minSceneDur - elapsed);
  }
}

// ============================================================================
// تسلسل المشاهد مضبوط بالمللي ثانية مع كلامك في الصوت المرفوع
// (لاحظ أن الصوت في كل مشهد يبدأ عند +0.3s من بداية المشهد)
// ============================================================================

// 0) المقدمة (5.0 ثواني)
console.log('🎥 تصوير بطاقة المقدمة (5.0s)...');
await page.evaluate(() => {
  window.__setCaption('');
  window.__setTitleCard(true, 'مُخطّطي', 'مخطّط يومي بالعربي', ['المهام والتنبيهات', 'مواقيت الصلاة والأذان', 'الميزانية وتقرير اليوم']);
});
await moveCursorTo(640, 540, 0.6);
await holdFor(4.4);
await page.evaluate(() => window.__setTitleCard(false));

// s1 (6.72s): "أهلا بيك. ده مخطّطي، مخطّط يومي بالعربي، فيه المهام والصلاة والفلوس. تعالى نجرّبه سوا."
await runScene('s1', async () => {
  await holdFor(0.8);
  await moveToSelector('.onboarding-brand .ruqaa-title', 0.6);
  await holdFor(1.2);
  await typeIntoSelector('#ob-name', 'أحمد', { framesPerChar: 3 });
  await holdFor(1.5);
});

// s2 (6.77s): "أول ما تفتح، بتختار تحفظ بياناتك على جهازك بس (1.5s)، أو تسجّل بجوجل وتتزامن بين كل أجهزتك (3.3s). هنختار الجهاز (5.4s)."
await runScene('s2', async () => {
  await holdFor(1.2);
  // يشاور على "على جهازي بس" لما تقول "تحفظ بياناتك على جهازك بس"
  await moveToSelector('#btn-ob-local', 0.6);
  await holdFor(1.2);
  // يشاور على "سجّل بجوجل" لما تقول "أو تسجل بجوجل وتتزامن بين كل أجهزتك"
  await moveToSelector('#btn-ob-cloud', 0.6);
  await holdFor(1.6);
  // يضغط على "على جهازي بس" بالظبط لما تقول "هنختار الجهاز" (~5.2s)
  await clickSelector('#btn-ob-local', { moveSec: 0.55, afterRipSec: 0.5 });
});

// s3 (7.82s): "ده قوس اليوم (0.4s). الشمس بتتحرك بين الصلوات الخمس (1.8s)، والسما بتتغيّر من الفجر للعشا (3.8s)، وتحتيها عدّ تنازلي للصلاة الجاية (5.8s)."
await runScene('s3', async () => {
  await holdFor(0.6);
  await moveToSelector('.arc-sun', 0.7);
  await holdFor(1.5);
  await moveToSelector('.arc-svg', 0.7);
  await holdFor(1.8);
  // ينزل للعد التنازلي بالظبط لما تقول "وتحتيها عد تنازلي للصلاة الجاية"
  await moveToSelector('#hero-countdown', 0.65);
});

// s4 (7.22s): "عشان تضيف مهمة، اكتبها بجملة عادية (0.4s). هنكتب: مذاكرة الساعة 11:50 (2.3s). والتطبيق بيفهم الوقت لوحده (5.4s)."
await runScene('s4', async () => {
  await holdFor(1.8);
  // يبدأ يكتب "مذاكرة الساعة 11:50" بالظبط لما تقول "هنكتب: مذاكرة الساعة 11:50"
  await typeIntoSelector('#quick-input', 'مذاكرة الساعة 11:50', { framesPerChar: 3 });
  // يوري المعاينة الذكية تحت الحقل لما تقول "والتطبيق بيفهم الوقت لوحده"
  await moveToSelector('#quick-preview', 0.45);
  await holdFor(1.0);
  await clickSelector('#quick-submit', { moveSec: 0.45, afterRipSec: 0.45 });
});

// s5 (3.97s): "وكمان هنكتب: اجتماع بكرة 5 مساءً (0.5s)، فبيروح لبكرة تلقائيًا (2.6s)."
await runScene('s5', async () => {
  await holdFor(0.35);
  await typeIntoSelector('#quick-input', 'اجتماع بكرة 5 مساءً', { framesPerChar: 2 });
  await holdFor(0.4);
  await clickSelector('#quick-submit', { moveSec: 0.4, afterRipSec: 0.4 });
  // يشاور على يوم "بكرة" في شريط التواريخ اللي نورت تحته نقطة المهام!
  await moveToSelector('.date-chip:nth-child(3)', 0.45);
});

// s6 (4.77s): "علّم المهمة إنها تمّت (0.4s)، وشوف دايرة الإنجاز وهي بتتحرك (1.8s)، والنسبة اللي خلّصتها والباقي (3.3s)."
await runScene('s6', async () => {
  await holdFor(0.5);
  // يضغط على علامة صح جنب المهمة لما تقول "علّم المهمة إنها تمت"
  await clickSelector('[data-action="toggle-done"]', { moveSec: 0.5, afterRipSec: 0.55 });
  // يتحرك لدايرة الإنجاز لما تقول "وشوف دايرة الإنجاز وهي بتتحرك"
  await moveToSelector('.progress-ring-box', 0.55);
  await holdFor(0.9);
  // يتحرك للعدادات لما تقول "والنسبة اللي خلصتها والباقي"
  await moveToSelector('.stat-pills', 0.5);
});

// s7 (5.12s): "قبل المهمة بربع ساعة، بيطلعلك منبّه يفكّرك (0.4s). وتقدر تأجّلها (3.1s) أو تعلّمها تمّت (4.1s)."
await runScene('s7', async () => {
  // نرجع المهمة pending ونقدم الساعة لـ 11:35 (قبل 11:50 بربع ساعة بالظبط) فيظهر المنبه فوراً
  await page.evaluate(() => {
    const tasks = JSON.parse(localStorage.getItem('mk3')).records.task;
    for (const k of Object.keys(tasks)) {
      if (tasks[k].d.time === '11:50') tasks[k].d.status = 'pending';
    }
    localStorage.setItem('mk3', JSON.stringify(JSON.parse(localStorage.getItem('mk3'))));
  });
  await clickSelector('[data-action="toggle-done"]', { moveSec: 0.25, afterRipSec: 0.15 });
  const alertTime = new Date('2026-11-10T11:35:05+02:00');
  await page.clock.setFixedTime(alertTime);
  await page.evaluate(() => {
    window.__runChecksNow(new Date('2026-11-10T11:35:05+02:00'));
    window.__ensureDemoPopoversTop();
  });
  await holdFor(2.1);
  // يشاور على زرار التأجيل لما تقول "وتقدر تأجلها"
  await moveToSelector('#al-btn-snooze', 0.5);
  await holdFor(0.5);
  // يضغط على "تمت ✓" لما تقول "أو تعلمها تمت"
  await clickSelector('#al-btn-done', { moveSec: 0.45, afterRipSec: 0.45 });
});

// s8 (7.22s): "ولما يحين وقت الصلاة، بيشتغل الأذان ويظهر حوار لازم تجاوب عليه (0.4s). مفيش اختصار (4.1s). لازم تختار: والله صلّيت (5.1s)، أو والله هصلّي (6.2s)."
await runScene('s8', async () => {
  // تقديم الساعة لوقت أذان الظهر 11:39 فيظهر الحوار الإجباري ويشتغل الأذان
  const dhuhrTime = new Date('2026-11-10T11:39:05+02:00');
  await page.clock.setFixedTime(dhuhrTime);
  await page.evaluate(() => {
    window.__runChecksNow(new Date('2026-11-10T11:39:05+02:00'));
    window.__ensureDemoPopoversTop();
  });
  await moveToSelector('#prayer-modal .modal-title', 0.6);
  await holdFor(3.8);
  // يشاور على "والله صليت" عند ثانية 5.0
  await moveToSelector('#btn-prayer-prayed', 0.5);
  await holdFor(0.5);
  // يشاور على "والله هصلي" عند ثانية 6.0 ثم يختار "والله صليت"
  await moveToSelector('#btn-prayer-promised', 0.45);
  await holdFor(0.35);
  await clickSelector('#btn-prayer-prayed', { moveSec: 0.45, afterRipSec: 0.45 });
});

// s9 (7.52s): "في تبويب الفلوس (0.4s)، اكتب مرتبك ومواصلاتك اليومية (1.4s)، وضيف احتياجاتك الشهرية (3.2s)، والتطبيق يحسب تصرف كام في اليوم (4.8s). والادخار اختياري (6.4s)."
await runScene('s9', async () => {
  // يفتح تبويب الفلوس أول ما تقول "في تبويب الفلوس"
  await clickSelector('#nav-money', { moveSec: 0.45, afterRipSec: 0.3 });
  // يكتب المرتب والمواصلات لما تقول "اكتب مرتبك ومواصلاتك اليومية"
  await typeIntoSelector('#inp-salary', '12000', { framesPerChar: 2 });
  await page.dispatchEvent('#inp-salary', 'change');
  await typeIntoSelector('#inp-transport', '50', { framesPerChar: 2 });
  await page.dispatchEvent('#inp-transport', 'change');
  // يضيف الاحتياجات الشهرية لما تقول "وضيف احتياجاتك الشهرية"
  await typeIntoSelector('#need-name', 'إيجار ونت', { framesPerChar: 2 });
  await typeIntoSelector('#need-price', '3200', { framesPerChar: 2 });
  await clickSelector('#need-submit', { moveSec: 0.35, afterRipSec: 0.35 });
  // يشاور على الصرف اليومي الكبير لما تقول "والتطبيق يحسب تصرف كام في اليوم"
  await moveToSelector('#daily-spend-val', 0.45);
  await holdFor(0.5);
  // يفعّل الادخار الاختياري لما تقول "والادخار اختياري"
  await clickSelector('#chk-save-on', { moveSec: 0.45, afterRipSec: 0.4 });
});

// s10 (4.17s): "وفي لوحتي (0.4s)، تلاقي تقرير اليوم (1.2s): كام مهمة اتعملت، وكام اتأجّلت (2.4s)."
await runScene('s10', async () => {
  await clickSelector('#nav-reports', { moveSec: 0.45, afterRipSec: 0.35 });
  await moveToSelector('#rep-done', 0.5);
  await holdFor(0.8);
  await moveToSelector('#rep-postponed', 0.5);
  await holdFor(0.8);
  await moveToSelector('.week-chart', 0.5);
});

// s11 (4.77s): "وتقدر تبدّل بين الوضع الفاتح والداكن (0.4s)، بدايرة بتتوسّع من مكان ضغطتك (2.4s)."
await runScene('s11', async () => {
  await clickSelector('#nav-today', { moveSec: 0.45, afterRipSec: 0.35 });
  await holdFor(0.8);
  // يتحرك لزرار الثيم ويضغط عليه بالظبط لما تقول "بدايرة بتتوسع من مكان ضغطتك" (~2.1s)
  const pt = await moveToSelector('#btn-theme-toggle', 0.5);
  await page.evaluate(({ x, y }) => window.__triggerRipple(x, y), pt);
  const clickPromise = page.locator('#btn-theme-toggle').first().click();
  await page.waitForTimeout(30);
  await page.evaluate(() => window.__ensureDemoPopoversTop());
  for (let i = 0; i < 60; i++) {
    await captureStep(1 / 60);
  }
  await clickPromise.catch(() => {});
  await page.evaluate(() => window.__ensureDemoPopoversTop());
});

// s12 (6.43s): "ده مخطّطي (0.4s). شغّال على الموبايل واللاب (1.8s). جرّبه من الرابط، وبالتوفيق (4.2s)."
await runScene('s12', async () => {
  await moveToSelector('.hero-card', 0.65);
  await holdFor(2.0);
  await moveToSelector('.progress-card', 0.65);
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

// حفظ بيانات الفريمات والتوقيتات لتجميع الفيديو والصوت عبر mux-demo.py
await fs.writeFile(
  path.join(WORK_DIR, 'scene_times.json'),
  JSON.stringify({ sceneStartTimes, totalDuration: virtualElapsedSec, framesManifest }, null, 2),
  'utf8'
);

console.log(`✅ تم تصوير ${framesManifest.length} فريم بإجمالي مدة ${virtualElapsedSec.toFixed(2)} ثانية.`);

const muxRes = spawnSync(PYTHON_EXE, [path.join(__dirname, 'mux-demo.py')], { stdio: 'inherit' });
if (muxRes.status !== 0) {
  throw new Error('فشل تجميع الفيديو والصوت في mux-demo.py');
}
