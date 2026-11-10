// تبويب «لوحتي» (reports.js): تقرير آخر اليوم + إحصائيات الأيام السابقة (أعمدة أسبوعية)
import { html, render, isoDate, addDays, dayNameAr, formatDateAr, formatTime12, timeToMinutes } from '../core/util.js';
import { store } from '../core/store.js';
import { buildReport, PRAYER_KEYS, PRAYER_NAMES_AR } from '../core/report-core.js';

export function buildCurrentReportForDate(dateStr) {
  const tasks = store.list('task');
  const prayers = {};
  for (const p of store.list('prayer')) {
    prayers[p.id] = p;
  }
  return buildReport({ date: dateStr, tasks, prayers });
}

export function checkDailyReportTick(now = new Date()) {
  const todayStr = isoDate(now);
  const mainSetting = store.getRecord('setting', 'main') || {};
  const repTime = mainSetting.reportTime || '23:00';
  const repMin = timeToMinutes(repTime);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (repMin >= 0 && nowMin >= repMin) {
    const existing = store.getRecord('report', todayStr);
    if (!existing) {
      const snap = buildCurrentReportForDate(todayStr);
      store.patch('report', todayStr, snap);
    }
  }
}

export function renderReportsTab(container, { now = new Date() } = {}) {
  const todayStr = isoDate(now);
  const todayReport = buildCurrentReportForDate(todayStr);

  // إحصائيات آخر 7 أيام للرسم البياني بالأعمدة
  const weekBars = [];
  let totalWeekDone = 0;
  let totalWeekPostponed = 0;

  for (let i = 6; i >= 0; i--) {
    const dStr = addDays(todayStr, -i);
    const rep = buildCurrentReportForDate(dStr);
    totalWeekDone += rep.done;
    totalWeekPostponed += rep.postponed;
    weekBars.push({
      date: dStr,
      label: i === 0 ? 'اليوم' : dayNameAr(dStr, true),
      pct: rep.pct,
      done: rep.done,
      total: rep.total
    });
  }

  render(
    container,
    html`
      <div class="masonry-grid">
        <!-- تقرير اليوم التفصيلي -->
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="sec-title">تقرير اليوم</h2>
              <p class="muted-sub">${formatDateAr(todayStr)}</p>
            </div>
            <span class="badge badge-lg">${todayReport.pct}% إنجاز</span>
          </div>

          <div class="report-kpi-grid">
            <div class="kpi-box ok">
              <strong class="kpi-val" id="rep-done">${todayReport.done}</strong>
              <span class="kpi-lbl">مهام تمت</span>
            </div>
            <div class="kpi-box brand">
              <strong class="kpi-val" id="rep-pending">${todayReport.pending}</strong>
              <span class="kpi-lbl">لسه باقية</span>
            </div>
            <div class="kpi-box warn">
              <strong class="kpi-val" id="rep-postponed">${todayReport.postponed}</strong>
              <span class="kpi-lbl">اتأجلت</span>
            </div>
            <div class="kpi-box muted">
              <strong class="kpi-val" id="rep-cancelled">${todayReport.cancelled}</strong>
              <span class="kpi-lbl">اتلغت</span>
            </div>
          </div>

          <h3 class="sec-title mt-md">حالة الصلوات الخمس اليوم</h3>
          <div class="report-prayers-row">
            ${PRAYER_KEYS.map((k) => {
              const st = todayReport.prayers[k];
              const stLabel = st === 'prayed' ? 'صليت ✓' : st === 'promised' ? 'هصلي' : 'لسه';
              return html`
                <div class="rep-pray-chip st-${st}">
                  <strong>${PRAYER_NAMES_AR[k]}</strong>
                  <span>${stLabel}</span>
                </div>
              `;
            })}
          </div>

          <h3 class="sec-title mt-md">ملخص مهام اليوم بالوقت</h3>
          ${todayReport.tasks.length === 0
            ? html`<p class="muted-sub">مفيش مهام متسجلة النهارده.</p>`
            : html`
                <ul class="rep-task-list">
                  ${todayReport.tasks.map(
                    (t) => html`
                      <li class="rep-task-row st-${t.status}">
                        <span>${t.title}</span>
                        <span class="muted-sub">${t.time ? formatTime12(t.time) : 'بدون وقت'}</span>
                      </li>
                    `
                  )}
                </ul>
              `}
        </section>

        <!-- الرسم البياني الأسبوعي وإحصائيات الأيام السابقة -->
        <section class="card">
          <div class="card-head">
            <h3 class="sec-title">إحصائيات آخر 7 أيام</h3>
            <span class="badge">${totalWeekDone} منجزة / ${totalWeekPostponed} مؤجلة</span>
          </div>

          <div class="week-chart" role="img" aria-label="رسم بياني لإنجاز الأسبوع">
            ${weekBars.map(
              (b) => html`
                <div class="bar-col">
                  <div class="bar-track">
                    <div class="bar-fill" style="height: ${Math.max(6, b.pct)}%" title="${b.done}/${b.total} (${b.pct}%)"></div>
                  </div>
                  <span class="bar-pct">${b.pct}%</span>
                  <span class="bar-lbl">${b.label}</span>
                </div>
              `
            )}
          </div>
        </section>
      </div>
    `
  );
}
