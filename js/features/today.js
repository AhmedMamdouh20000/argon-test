// تبويب «اليوم» (Today): الهيرو + قوس الشمس + شريط التواريخ + قائمة المهام + إنجاز اليوم + الإضافة السريعة
import {
  html,
  render,
  isoDate,
  addDays,
  dayNameAr,
  formatDateAr,
  formatTime12,
  parseLocalDate
} from '../core/util.js';
import { store } from '../core/store.js';
import { parseQuick } from '../core/quick.js';
import { getCityById, getNextPrayerInfo, getSkyState } from '../core/prayer.js';
import { sceneSVG, renderSunArc } from '../ui/arc.js';
import { openSheet, closeSheet, showToast } from '../ui/ui.js';

let selectedDate = null;

export function getSelectedDate(now = new Date()) {
  if (!selectedDate) selectedDate = isoDate(now);
  return selectedDate;
}

export function setSelectedDate(dateStr) {
  selectedDate = dateStr;
}

function getGreeting(now = new Date(), name = '') {
  const h = now.getHours();
  const base = h < 12 ? 'صباح الخير' : h < 17 ? 'نهارك سعيد' : 'مساء الخير';
  return name ? `${base} يا ${name}` : base;
}

function formatCountdown(mins) {
  if (mins <= 0) return 'دلوقتي';
  if (mins < 60) return `بعد ${mins} دقيقة`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `بعد ${h} ساعة`;
  return `بعد ${h} س و ${m} د`;
}

export function renderTodayTab(container, { now = new Date() } = {}) {
  const todayStr = isoDate(now);
  const activeDate = getSelectedDate(now);
  const mainSetting = store.getRecord('setting', 'main') || {};
  const city = getCityById(mainSetting.city);
  const nextPrayer = getNextPrayerInfo(now, mainSetting);
  const sky = getSkyState(now, mainSetting);

  const allTasks = store.list('task');
  const taskDatesSet = new Set(allTasks.filter((t) => t.status !== 'cancelled').map((t) => t.date));

  const dayTasks = allTasks
    .filter((t) => t.date === activeDate)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  let doneCount = 0;
  let pendingCount = 0;
  let otherCount = 0;
  for (const t of dayTasks) {
    if (t.status === 'done') doneCount++;
    else if (t.status === 'cancelled' || t.status === 'postponed') otherCount++;
    else pendingCount++;
  }
  const activeTotal = doneCount + pendingCount;
  const pct = activeTotal > 0 ? Math.round((doneCount / activeTotal) * 100) : 0;

  // حلقة الإنجاز (Progress Ring SVG)
  const radius = 38;
  const circum = 2 * Math.PI * radius;
  const dashOffset = circum - (pct / 100) * circum;

  // شريط التواريخ (7 أيام تبدأ من أمس إلى +5 أيام)
  const weekDays = [];
  for (let i = -1; i <= 5; i++) {
    const dStr = addDays(todayStr, i);
    const dt = parseLocalDate(dStr);
    weekDays.push({
      date: dStr,
      dayNum: dt.getDate(),
      label: i === 0 ? 'النهارده' : i === 1 ? 'بكرة' : dayNameAr(dStr, true),
      isActive: dStr === activeDate,
      hasTasks: taskDatesSet.has(dStr)
    });
  }

  const prayersState = {};
  for (const p of store.list('prayer')) {
    prayersState[p.id] = p;
  }

  render(
    container,
    html`
      <div class="cols today-layout">
        <!-- العمود الأول (يمين في الديسكتوب): الهيرو + كارت إنجاز اليوم -->
        <div class="col-side">
          <section class="hero-card" data-sky="${sky}">
            <div class="hero-top">
              <div>
                <p class="hero-greeting">${getGreeting(now, mainSetting.name)}</p>
                <h2 class="hero-date">${formatDateAr(todayStr)}</h2>
              </div>
              <span class="hero-city">📍 ${city.name}</span>
            </div>

            ${renderSunArc({ todayTimes: nextPrayer.todayTimes, now, prayersState, dateStr: todayStr })}

            <div class="hero-next-bar">
              <div class="hero-next-prayer">
                <span class="next-label">الصلاة الجاية:</span>
                <strong class="next-name">${nextPrayer.name} ${formatTime12(nextPrayer.time)}</strong>
              </div>
              <span class="next-countdown" id="hero-countdown">${formatCountdown(nextPrayer.minutesLeft)}</span>
            </div>

            ${sceneSVG()}
          </section>

          <section class="card progress-card" aria-label="إنجاز اليوم">
            <div class="progress-ring-box">
              <svg class="progress-ring" width="96" height="96" viewBox="0 0 96 96">
                <circle class="ring-bg" cx="48" cy="48" r="${radius}" stroke-width="8" fill="none" />
                <circle
                  class="ring-fill"
                  cx="48"
                  cy="48"
                  r="${radius}"
                  stroke-width="8"
                  fill="none"
                  stroke-dasharray="${circum.toFixed(1)}"
                  stroke-dashoffset="${dashOffset.toFixed(1)}"
                  stroke-linecap="round"
                />
              </svg>
              <div class="ring-pct">${pct}%</div>
            </div>
            <div class="progress-stats">
              <h3 class="sec-title">إنجاز ${activeDate === todayStr ? 'اليوم' : formatDateAr(activeDate)}</h3>
              <div class="stat-pills">
                <div class="stat-pill ok">
                  <span class="stat-num" id="stat-done">${doneCount}</span>
                  <span class="stat-lbl">تمت</span>
                </div>
                <div class="stat-pill brand">
                  <span class="stat-num" id="stat-pending">${pendingCount}</span>
                  <span class="stat-lbl">باقي</span>
                </div>
                <div class="stat-pill warn">
                  <span class="stat-num" id="stat-other">${otherCount}</span>
                  <span class="stat-lbl">مؤجلة/ملغية</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- العمود الثاني: شريط التواريخ + الإضافة السريعة + قائمة المهام -->
        <div class="col-main">
          <!-- شريط التواريخ الأفقي -->
          <nav class="date-strip card" aria-label="شريط أيام الأسبوع">
            ${weekDays.map(
              (d) => html`
                <button
                  type="button"
                  class="date-chip ${d.isActive ? 'active' : ''}"
                  data-date="${d.date}"
                >
                  <span class="chip-name">${d.label}</span>
                  <span class="chip-num">${d.dayNum}</span>
                  ${d.hasTasks ? html`<span class="chip-dot" title="يوجد مهام"></span>` : ''}
                </button>
              `
            )}
          </nav>

          <!-- الإضافة السريعة (Composer) -->
          <form id="quick-form" class="composer card" autocomplete="off">
            <div class="composer-row">
              <input
                id="quick-input"
                type="text"
                class="input composer-input"
                placeholder="اكتب مهمة بجملة عادية... (مثلاً: مذاكرة الساعة 11:50 أو اجتماع بكرة 5م)"
                aria-label="إضافة مهمة سريعة"
              />
              <button type="submit" id="quick-submit" class="btn btn-primary">أضف</button>
            </div>
            <div id="quick-preview" class="composer-preview">
              اكتب الوقت أو اليوم في الجملة وهنفهمه تلقائياً ✨
            </div>
          </form>

          <!-- قائمة مهام اليوم -->
          <section class="card tasks-card" aria-label="قائمة المهام">
            <div class="card-head">
              <h3 class="sec-title">مهام ${activeDate === todayStr ? 'النهارده' : formatDateAr(activeDate)}</h3>
              <span class="badge">${dayTasks.length} مهمة</span>
            </div>

            ${dayTasks.length === 0
              ? html`
                  <div class="empty-state" id="tasks-empty">
                    <div class="empty-icon">🌿</div>
                    <p>اليوم فاضي. اكتب أول مهمة تحت</p>
                  </div>
                `
              : html`
                  <ul class="task-list" id="task-list">
                    ${dayTasks.map((t) => {
                      const st = t.status || 'pending';
                      return html`
                        <li class="task-item status-${st}" data-id="${t.id}">
                          <button
                            type="button"
                            class="task-check ${st === 'done' ? 'checked' : ''}"
                            data-action="toggle-done"
                            data-id="${t.id}"
                            aria-label="تعليم المهمة كمنجزة"
                          >
                            ${st === 'done' ? '✓' : ''}
                          </button>

                          <div class="task-content">
                            <div class="task-title-row">
                              <span class="task-title">${t.title}</span>
                              ${t.far ? html`<span class="tag tag-far">مشوار بعيد</span>` : ''}
                              ${st === 'postponed' ? html`<span class="tag tag-warn">مؤجلة</span>` : ''}
                              ${st === 'cancelled' ? html`<span class="tag tag-muted">ملغية</span>` : ''}
                            </div>
                            ${t.time
                              ? html`<span class="task-time">🕒 ${formatTime12(t.time)}</span>`
                              : html`<span class="task-time muted">طول اليوم</span>`}
                          </div>

                          <div class="task-actions">
                            <button
                              type="button"
                              class="btn-sm"
                              data-action="postpone"
                              data-id="${t.id}"
                              title="تأجيل لبكرة"
                            >
                              تأجيل
                            </button>
                            <button
                              type="button"
                              class="btn-sm"
                              data-action="details"
                              data-id="${t.id}"
                            >
                              تفاصيل
                            </button>
                          </div>
                        </li>
                      `;
                    })}
                  </ul>
                `}
          </section>
        </div>
      </div>
    `
  );

  // ربط أحداث شريط التواريخ
  container.querySelectorAll('.date-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = btn.dataset.date;
      renderTodayTab(container, { now });
    });
  });

  // معاينة المحلل الفوري أثناء الكتابة
  const qInput = container.querySelector('#quick-input');
  const qPreview = container.querySelector('#quick-preview');
  const qForm = container.querySelector('#quick-form');

  qInput?.addEventListener('input', () => {
    const val = qInput.value.trim();
    if (!val) {
      qPreview.textContent = 'اكتب الوقت أو اليوم في الجملة وهنفهمه تلقائياً ✨';
      return;
    }
    const parsed = parseQuick(val, now);
    const targetDate = parsed.hasDate ? parsed.date : activeDate;
    const parts = [`📌 «${parsed.title}»`, `📅 ${formatDateAr(targetDate)}`];
    if (parsed.time) parts.push(`🕒 ${formatTime12(parsed.time)}`);
    if (parsed.far) parts.push('🚗 مشوار (تنبيه قبلها بـ 30 د)');
    qPreview.textContent = parts.join(' — ');
  });

  qForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawText = (qInput?.value || '').trim();
    if (!rawText) return;
    const parsed = parseQuick(rawText, now);
    const targetDate = parsed.hasDate ? parsed.date : activeDate;

    store.patch('task', null, {
      title: parsed.title,
      date: targetDate,
      time: parsed.time,
      far: parsed.far,
      status: 'pending'
    });

    qInput.value = '';
    if (targetDate !== activeDate) {
      showToast(`تمت الإضافة ليوم ${formatDateAr(targetDate)}`);
    }
    renderTodayTab(container, { now });
  });

  // أزرار المهام (تمت / تأجيل / تفاصيل)
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const task = store.getRecord('task', id);
      if (!task) return;

      if (action === 'toggle-done') {
        const nextStatus = task.status === 'done' ? 'pending' : 'done';
        store.patch('task', id, { status: nextStatus });
        renderTodayTab(container, { now });
      } else if (action === 'postpone') {
        const nextDay = addDays(task.date, 1);
        store.patch('task', id, { status: 'postponed', date: nextDay });
        showToast('اتأجلت المهمة لبكرة');
        renderTodayTab(container, { now });
      } else if (action === 'details') {
        openTaskDetailsSheet(task, () => renderTodayTab(container, { now }));
      }
    });
  });
}

function openTaskDetailsSheet(task, onUpdate) {
  openSheet({
    title: 'تفاصيل المهمة',
    bodyHtml: html`
      <form id="task-edit-form" class="sheet-form">
        <div class="field-group">
          <label class="field-label" for="ed-title">عنوان المهمة</label>
          <input id="ed-title" type="text" class="input" value="${task.title}" required />
        </div>
        <div class="field-row">
          <div class="field-group">
            <label class="field-label" for="ed-date">التاريخ</label>
            <input id="ed-date" type="date" class="input" value="${task.date}" />
          </div>
          <div class="field-group">
            <label class="field-label" for="ed-time">الوقت</label>
            <input id="ed-time" type="time" class="input" value="${task.time || ''}" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="ed-status">الحالة</label>
          <select id="ed-status" class="input">
            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>لسه (قيد التنفيذ)</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>تمت ✓</option>
            <option value="postponed" ${task.status === 'postponed' ? 'selected' : ''}>مؤجلة</option>
            <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>ملغية</option>
          </select>
        </div>
        <label class="check-row">
          <input id="ed-far" type="checkbox" ${task.far ? 'checked' : ''} />
          <span>مشوار بعيد (تنبيه قبل الميعاد بـ 30 دقيقة بدل 15)</span>
        </label>
        <div class="sheet-actions">
          <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
          <button type="button" id="btn-del-task" class="btn btn-danger">حذف المهمة</button>
        </div>
      </form>
    `,
    onMount(dlg) {
      const form = dlg.querySelector('#task-edit-form');
      const delBtn = dlg.querySelector('#btn-del-task');

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        store.patch('task', task.id, {
          title: dlg.querySelector('#ed-title').value.trim() || task.title,
          date: dlg.querySelector('#ed-date').value || task.date,
          time: dlg.querySelector('#ed-time').value || '',
          status: dlg.querySelector('#ed-status').value,
          far: dlg.querySelector('#ed-far').checked
        });
        closeSheet();
        onUpdate();
      });

      delBtn?.addEventListener('click', () => {
        store.remove('task', task.id);
        closeSheet();
        showToast('اتمسحت المهمة');
        onUpdate();
      });
    }
  });
}
