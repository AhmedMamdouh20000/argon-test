// شاشة الترحيب (Onboarding) عند فتح التطبيق لأول مرة
import { html, render } from '../core/util.js';
import { store } from '../core/store.js';
import { isCloudConfigured, signInWithGoogle } from '../core/cloud.js';

export function renderOnboarding(container, onFinish) {
  const mainSetting = store.getRecord('setting', 'main') || {};

  render(
    container,
    html`
      <section class="onboarding-wrap" aria-label="شاشة الترحيب">
        <div class="onboarding-card card">
          <div class="onboarding-brand">
            <div class="logo-badge">م</div>
            <h1 class="ruqaa-title">مُخطّطي</h1>
            <p class="onboarding-sub">مخطّطك اليومي بالعربي — مهامك، صلواتك، وميزانيتك في مكان واحد هادي.</p>
          </div>

          <div class="field-group">
            <label class="field-label" for="ob-name">اسمك إيه؟ (اختياري)</label>
            <input
              id="ob-name"
              type="text"
              class="input"
              placeholder="مثلاً: أحمد، سارة..."
              value="${mainSetting.name || ''}"
              autocomplete="given-name"
            />
          </div>

          <div class="onboarding-question">
            <h2 class="sec-title">فين تحب نحفظ بياناتك؟</h2>
            <div class="onboarding-choices">
              <button type="button" id="btn-ob-local" class="choice-card primary-choice">
                <span class="choice-icon">💻</span>
                <span class="choice-title">على جهازي بس</span>
                <span class="choice-desc">يشتغل فوراً من غير حساب ولا إنترنت، وتقدر تاخد نسخة احتياطية وقت ما تحب.</span>
              </button>

              <button type="button" id="btn-ob-cloud" class="choice-card">
                <span class="choice-icon">☁️</span>
                <span class="choice-title">سجّل بجوجل</span>
                <span class="choice-desc">مزامنة تلقائية بين الموبايل واللاب، وتقرير يومي يوصلك على الإيميل.</span>
              </button>
            </div>
          </div>

          <div id="ob-cloud-help" class="cloud-help-box hidden">
            <strong>إعداد السحابة (Supabase) غير مفعّل حالياً في <code>config.js</code></strong>
            <p>عشان تشغّل تسجيل جوجل والمزامنة: افتح ملف <code>config.js</code> وحط رابط <code>SUPABASE_URL</code> ومفتاح <code>SUPABASE_ANON_KEY</code> حسب الخطوات المشروحة في ملف <code>SETUP.md</code>، أو كمّل دلوقتي «على جهازي بس» وتقدر تربط حسابك بعدين من الإعدادات.</p>
          </div>
        </div>
      </section>
    `
  );

  const nameInput = container.querySelector('#ob-name');
  const btnLocal = container.querySelector('#btn-ob-local');
  const btnCloud = container.querySelector('#btn-ob-cloud');
  const helpBox = container.querySelector('#ob-cloud-help');

  function saveName() {
    const val = (nameInput?.value || '').trim();
    if (val) {
      store.patch('setting', 'main', { name: val });
    }
  }

  btnLocal?.addEventListener('click', () => {
    saveName();
    store.setMeta({ mode: 'local', onboarded: true });
    if (typeof onFinish === 'function') onFinish();
  });

  btnCloud?.addEventListener('click', async () => {
    saveName();
    if (!isCloudConfigured()) {
      helpBox?.classList.remove('hidden');
      return;
    }
    const res = await signInWithGoogle();
    if (!res.ok) {
      helpBox?.classList.remove('hidden');
    }
  });
}
