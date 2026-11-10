// إدارة الصوت: WebAudio beep للتنبيهات، وتشغيل صوت الأذان (assets/adhan.mp3 أو ملف مخصص)
let audioCtx = null;
let adhanAudio = null;
let customAdhanDataUrl = null;

try {
  if (typeof localStorage !== 'undefined') {
    customAdhanDataUrl = localStorage.getItem('mk3_custom_adhan') || null;
  }
} catch {}

export function setCustomAdhan(dataUrl) {
  customAdhanDataUrl = dataUrl || null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (dataUrl) localStorage.setItem('mk3_custom_adhan', dataUrl);
      else localStorage.removeItem('mk3_custom_adhan');
    }
  } catch {}
}

export function hasCustomAdhan() {
  return Boolean(customAdhanDataUrl);
}

export function playBeep(enabled = true) {
  if (!enabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.14); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // تجاهل في حالة حظر المتصفح للصوت التلقائي
  }
}

export function playAdhan({ loop = true } = {}) {
  stopAdhan();
  try {
    const src = customAdhanDataUrl || 'assets/adhan.mp3';
    adhanAudio = new Audio(src);
    adhanAudio.loop = Boolean(loop);
    adhanAudio.volume = 0.9;
    const p = adhanAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // fallback to gentle chime if autoplay blocked
        playBeep(true);
      });
    }
  } catch {
    playBeep(true);
  }
}

export function stopAdhan() {
  if (adhanAudio) {
    try {
      adhanAudio.pause();
      adhanAudio.currentTime = 0;
    } catch {}
    adhanAudio = null;
  }
}
