// ميزة الصلاة (features/prayer.js): الحوار الإجباري عند الأذان + تبويب الصلاة (كل يوم في يومه: الفروض الخمسة وقدام كل فرض حالته وأزراره)
import { html, render, isoDate, addDays, dayNameAr, formatDateAr, formatTime12, timeToMinutes, parseLocalDate } from '../core/util.js';
import { store } from '../core/store.js';
import {
  EGYPT_CITIES,
  PRAYERS_META,
  getCityById,
  computePrayerTimes
} from '../core/prayer.js';
import { playAdhan, stopAdhan } from '../core/sound.js';
import { sendBrowserNotification } from '../core/notify.js';
import { showToast } from '../ui/ui.js';

const triggeredPrayers = new Set();
let selectedPrayerDate = null;

export function checkPrayerTick(now = new Date()) {
  const todayStr = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const mainSetting = store.getRecord('setting', 'main') || {};
  const times = computePrayerTimes(now, mainSetting);

  for (const p of PRAYERS_META) {
    const pMin = timeToMinutes(times[p.key]);
    const recId = `${todayStr}:${p.key}`;
    const existing = store.getRecord('prayer', recId);

    // لو دخل وقت الصلاة (في حدود 20 دقيقة من الأذان) ولسه متسجلتش prayed أو promised
    if (nowMin >= pMin && nowMin <= pMin + 20) {
      if (!existing || (existing.s !== 'prayed' && existing.s !== 'promised')) {
        if (!triggeredPrayers.has(recId)) {
          triggeredPrayers.add(recId);
          store.patch('prayer', recId, {
            date: todayStr,
            k: p.key,
            s: 'called',
            t: times[p.key]
          });
          openMandatoryPrayerDialog(p, todayStr, times[p.key]);
          break;
        }
      }
    }
  }
}

export function openMandatoryPrayerDialog(prayerMeta, dateStr, timeStr) {
  const mainSetting = store.getRecord('setting', 'main') || {};
  const useOath = mainSetting.oath !== false;

  if (mainSetting.adhanOn !== false) {
    playAdhan({ loop: true });
  }
  sendBrowserNotification(`حان الآن وقت صلاة ${prayerMeta.name}`, 'قوم صلّي، والأذان مش هيقف غير لما تختار', `prayer-${dateStr}-${prayerMeta.key}`);

  let dlg = document.getElementById('prayer-modal');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'prayer-modal';
    dlg.className = 'modal prayer-dialog';
    document.body.appendChild(dlg);
  }

  const btnPrayedText = useOath ? 'والله صليت' : 'صليت الحمد لله';
  const btnPromisedText = useOath ? 'والله هصلي' : 'هقوم أصلي دلوقتي';

  render(
    dlg,
    html`
      <div class="modal-box prayer-modal-box">
        <div class="prayer-mosque-icon">🕌</div>
        <h2 class="modal-title ruqaa-title">حان وقت صلاة ${prayerMeta.name}</h2>
        <p class="prayer-time-pill">${formatTime12(timeStr)}</p>
        <p class="modal-desc">قوم صلّي، والأذان مش هيقف غير لما تختار</p>

        <div class="prayer-modal-actions">
          <button type="button" id="btn-prayer-prayed" class="btn btn-primary btn-lg">
            ${btnPrayedText}
          </button>
          <button type="button" id="btn-prayer-promised" class="btn btn-lamp btn-lg">
            ${btnPromisedText}
          </button>
          <button type="button" id="btn-prayer-replay" class="btn btn-ghost">
            🔊 شغّل الأذان
          </button>
        </div>
      </div>
    `
  );

  // منع الإغلاق بـ ESC أو الضغط خارج الحوار
  dlg.oncancel = (e) => {
    e.preventDefault();
  };
  dlg.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
    }
  };

  const recordChoice = (status) => {
    stopAdhan();
    const recId = `${dateStr}:${prayerMeta.key}`;
    store.patch('prayer', recId, {
      date: dateStr,
      k: prayerMeta.key,
      s: status,
      t: timeStr,
      f: Date.now()
    });
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    else dlg.removeAttribute('open');
    if (typeof window.__onAppStateChange === 'function') window.__onAppStateChange();
  };

  dlg.querySelector('#btn-prayer-prayed')?.addEventListener('click', () => recordChoice('prayed'));
  dlg.querySelector('#btn-prayer-promised')?.addEventListener('click', () => recordChoice('promised'));
  dlg.querySelector('#btn-prayer-replay')?.addEventListener('click', () => {
    playAdhan({ loop: true });
  });

  if (!dlg.open) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', 'open');
  }

  if (typeof window.__ensureDemoPopoversTop === 'function') {
    window.__ensureDemoPopoversTop();
  }
}

export function renderPrayerTab(container, { now = new Date() } = {}) {
  const todayStr = isoDate(now);
  if (!selectedPrayerDate) selectedPrayerDate = todayStr;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const mainSetting = store.getRecord('setting', 'main') || {};
  const city = getCityById(mainSetting.city);
  const selectedDt = parseLocalDate(selectedPrayerDate);
  const times = computePrayerTimes(selectedDt, mainSetting);
  const useOath = mainSetting.oath !== false;

  const prayersMap = {};
  for (const r of store.list('prayer')) {
    prayersMap[r.id] = r;
  }

  // شريط اختيار اليوم (آخر 6 أيام + النهارده) عشان كل يوم يعرض صلواته الخمسة لوحده
  const dayChips = [];
  for (let i = 0; i >= -6; i--) {
    const dStr = addDays(todayStr, i);
    const dt = parseLocalDate(dStr);
    // حساب لو اليوم ده كل صلواته اتصلت
    const allPrayed = PRAYERS_META.every((p) => prayersMap[`${dStr}:${p.key}`]?.s === 'prayed');
    dayChips.push({
      date: dStr,
      dayNum: dt.getDate(),
      label: i === 0 ? 'النهارده' : i === -1 ? 'امبارح' : dayNameAr(dStr, true),
      isActive: dStr === selectedPrayerDate,
      allPrayed
    });
  }

  let prayedTodayCount = 0;

  const rowsData = PRAYERS_META.map((p) => {
    const tStr = times[p.key];
    const pMin = timeToMinutes(tStr);
    const recId = `${selectedPrayerDate}:${p.key}`;
    const rec = prayersMap[recId];

    let isPassed = false;
    if (selectedPrayerDate < todayStr) {
      isPassed = true;
    } else if (selectedPrayerDate === todayStr) {
      isPassed = nowMin > pMin;
    }

    let status = rec?.s || (isPassed ? 'missed' : 'upcoming');
    // لو كانت مجرد called وعدى وقتها من غير تسجيل تعتبر فاتت/لسه
    if (status === 'called') status = 'missed';
    if (status === 'prayed') prayedTodayCount++;

    return {
      ...p,
      tStr,
      isPassed,
      status
    };
  });

  render(
    container,
    html`
      <div class="masonry-grid">
        <!-- صلوات اليوم المختار (كل يوم في يومه) -->
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="sec-title">
                صلوات ${selectedPrayerDate === todayStr ? 'النهارده' : formatDateAr(selectedPrayerDate)}
              </h2>
              <p class="muted-sub">📍 ${city.name} — تمّت ${prayedTodayCount} من 5 فروض</p>
            </div>
            <button type="button" id="btn-test-adhan" class="btn btn-soft">🔊 جرّب الأذان</button>
          </div>

          <!-- شريط أيام الأسبوع لاختيار اليوم وعرض صلواته في يومه -->
          <nav class="date-strip prayer-day-strip" aria-label="اختر اليوم لعرض صلواته">
            ${dayChips.map(
              (d) => html`
                <button
                  type="button"
                  class="date-chip ${d.isActive ? 'active' : ''}"
                  data-pray-date="${d.date}"
                >
                  <span class="chip-name">${d.label}</span>
                  <span class="chip-num">${d.dayNum}</span>
                  ${d.allPrayed ? html`<span class="chip-dot ok-dot" title="تمت الصلوات الخمس"></span>` : ''}
                </button>
              `
            )}
          </nav>

          <ul class="prayer-list mt-sm">
            ${rowsData.map((p) => {
              let statusBadge = html`<span class="tag tag-muted">لسه مأذنتش</span>`;
              if (p.status === 'prayed') {
                statusBadge = html`<span class="tag tag-ok">اتصلّت ✓</span>`;
              } else if (p.status === 'promised') {
                statusBadge = html`<span class="tag tag-warn">لسه (هصلّي)</span>`;
              } else if (p.status === 'missed') {
                statusBadge = html`<span class="tag tag-rose">فاتت</span>`;
              }

              return html`
                <li class="prayer-row status-${p.status}">
                  <div class="prayer-info">
                    <strong class="prayer-name">${p.name}</strong>
                    <span class="prayer-clock">${formatTime12(p.tStr)}</span>
                    ${statusBadge}
                  </div>
                  <div class="prayer-btns">
                    <button
                      type="button"
                      class="btn-sm ${p.status === 'prayed' ? 'active-ok' : ''}"
                      data-pray-key="${p.key}"
                      data-pray-status="prayed"
                    >
                      ${useOath ? 'والله صليت' : 'اتصلّت ✓'}
                    </button>
                    <button
                      type="button"
                      class="btn-sm ${p.status === 'promised' ? 'active-warn' : ''}"
                      data-pray-key="${p.key}"
                      data-pray-status="promised"
                    >
                      لسه هصلي
                    </button>
                    <button
                      type="button"
                      class="btn-sm ${p.status === 'missed' ? 'active-rose' : ''}"
                      data-pray-key="${p.key}"
                      data-pray-status="missed"
                    >
                      فاتت
                    </button>
                  </div>
                </li>
              `;
            })}
          </ul>
        </section>

        <!-- إعداد الموقع والمدينة السريع -->
        <section class="card">
          <div class="card-head">
            <h3 class="sec-title">المدينة والموقع</h3>
            <button type="button" id="btn-geo-prayer" class="btn-sm">📍 استخدم موقعي</button>
          </div>
          <p class="muted-sub">الحساب وفق الهيئة المصرية العامة للمساحة (المذهب الشافعي).</p>
          <div class="field-row mt-sm">
            <div class="field-group">
              <label class="field-label" for="pray-city-select">المدينة</label>
              <select id="pray-city-select" class="input">
                ${EGYPT_CITIES.map(
                  (c) => html`<option value="${c.id}" ${c.id === city.id ? 'selected' : ''}>${c.name}</option>`
                )}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="pray-adj-input">تعديل الدقايق (±)</label>
              <input id="pray-adj-input" type="number" min="-30" max="30" class="input" value="${mainSetting.adj || 0}" />
            </div>
          </div>
        </section>
      </div>
    `
  );

  // اختيار اليوم من شريط الأيام لعرض صلواته في يومه
  container.querySelectorAll('[data-pray-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPrayerDate = btn.dataset.prayDate;
      renderPrayerTab(container, { now });
    });
  });

  container.querySelector('#btn-test-adhan')?.addEventListener('click', () => {
    openMandatoryPrayerDialog({ key: 'dhuhr', name: 'الظهر' }, todayStr, times.dhuhr);
  });

  container.querySelectorAll('[data-pray-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.prayKey;
      const st = btn.dataset.prayStatus;
      store.patch('prayer', `${selectedPrayerDate}:${k}`, {
        date: selectedPrayerDate,
        k,
        s: st,
        t: times[k],
        f: Date.now()
      });
      renderPrayerTab(container, { now });
    });
  });

  container.querySelector('#pray-city-select')?.addEventListener('change', (e) => {
    const chosen = getCityById(e.target.value);
    store.patch('setting', 'main', { city: chosen.id, lat: chosen.lat, lng: chosen.lng });
    renderPrayerTab(container, { now });
  });

  container.querySelector('#pray-adj-input')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { adj: Number(e.target.value || 0) });
    renderPrayerTab(container, { now });
  });

  container.querySelector('#btn-geo-prayer')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        store.patch('setting', 'main', {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4))
        });
        showToast('تم تحديث الإحداثيات حسب موقعك الحالي');
        renderPrayerTab(container, { now });
      },
      () => {
        showToast('تعذر الحصول على الموقع — اختر المدينة من القائمة');
      }
    );
  });
}
