// منطق بناء قالب الإيميل وإرساله عبر Resend لدالة daily-report
import { buildReport, PRAYER_KEYS, PRAYER_NAMES_AR } from './report-core.js';

export function renderReportEmailHtml(report, userName = '') {
  const greeting = userName ? `مساء الخير يا ${userName}` : 'مساء الخير';
  const tasksHtml =
    report.tasks.length === 0
      ? '<p style="color:#5F7477;">لم يتم تسجيل مهام لهذا اليوم.</p>'
      : `<ul style="padding-right:18px;margin:8px 0;">${report.tasks
          .map(
            (t) =>
              `<li style="margin-bottom:6px;"><strong>${escapeHtml(t.title)}</strong> — ${
                t.status === 'done'
                  ? '✅ تمت'
                  : t.status === 'postponed'
                  ? '⏳ مؤجلة'
                  : t.status === 'cancelled'
                  ? '❌ ملغية'
                  : '🕒 باقية'
              } ${t.time ? `(${escapeHtml(t.time)})` : ''}</li>`
          )
          .join('')}</ul>`;

  const prayersHtml = PRAYER_KEYS.map((k) => {
    const st = report.prayers[k];
    const badge = st === 'prayed' ? '✅ صليت' : st === 'promised' ? '🤲 نويت' : '⚠️ لسه';
    return `<span style="display:inline-block;margin:4px;padding:6px 10px;border-radius:8px;background:#EAF1EF;color:#0F272B;font-size:13px;"><strong>${PRAYER_NAMES_AR[k]}:</strong> ${badge}</span>`;
  }).join('');

  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#EAF1EF;padding:24px;color:#0F272B;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:24px;border:1px solid #D5E1DE;">
        <h2 style="color:#0B7F7A;margin-top:0;">مُخطّطي — تقرير يوم ${escapeHtml(report.date)}</h2>
        <p>${escapeHtml(greeting)}، ده ملخص يومك النهارده:</p>
        <div style="background:#D7EFEC;padding:14px;border-radius:12px;margin:14px 0;">
          <strong>نسبة الإنجاز: ${report.pct}%</strong>
          <div>تمت: ${report.done} | باقي: ${report.pending} | مؤجلة: ${report.postponed}</div>
        </div>
        <h3>الصلوات الخمس (${report.prayedCount}/5)</h3>
        <div>${prayersHtml}</div>
        <h3 style="margin-top:18px;">مهام اليوم</h3>
        ${tasksHtml}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { buildReport };
