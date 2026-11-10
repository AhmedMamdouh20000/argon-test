// تبويب «المزيد» (more.js): الإعدادات الشاملة (الحساب، الاسم، التذكيرات، الصلاة، المناسبات، النسخ الاحتياطي)
import { html, render, isoDate } from '../core/util.js';
import { store } from '../core/store.js';
import { EGYPT_CITIES, getCityById } from '../core/prayer.js';
import { setCustomAdhan, hasCustomAdhan } from '../core/sound.js';
import { getNotifyPermission, requestNotifyPermission } from '../core/notify.js';
import {
  isCloudConfigured,
  signInWithGoogle,
  signOutCloud,
  syncNow,
  sendTestReportEmail
} from '../core/cloud.js';
import { renderEventsSection } from './events.js';
import { showToast } from '../ui/ui.js';

export function renderMoreTab(container, { now = new Date() } = {}) {
  const mainSetting = store.getRecord('setting', 'main') || {};
  const city = getCityById(mainSetting.city);
  const mode = store.state.mode || 'local';
  const owner = store.state.owner;
  const notifyPerm = getNotifyPermission();

  render(
    container,
    html`
      <div class="masonry-grid">
        <!-- 1. الحساب والتخزين -->
        <section class="card">
          <div class="card-head">
            <h3 class="sec-title">☁️ الحساب والتخزين</h3>
            <span class="tag ${mode === 'cloud' ? 'tag-ok' : 'tag-muted'}">
              ${mode === 'cloud' ? 'مزامنة سحابية' : 'محلي على جهازك'}
            </span>
          </div>

          ${mode === 'cloud' && owner
            ? html`
                <p class="muted-sub">متصل بحساب: <strong>${owner}</strong></p>
                <div class="btn-row mt-sm">
                  <button type="button" id="btn-sync-now" class="btn btn-primary">🔄 زامن دلوقتي</button>
                  <button type="button" id="btn-sign-out" class="btn btn-ghost">تسجيل خروج</button>
                </div>
              `
            : html`
                <p class="muted-sub">بياناتك محفوظة على جهازك ده بس. تقدر تحوّل لحساب جوجل للمزامنة بين الموبايل واللاب.</p>
                <div class="btn-row mt-sm">
                  <button type="button" id="btn-switch-cloud" class="btn btn-primary">سجّل بجوجل وفعّل المزامنة</button>
                </div>
                <div id="more-cloud-help" class="cloud-help-box hidden mt-sm">
                  إعداد Supabase غير مضاف في <code>config.js</code>. راجع خطوات <code>SETUP.md</code> لإضافة <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code>.
                </div>
              `}
        </section>

        <!-- 2. الاسم والتذكيرات والتقرير -->
        <section class="card">
          <h3 class="sec-title">👤 الاسم والتذكيرات</h3>

          <div class="field-group mt-sm">
            <label class="field-label" for="set-name">الاسم في التحية</label>
            <input id="set-name" type="text" class="input" value="${mainSetting.name || ''}" placeholder="اسمك..." />
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="set-eve">وقت تنبيه المساء</label>
              <input id="set-eve" type="time" class="input" value="${mainSetting.eve || '21:00'}" />
            </div>
            <div class="field-group">
              <label class="field-label" for="set-rep-time">وقت تقرير آخر اليوم</label>
              <input id="set-rep-time" type="time" class="input" value="${mainSetting.reportTime || '23:00'}" />
            </div>
          </div>

          <label class="check-row">
            <input id="set-sound" type="checkbox" ${mainSetting.soundOn !== false ? 'checked' : ''} />
            <span>تفعيل أصوات المنبّه</span>
          </label>

          <label class="check-row">
            <input id="set-email-rep" type="checkbox" ${mainSetting.emailReport ? 'checked' : ''} />
            <span>إرسال التقرير اليومي على الإيميل (لوضع الحساب)</span>
          </label>

          <div class="btn-row mt-sm">
            <button type="button" id="btn-req-notify" class="btn btn-soft btn-sm">
              🔔 إشعارات المتصفح (${notifyPerm === 'granted' ? 'مفعّلة ✓' : 'تفعيل'})
            </button>
            <button type="button" id="btn-test-email" class="btn btn-soft btn-sm">
              ✉️ ابعت تقرير تجريبي
            </button>
          </div>
        </section>

        <!-- 3. إعدادات الصلاة -->
        <section class="card">
          <div class="card-head">
            <h3 class="sec-title">🕌 إعدادات الصلاة والأذان</h3>
            <button type="button" id="btn-more-geo" class="btn-sm">📍 استخدم موقعي</button>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="set-city">المدينة</label>
              <select id="set-city" class="input">
                ${EGYPT_CITIES.map(
                  (c) => html`<option value="${c.id}" ${c.id === city.id ? 'selected' : ''}>${c.name}</option>`
                )}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="set-adj">تعديل الدقايق (±)</label>
              <input id="set-adj" type="number" min="-30" max="30" class="input" value="${mainSetting.adj || 0}" />
            </div>
          </div>

          <label class="check-row">
            <input id="set-adhan-on" type="checkbox" ${mainSetting.adhanOn !== false ? 'checked' : ''} />
            <span>تشغيل صوت الأذان تلقائياً عند دخول الوقت</span>
          </label>

          <label class="check-row">
            <input id="set-oath" type="checkbox" ${mainSetting.oath !== false ? 'checked' : ''} />
            <span>استخدام صيغة القسم («والله صليت / والله هصلي»)</span>
          </label>

          <div class="btn-row mt-sm">
            <label class="btn btn-soft btn-sm file-btn">
              🎵 اختيار صوت أذان تاني (MP3)
              <input id="inp-custom-adhan" type="file" accept="audio/*" hidden />
            </label>
            ${hasCustomAdhan()
              ? html`<button type="button" id="btn-reset-adhan" class="btn-sm">استعادة الأذان الافتراضي</button>`
              : ''}
          </div>
        </section>

        <!-- 4. المناسبات -->
        <section class="card" id="more-events-mount"></section>

        <!-- 5. بياناتك (نسخة احتياطية JSON + مسح الكل) -->
        <section class="card">
          <h3 class="sec-title">💾 بياناتك والنسخ الاحتياطي</h3>
          <p class="muted-sub">تقدر تحمّل نسخة احتياطية كاملة (JSON) من كل مهامك وصلواتك وميزانيتك، أو تستعيدها في أي وقت.</p>

          <div class="btn-row mt-sm">
            <button type="button" id="btn-export-json" class="btn btn-soft">⬇️ تصدير نسخة JSON</button>
            <label class="btn btn-soft file-btn">
              ⬆️ استيراد نسخة JSON
              <input id="inp-import-json" type="file" accept=".json,application/json" hidden />
            </label>
            <button type="button" id="btn-wipe-all" class="btn btn-danger">🗑️ مسح كل البيانات</button>
          </div>
        </section>
      </div>
    `
  );

  // تركيب قسم المناسبات
  const eventsMount = container.querySelector('#more-events-mount');
  if (eventsMount) {
    renderEventsSection(eventsMount, { now });
  }

  // أحداث الحساب
  container.querySelector('#btn-switch-cloud')?.addEventListener('click', async () => {
    if (!isCloudConfigured()) {
      container.querySelector('#more-cloud-help')?.classList.remove('hidden');
      return;
    }
    await signInWithGoogle();
  });

  container.querySelector('#btn-sync-now')?.addEventListener('click', async () => {
    const res = await syncNow();
    showToast(res.synced ? 'تمت المزامنة بنجاح ✓' : 'تعذرت المزامنة حالياً');
  });

  container.querySelector('#btn-sign-out')?.addEventListener('click', async () => {
    await signOutCloud();
    showToast('تم تسجيل الخروج والعودة للوضع المحلي');
    renderMoreTab(container, { now });
  });

  // أحداث الإعدادات العامة
  container.querySelector('#set-name')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { name: e.target.value.trim() });
    showToast('تم حفظ الاسم');
  });
  container.querySelector('#set-eve')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { eve: e.target.value || '21:00' });
  });
  container.querySelector('#set-rep-time')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { reportTime: e.target.value || '23:00' });
  });
  container.querySelector('#set-sound')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { soundOn: e.target.checked });
  });
  container.querySelector('#set-email-rep')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { emailReport: e.target.checked });
  });

  container.querySelector('#btn-req-notify')?.addEventListener('click', async () => {
    const perm = await requestNotifyPermission();
    showToast(perm === 'granted' ? 'تم تفعيل الإشعارات ✓' : 'لم يتم منح صلاحية الإشعارات');
    renderMoreTab(container, { now });
  });

  container.querySelector('#btn-test-email')?.addEventListener('click', async () => {
    const res = await sendTestReportEmail(isoDate(now));
    showToast(res.ok ? 'تم إرسال التقرير التجريبي على الإيميل ✓' : res.message);
  });

  // أحداث إعدادات الصلاة
  container.querySelector('#set-city')?.addEventListener('change', (e) => {
    const c = getCityById(e.target.value);
    store.patch('setting', 'main', { city: c.id, lat: c.lat, lng: c.lng });
  });
  container.querySelector('#set-adj')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { adj: Number(e.target.value || 0) });
  });
  container.querySelector('#set-adhan-on')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { adhanOn: e.target.checked });
  });
  container.querySelector('#set-oath')?.addEventListener('change', (e) => {
    store.patch('setting', 'main', { oath: e.target.checked });
  });

  container.querySelector('#btn-more-geo')?.addEventListener('click', () => {
    if (!navigator.geolocation) return showToast('المتصفح لا يدعم تحديد الموقع');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        store.patch('setting', 'main', {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4))
        });
        showToast('تم تحديث موقعك بنجاح');
      },
      () => showToast('تعذر تحديد الموقع')
    );
  });

  container.querySelector('#inp-custom-adhan')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomAdhan(String(reader.result));
      showToast('تم حفظ صوت الأذان المخصص');
      renderMoreTab(container, { now });
    };
    reader.readAsDataURL(file);
  });

  container.querySelector('#btn-reset-adhan')?.addEventListener('click', () => {
    setCustomAdhan(null);
    showToast('تمت استعادة صوت الأذان الافتراضي');
    renderMoreTab(container, { now });
  });

  // تصدير واستيراد ومسح البيانات
  container.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mukhattati-backup-${isoDate(now)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector('#inp-import-json')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importJSON(text);
      showToast('تم استيراد النسخة الاحتياطية بنجاح ✓');
      renderMoreTab(container, { now });
    } catch {
      showToast('ملف النسخة الاحتياطية غير صالح');
    }
  });

  container.querySelector('#btn-wipe-all')?.addEventListener('click', () => {
    if (window.confirm('متأكد إنك عايز تمسح كل البيانات نهائياً؟ خطوة مش هينفع ترجع فيها.')) {
      store.resetAll();
      window.location.reload();
    }
  });
}
