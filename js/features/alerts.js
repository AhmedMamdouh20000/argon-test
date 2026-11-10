// نظام التنبيهات الذكي (alerts.js): قبل المهمة بـ 15/30 دقيقة، وقت الميعاد، وتنبيه المساء (جهّز يوم بكرة)
import { html, render, isoDate, addDays, formatTime12, timeToMinutes } from '../core/util.js';
import { store } from '../core/store.js';
import { playBeep } from '../core/sound.js';
import { sendBrowserNotification } from '../core/notify.js';

const firedKeys = new Set();
const alertQueue = [];
let activeAlert = null;

function loadFiredKeys() {
  try {
    const raw = sessionStorage.getItem('mk3_fired_alerts');
    if (raw) {
      for (const k of JSON.parse(raw)) firedKeys.add(k);
    }
  } catch {}
}
loadFiredKeys();

function markFired(key) {
  firedKeys.add(key);
  try {
    sessionStorage.setItem('mk3_fired_alerts', JSON.stringify([...firedKeys]));
  } catch {}
}

export function enqueueAlert(alertObj) {
  if (firedKeys.has(alertObj.key)) return;
  markFired(alertObj.key);
  alertQueue.push(alertObj);
  processAlertQueue();
}

function processAlertQueue() {
  if (activeAlert || alertQueue.length === 0) return;
  // لو حوار الصلاة الإجباري مفتوح، ننتظر لما يخلص
  const prayerDlg = document.getElementById('prayer-modal');
  if (prayerDlg && prayerDlg.open) return;

  activeAlert = alertQueue.shift();
  showAlertDialog(activeAlert);
}

function showAlertDialog(item) {
  const mainSetting = store.getRecord('setting', 'main') || {};
  playBeep(mainSetting.soundOn !== false);
  sendBrowserNotification(item.title, item.subtitle, item.key);

  let dlg = document.getElementById('alert-modal');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'alert-modal';
    dlg.className = 'modal alert-dialog';
    document.body.appendChild(dlg);
  }

  render(
    dlg,
    html`
      <div class="modal-box">
        <div class="alert-badge">${item.badge || '🔔 منبّه المهام'}</div>
        <h3 class="modal-title">${item.title}</h3>
        <p class="modal-desc">${item.subtitle}</p>
        <div class="modal-actions">
          ${item.taskId
            ? html`
                <button type="button" id="al-btn-done" class="btn btn-primary">تمت ✓</button>
                <button type="button" id="al-btn-snooze" class="btn btn-soft">فكّرني بعد 10 دقايق</button>
              `
            : ''}
          <button type="button" id="al-btn-close" class="btn btn-ghost">إغلاق</button>
        </div>
      </div>
    `
  );

  const finish = () => {
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    else dlg.removeAttribute('open');
    activeAlert = null;
    if (typeof window.__onAppStateChange === 'function') window.__onAppStateChange();
    setTimeout(processAlertQueue, 150);
  };

  dlg.querySelector('#al-btn-done')?.addEventListener('click', () => {
    if (item.taskId) {
      store.patch('task', item.taskId, { status: 'done' });
    }
    finish();
  });

  dlg.querySelector('#al-btn-snooze')?.addEventListener('click', () => {
    if (item.taskId) {
      const task = store.getRecord('task', item.taskId);
      if (task && task.time) {
        const mins = timeToMinutes(task.time) + 10;
        const nh = Math.floor((mins % 1440) / 60);
        const nm = mins % 60;
        const nextTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
        store.patch('task', item.taskId, { time: nextTime });
      }
    }
    finish();
  });

  dlg.querySelector('#al-btn-close')?.addEventListener('click', finish);

  if (!dlg.open) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', 'open');
  }

  if (typeof window.__ensureDemoPopoversTop === 'function') {
    window.__ensureDemoPopoversTop();
  }
}

export function checkAlertsTick(now = new Date()) {
  const todayStr = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const mainSetting = store.getRecord('setting', 'main') || {};

  // 1) فحص تنبيهات المهام
  const tasks = store.list('task').filter((t) => t.date === todayStr && t.status === 'pending' && t.time);

  for (const t of tasks) {
    const tMin = timeToMinutes(t.time);
    if (tMin < 0) continue;
    const lead = t.far ? 30 : 15;
    const diff = tMin - nowMin;

    // تنبيه قبل الميعاد (بـ 15 أو 30 دقيقة)
    if (diff > 0 && diff <= lead) {
      enqueueAlert({
        key: `pre:${todayStr}:${t.id}:${t.time}`,
        taskId: t.id,
        badge: t.far ? '🚗 مشوار قريب' : '⏰ تذكير قبل الميعاد',
        title: t.title,
        subtitle: `فاضل ${diff} دقيقة على ميعاد المهمة (${formatTime12(t.time)})`
      });
    } else if (diff <= 0 && diff >= -30) {
      // تنبيه وقت الميعاد نفسه (لحد 30 دقيقة بعده)
      enqueueAlert({
        key: `due:${todayStr}:${t.id}:${t.time}`,
        taskId: t.id,
        badge: '🔔 دلوقتي',
        title: `حان ميعاد: ${t.title}`,
        subtitle: `الميعاد المحدد الساعة ${formatTime12(t.time)} — دلوقتي`
      });
    }
  }

  // 2) تنبيه المساء (جهّز يوم بكرة)
  const eveTime = mainSetting.eve || '21:00';
  const eveMin = timeToMinutes(eveTime);
  if (eveMin >= 0 && nowMin >= eveMin && nowMin <= eveMin + 30) {
    const tomStr = addDays(todayStr, 1);
    const tomTasks = store.list('task').filter((t) => t.date === tomStr && t.status !== 'cancelled');
    enqueueAlert({
      key: `eve:${todayStr}`,
      taskId: null,
      badge: '🌙 المساء',
      title: 'جهّز يوم بكرة',
      subtitle:
        tomTasks.length > 0
          ? `عندك ${tomTasks.length} مهام متسجلة لبكرة. راجعها أو ضيف اللي ناقصك في هدوء.`
          : 'يوم بكرة لسه فاضي — تحب تضيف أهم 3 مهام لبكرة دلوقتي؟'
    });
  }

  processAlertQueue();
}
