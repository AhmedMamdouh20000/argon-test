// نقطة الدخول الرئيسية للتطبيق (app.js)
import { html, render } from './core/util.js';
import { store } from './core/store.js';
import { checkAuthAndSync, syncNow } from './core/cloud.js';
import { applyTheme, toggleThemeWithCircle } from './ui/ui.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderTodayTab } from './features/today.js';
import { renderReportsTab, checkDailyReportTick } from './features/reports.js';
import { renderPrayerTab, checkPrayerTick } from './features/prayer.js';
import { renderMoneyTab } from './features/money.js';
import { renderMoreTab } from './features/more.js';
import { checkAlertsTick } from './features/alerts.js';

const TABS = [
  { id: 'today', label: 'اليوم', icon: '☀️' },
  { id: 'reports', label: 'لوحتي', icon: '📊' },
  { id: 'prayer', label: 'الصلاة', icon: '🕌' },
  { id: 'money', label: 'الفلوس', icon: '💰' },
  { id: 'more', label: 'المزيد', icon: '⚙️' }
];

let activeTab = 'today';

export function setTab(tabId) {
  if (!TABS.some((t) => t.id === tabId)) return;
  activeTab = tabId;
  renderApp();
}

export function renderApp() {
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  const mainSetting = store.getRecord('setting', 'main') || {};
  applyTheme(mainSetting.theme || 'light');

  if (!store.state.onboarded) {
    renderOnboarding(rootEl, () => {
      renderApp();
      runPeriodicChecks();
    });
    return;
  }

  const isDark = (mainSetting.theme || 'light') === 'dark';

  render(
    rootEl,
    html`
      <div class="app-shell">
        <!-- الشريط الجانبي للديسكتوب (Side Rail RTL) + شريط التنقل السفلي للموبايل -->
        <aside class="nav-rail" aria-label="التنقل الرئيسي">
          <div class="rail-brand">
            <div class="logo-badge">م</div>
            <span class="ruqaa-brand">مُخطّطي</span>
          </div>

          <nav class="rail-links">
            ${TABS.map(
              (t) => html`
                <button
                  type="button"
                  class="nav-btn ${activeTab === t.id ? 'active' : ''}"
                  data-tab="${t.id}"
                  id="nav-${t.id}"
                >
                  <span class="nav-icon">${t.icon}</span>
                  <span class="nav-label">${t.label}</span>
                </button>
              `
            )}
          </nav>

          <div class="rail-footer">
            <button
              type="button"
              id="btn-theme-toggle"
              class="theme-btn"
              aria-label="تبديل الوضع الفاتح والداكن"
              title="تبديل الفاتح / الداكن"
            >
              <span class="theme-icon">${isDark ? '☀️' : '🌙'}</span>
              <span class="theme-text">${isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
            </button>
          </div>
        </aside>

        <!-- منطقة المحتوى الرئيسية -->
        <div class="main-area">
          <!-- شريط علوي للموبايل فقط (الشعار + زر الثيم) -->
          <header class="mobile-topbar">
            <div class="mobile-brand">
              <span class="logo-badge sm">م</span>
              <span class="ruqaa-brand">مُخطّطي</span>
            </div>
            <button
              type="button"
              id="btn-theme-toggle-mob"
              class="btn-icon theme-mob-btn"
              aria-label="تبديل الثيم"
            >
              ${isDark ? '☀️' : '🌙'}
            </button>
          </header>

          <main id="tab-view" class="tab-view"></main>
        </div>
      </div>
    `
  );

  // ربط أزرار التنقل
  rootEl.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && tab !== activeTab) {
        activeTab = tab;
        renderApp();
      }
    });
  });

  // ربط أزرار الثيم (ديسكتوب وموبايل)
  const onThemeClick = async (e) => {
    await toggleThemeWithCircle(e);
    renderApp();
  };
  rootEl.querySelector('#btn-theme-toggle')?.addEventListener('click', onThemeClick);
  rootEl.querySelector('#btn-theme-toggle-mob')?.addEventListener('click', onThemeClick);

  // عرض التبويب النشط
  const view = rootEl.querySelector('#tab-view');
  const now = new Date();
  if (activeTab === 'today') renderTodayTab(view, { now });
  else if (activeTab === 'reports') renderReportsTab(view, { now });
  else if (activeTab === 'prayer') renderPrayerTab(view, { now });
  else if (activeTab === 'money') renderMoneyTab(view, { now });
  else if (activeTab === 'more') renderMoreTab(view, { now });
}

export function runPeriodicChecks(now = new Date()) {
  if (!store.state.onboarded) return;
  checkPrayerTick(now);
  checkAlertsTick(now);
  checkDailyReportTick(now);
}

window.__onAppStateChange = () => {
  renderApp();
};
window.__runChecksNow = (customNow) => {
  runPeriodicChecks(customNow || new Date());
};

// تهيئة التطبيق عند التحميل
function init() {
  renderApp();
  runPeriodicChecks();

  // فحص التنبيهات ومواقيت الصلاة كل 15 ثانية
  setInterval(() => {
    runPeriodicChecks(new Date());
  }, 15000);

  // التحقق من جلسة Supabase والمزامنة في الخلفية
  checkAuthAndSync().then((res) => {
    if (res.synced) renderApp();
  });

  // مزامنة دورية لو المستخدم مسجل دخول
  setInterval(() => {
    if (store.state.mode === 'cloud') {
      syncNow();
    }
  }, 60000);

  // تسجيل Service Worker للـ PWA
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
