// المناسبات وأعياد الميلاد (events.js): عدّ تنازلي واستيراد من Google Calendar (.ics)
import { html, render, isoDate, formatDateAr, parseLocalDate } from '../core/util.js';
import { store } from '../core/store.js';
import { parseICS } from '../core/ics.js';
import { showToast } from '../ui/ui.js';

export function daysUntilEvent(event, now = new Date()) {
  if (!event?.date) return 9999;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dt = parseLocalDate(event.date);

  if (event.yearly) {
    let nextOccurrence = new Date(today.getFullYear(), dt.getMonth(), dt.getDate());
    if (nextOccurrence < today) {
      nextOccurrence = new Date(today.getFullYear() + 1, dt.getMonth(), dt.getDate());
    }
    return Math.round((nextOccurrence - today) / 86400000);
  }

  return Math.round((dt - today) / 86400000);
}

export function renderEventsSection(container, { now = new Date(), onUpdate } = {}) {
  const events = store
    .list('event')
    .map((ev) => ({ ...ev, daysLeft: daysUntilEvent(ev, now) }))
    .filter((ev) => ev.daysLeft >= -1)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  render(
    container,
    html`
      <div class="events-box">
        <div class="card-head">
          <h3 class="sec-title">🎉 المناسبات وأعياد الميلاد</h3>
          <label class="btn btn-soft btn-sm file-btn">
            📥 استيراد .ics
            <input id="ics-file-inp" type="file" accept=".ics,text/calendar" hidden />
          </label>
        </div>

        <form id="event-add-form" class="event-add-row" autocomplete="off">
          <input id="ev-name" type="text" class="input" placeholder="اسم المناسبة (مثلاً: عيد ميلاد ماما)" required />
          <input id="ev-date" type="date" class="input" value="${isoDate(now)}" required />
          <label class="check-row compact">
            <input id="ev-yearly" type="checkbox" checked />
            <span>سنوياً</span>
          </label>
          <button type="submit" class="btn btn-primary">إضافة</button>
        </form>

        ${events.length === 0
          ? html`<p class="muted-sub">مفيش مناسبات مضافة حالياً. ضيف مناسباتك أو استورد ملف .ics من تقويم جوجل.</p>`
          : html`
              <ul class="event-list">
                ${events.map((ev) => {
                  const badgeText =
                    ev.daysLeft === 0
                      ? 'النهارده! 🎂'
                      : ev.daysLeft === 1
                      ? 'بكرة'
                      : `بعد ${ev.daysLeft} يوم`;
                  return html`
                    <li class="event-item">
                      <div>
                        <strong>${ev.name}</strong>
                        <span class="muted-sub"> — ${formatDateAr(ev.date)} ${ev.yearly ? '(سنوياً)' : ''}</span>
                      </div>
                      <div class="event-right">
                        <span class="tag ${ev.daysLeft <= 3 ? 'tag-warn' : 'tag-ok'}">${badgeText}</span>
                        <button type="button" class="btn-icon ev-del" data-id="${ev.id}" aria-label="حذف">✕</button>
                      </div>
                    </li>
                  `;
                })}
              </ul>
            `}
      </div>
    `
  );

  const refresh = () => {
    renderEventsSection(container, { now, onUpdate });
    if (typeof onUpdate === 'function') onUpdate();
  };

  container.querySelector('#event-add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#ev-name').value.trim();
    const date = container.querySelector('#ev-date').value;
    const yearly = container.querySelector('#ev-yearly').checked;
    if (!name || !date) return;
    store.patch('event', null, { name, date, yearly });
    refresh();
  });

  container.querySelectorAll('.ev-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.remove('event', btn.dataset.id);
      refresh();
    });
  });

  container.querySelector('#ics-file-inp')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseICS(text);
    for (const item of parsed) {
      store.patch('event', null, item);
    }
    showToast(`تم استيراد ${parsed.length} مناسبة بنجاح`);
    refresh();
  });
}
