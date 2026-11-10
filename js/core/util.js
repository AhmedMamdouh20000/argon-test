// دوال مساعدة أساسية وقوالب HTML آمنة ضد XSS

class RawHTML {
  constructor(str) {
    this.val = String(str ?? '');
  }
}

export function raw(str) {
  return new RawHTML(str);
}

const ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function esc(val) {
  if (val instanceof RawHTML) return val.val;
  if (val === null || val === undefined || val === false) return '';
  if (Array.isArray(val)) return val.map(esc).join('');
  return String(val).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += esc(values[i]) + strings[i + 1];
  }
  return new RawHTML(out);
}

export function render(el, content) {
  if (!el) return;
  el.innerHTML = content instanceof RawHTML ? content.val : esc(content);
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toLatinDigits(str) {
  return String(str ?? '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = AR_DIGITS.indexOf(ch);
    if (i !== -1) return String(i);
    const j = FA_DIGITS.indexOf(ch);
    return j !== -1 ? String(j) : ch;
  });
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function isoDate(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_SHORT_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function dayNameAr(dateStr, short = false) {
  const dt = parseLocalDate(dateStr);
  return (short ? DAYS_SHORT_AR : DAYS_AR)[dt.getDay()];
}

export function formatDateAr(dateStr) {
  if (!dateStr) return '';
  const dt = parseLocalDate(dateStr);
  return `${DAYS_AR[dt.getDay()]}، ${dt.getDate()} ${MONTHS_AR[dt.getMonth()]}`;
}

export function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (Number.isNaN(h)) return timeStr;
  const period = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${pad2(m)} ${period}`;
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export function fmtMoney(num) {
  const n = Math.round(Number(num) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US');
  return `${sign}${abs} ج`;
}

export function uid(prefix = '') {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-4);
  return `${prefix}${ts}${rnd}`;
}
