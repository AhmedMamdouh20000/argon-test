// ميزة الميزانية (money.js): حساب الصرف اليومي، المرتب، المواصلات، الادخار الاختياري، والاحتياجات الشهرية
import { html, render, fmtMoney } from '../core/util.js';
import { store } from '../core/store.js';

export function calculateBudget({ salary = 0, transport = 0, days = 22, saveOn = false, savePct = 30, needs = [], now = new Date() }) {
  const s = Number(salary || 0);
  const tr = Number(transport || 0);
  const workDays = Math.max(0, Number(days ?? 22));
  const pct = Math.max(0, Math.min(100, Number(savePct ?? 30)));

  const savings = saveOn ? Math.round((s * pct) / 100) : 0;
  const totalTransport = Math.round(tr * workDays);
  const totalNeeds = needs
    .filter((n) => n && !n.x)
    .reduce((sum, n) => sum + Number(n.price || 0), 0);

  const available = s - savings - totalNeeds - totalTransport;

  const dt = now instanceof Date ? now : new Date(now);
  const daysInMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - dt.getDate() + 1);
  const dailySpend = Math.round(available / remainingDays);

  return {
    salary: s,
    savings,
    totalTransport,
    totalNeeds,
    available,
    remainingDays,
    dailySpend
  };
}

export function renderMoneyTab(container, { now = new Date() } = {}) {
  const budgetSetting = store.getRecord('setting', 'budget') || {
    salary: 0,
    transport: 0,
    days: 22,
    saveOn: false,
    savePct: 30
  };
  const needs = store.list('need').sort((a, b) => Number(a.day || 1) - Number(b.day || 1));

  const calc = calculateBudget({
    ...budgetSetting,
    needs,
    now
  });

  const isNegative = calc.dailySpend < 0;

  render(
    container,
    html`
      <div class="masonry-grid">
        <!-- كارت الصرف اليومي والمدخلات الأساسية -->
        <section class="card">
          <div class="daily-spend-hero ${isNegative ? 'negative' : ''}">
            <span class="spend-label">المسموح تصرفه في اليوم</span>
            <div class="spend-big" id="daily-spend-val">${fmtMoney(calc.dailySpend)} / اليوم</div>
            <div class="spend-sub">
              المتاح للشهر: <strong>${fmtMoney(calc.available)}</strong> على ${calc.remainingDays} يوم متبقي
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="inp-salary">المرتب الشهري (ج)</label>
              <input
                id="inp-salary"
                type="number"
                min="0"
                step="50"
                class="input"
                placeholder="مثلاً: 9000"
                value="${budgetSetting.salary || ''}"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="inp-transport">المواصلات اليومية (ج)</label>
              <input
                id="inp-transport"
                type="number"
                min="0"
                step="5"
                class="input"
                placeholder="مثلاً: 40"
                value="${budgetSetting.transport || ''}"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="inp-workdays">أيام الشغل</label>
              <input
                id="inp-workdays"
                type="number"
                min="1"
                max="31"
                class="input"
                value="${budgetSetting.days ?? 22}"
              />
            </div>
          </div>

          <!-- الادخار الاختياري -->
          <div class="saving-box">
            <label class="check-row">
              <input id="chk-save-on" type="checkbox" ${budgetSetting.saveOn ? 'checked' : ''} />
              <span>تفعيل الادخار الشهري الاختياري</span>
            </label>
            <div class="saving-slider-wrap ${budgetSetting.saveOn ? '' : 'disabled'}">
              <div class="saving-head">
                <span>نسبة الادخار: <strong id="lbl-save-pct">${budgetSetting.savePct ?? 30}%</strong></span>
                <span class="badge">${fmtMoney(calc.savings)}</span>
              </div>
              <input
                id="rng-save-pct"
                type="range"
                min="5"
                max="60"
                step="5"
                value="${budgetSetting.savePct ?? 30}"
                ${budgetSetting.saveOn ? '' : 'disabled'}
              />
            </div>
          </div>

          <!-- ملخص الأرقام -->
          <div class="budget-summary-grid">
            <div class="b-sum-item">
              <span>إجمالي المواصلات</span>
              <strong>${fmtMoney(calc.totalTransport)}</strong>
            </div>
            <div class="b-sum-item">
              <span>الاحتياجات الشهرية</span>
              <strong>${fmtMoney(calc.totalNeeds)}</strong>
            </div>
            <div class="b-sum-item">
              <span>مبلغ الادخار</span>
              <strong>${fmtMoney(calc.savings)}</strong>
            </div>
          </div>
        </section>

        <!-- قائمة الاحتياجات والالتزامات الشهرية -->
        <section class="card">
          <div class="card-head">
            <h3 class="sec-title">الاحتياجات الشهرية الثابتة</h3>
            <span class="badge">${fmtMoney(calc.totalNeeds)}</span>
          </div>

          <form id="need-form" class="need-add-row" autocomplete="off">
            <input id="need-name" type="text" class="input" placeholder="الاسم (إيجار، نت، كهرباء...)" required />
            <input id="need-price" type="number" min="1" class="input need-price-inp" placeholder="المبلغ (ج)" required />
            <input id="need-day" type="number" min="1" max="31" class="input need-day-inp" placeholder="يوم الدفع" value="1" />
            <button type="submit" id="need-submit" class="btn btn-primary">إضافة</button>
          </form>

          ${needs.length === 0
            ? html`
                <div class="empty-state">
                  <p>مفيش التزامات شهرية مضافة لسه. ضيف الفواتير أو الإيجار فوق.</p>
                </div>
              `
            : html`
                <ul class="need-list" id="need-list">
                  ${needs.map(
                    (n) => html`
                      <li class="need-item ${n.paid ? 'paid' : ''}">
                        <label class="need-check-lbl">
                          <input
                            type="checkbox"
                            class="need-paid-chk"
                            data-id="${n.id}"
                            ${n.paid ? 'checked' : ''}
                          />
                          <span class="need-title">${n.name}</span>
                        </label>
                        <div class="need-meta">
                          <span class="tag tag-muted">يوم ${n.day || 1}</span>
                          <strong class="need-price">${fmtMoney(n.price)}</strong>
                          <button type="button" class="btn-icon need-del" data-id="${n.id}" aria-label="حذف">✕</button>
                        </div>
                      </li>
                    `
                  )}
                </ul>
              `}
        </section>
      </div>
    `
  );

  const updateBudgetField = (fields) => {
    store.patch('setting', 'budget', fields);
    renderMoneyTab(container, { now });
  };

  container.querySelector('#inp-salary')?.addEventListener('change', (e) => {
    updateBudgetField({ salary: Number(e.target.value || 0) });
  });
  container.querySelector('#inp-transport')?.addEventListener('change', (e) => {
    updateBudgetField({ transport: Number(e.target.value || 0) });
  });
  container.querySelector('#inp-workdays')?.addEventListener('change', (e) => {
    updateBudgetField({ days: Number(e.target.value || 22) });
  });
  container.querySelector('#chk-save-on')?.addEventListener('change', (e) => {
    updateBudgetField({ saveOn: e.target.checked });
  });
  container.querySelector('#rng-save-pct')?.addEventListener('change', (e) => {
    updateBudgetField({ savePct: Number(e.target.value || 30) });
  });

  container.querySelector('#need-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#need-name').value.trim();
    const price = Number(container.querySelector('#need-price').value || 0);
    const day = Number(container.querySelector('#need-day').value || 1);
    if (!name || price <= 0) return;
    store.patch('need', null, { name, price, day, paid: false });
    renderMoneyTab(container, { now });
  });

  container.querySelectorAll('.need-paid-chk').forEach((chk) => {
    chk.addEventListener('change', () => {
      store.patch('need', chk.dataset.id, { paid: chk.checked });
      renderMoneyTab(container, { now });
    });
  });

  container.querySelectorAll('.need-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.remove('need', btn.dataset.id);
      renderMoneyTab(container, { now });
    });
  });
}
