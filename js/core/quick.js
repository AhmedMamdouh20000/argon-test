// محلل الجمل باللهجة المصرية لاستخراج العنوان والتاريخ والوقت والمشاوير البعيدة
import { toLatinDigits, pad2, isoDate, addDays } from './util.js';

const WEEKDAYS = [
  { day: 0, patterns: ['الاحد', 'الأحد', 'احد', 'أحد', 'حد', 'الحد'] },
  { day: 1, patterns: ['الاثنين', 'الإثنين', 'الاتنين', 'الإتنين', 'اثنين', 'اتنين'] },
  { day: 2, patterns: ['الثلاثاء', 'التلات', 'ثلاثاء', 'تلات'] },
  { day: 3, patterns: ['الاربعاء', 'الأربعاء', 'الاربع', 'الأربع', 'اربعاء', 'أربعاء', 'اربع', 'أربع'] },
  { day: 4, patterns: ['الخميس', 'خميس'] },
  { day: 5, patterns: ['الجمعة', 'الجمعه', 'جمعة', 'جمعه'] },
  { day: 6, patterns: ['السبت', 'سبت'] }
];

export function parseQuick(input, now = new Date()) {
  const baseDate = now instanceof Date ? now : new Date(now);
  const todayStr = isoDate(baseDate);
  let text = toLatinDigits(String(input ?? '')).trim();

  if (!text) {
    return { title: '', date: todayStr, time: '', far: false, hasDate: false, hasTime: false };
  }

  let date = todayStr;
  let hasDate = false;
  let time = '';
  let hasTime = false;
  let far = false;

  // 1. فحص المشوار / المكان البعيد
  const farRegex = /(?:^|\s)(مشوار|بعيد)(?=\s|$)/i;
  if (farRegex.test(text)) {
    far = true;
  }

  // 2. استخراج الوقت
  // حالات مثل: "الساعة 11:50 الصبح"، "5:30 م"، "الساعة 5 مساءً"، "2 م"، "٧ مساء"، "الساعة 9"
  const periodPattern = '(?:ص|صباحا|صباحاً|صباح|الصبح|م|مساء|مساءً|بالليل|ليل|ليلا|ليلاً|العصر|عصرا|عصراً|الظهر|الضهر|ظهرا|ظهراً|ضهر|ظهر|am|pm)';
  const timeWithColonRe = new RegExp(`(?:^|\\s)(?:الساعة|الساعه|ساعة|ساعه)?\\s*(\\d{1,2})\\s*:\\s*(\\d{2})(?:\\s*(${periodPattern}))?(?=\\s|$)`, 'i');
  const timeWithWordOrPeriodRe = new RegExp(`(?:^|\\s)(?:(?:الساعة|الساعه|ساعة|ساعه)\\s*(\\d{1,2})(?:\\s*(${periodPattern}))?|(\\d{1,2})\\s*(${periodPattern}))(?=\\s|$)`, 'i');

  function resolveHour(rawH, rawM, periodRaw) {
    let h = Number(rawH);
    const m = Number(rawM || 0);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;

    const p = (periodRaw || '').trim().toLowerCase();
    if (h >= 13) {
      // نظام 24 ساعة
      return `${pad2(h)}:${pad2(m)}`;
    }
    if (p) {
      const isPM = /^(م|مساء|مساءً|بالليل|ليل|ليلا|ليلاً|العصر|عصرا|عصراً|pm)$/.test(p);
      const isNoon = /^(الظهر|الضهر|ظهرا|ظهراً|ضهر|ظهر)$/.test(p);
      const isAM = /^(ص|صباحا|صباحاً|صباح|الصبح|am)$/.test(p);

      if (isPM) {
        if (h < 12) h += 12;
      } else if (isNoon) {
        if (h >= 1 && h <= 5) h += 12;
      } else if (isAM) {
        if (h === 12) h = 0;
      }
    } else {
      // بدون علامة: 1-6 مساءً، 7-11 صباحاً، 12 ضهر
      if (h >= 1 && h <= 6) h += 12;
      else if (h === 12) h = 12;
    }
    return `${pad2(h)}:${pad2(m)}`;
  }

  let mColon = text.match(timeWithColonRe);
  if (mColon) {
    const resolved = resolveHour(mColon[1], mColon[2], mColon[3]);
    if (resolved) {
      time = resolved;
      hasTime = true;
      text = text.replace(mColon[0], ' ');
    }
  } else {
    let mWord = text.match(timeWithWordOrPeriodRe);
    if (mWord) {
      const rawH = mWord[1] || mWord[3];
      const rawP = mWord[2] || mWord[4];
      const resolved = resolveHour(rawH, 0, rawP);
      if (resolved) {
        time = resolved;
        hasTime = true;
        text = text.replace(mWord[0], ' ');
      }
    }
  }

  // 3. استخراج التاريخ
  // "بعد بكرة" / "بعد بكره" / "بعد غد"
  // ملاحظة: "غدا مع/في/عند" تعني وجبة الغداء بالمصري إلا لو سبقها "يوم"
  const afterTomorrowRe = /(?:^|\s)(بعد\s+بكرة|بعد\s+بكره|بعد\s+غد)(?=\s|$)/i;
  const tomorrowRe = /(?:^|\s)(بكرة|بكره|غداً|tomorrow|يوم\s+غدا|غدا(?!\s+(?:مع|في|فى|عند|بره|عائلي))|غد)(?=\s|$)/i;
  const todayRe = /(?:^|\s)(النهارده|النهاردة|اليوم|today)(?=\s|$)/i;

  if (afterTomorrowRe.test(text)) {
    date = addDays(todayStr, 2);
    hasDate = true;
    text = text.replace(afterTomorrowRe, ' ');
  } else if (tomorrowRe.test(text)) {
    date = addDays(todayStr, 1);
    hasDate = true;
    text = text.replace(tomorrowRe, ' ');
  } else if (todayRe.test(text)) {
    date = todayStr;
    hasDate = true;
    text = text.replace(todayRe, ' ');
  } else {
    // فحص أيام الأسبوع
    for (const wd of WEEKDAYS) {
      const joined = wd.patterns.join('|');
      const wdRe = new RegExp(`(?:^|\\s)(?:يوم\\s+)?(${joined})(?:\\s+الجاي|\\s+القادم)?(?=\\s|$)`, 'i');
      if (wdRe.test(text)) {
        const currentDow = baseDate.getDay();
        let diff = (wd.day - currentDow + 7) % 7;
        if (diff === 0) diff = 7; // لو اليوم ده هو النهارده يروح للأسبوع الجاي
        date = addDays(todayStr, diff);
        hasDate = true;
        text = text.replace(wdRe, ' ');
        break;
      }
    }
  }

  // تنظيف العنوان من حروف الجر الزائدة في آخر أو أول الجملة بعد الحذف
  let title = text
    .replace(/\s+/g, ' ')
    .replace(/^(في|فى|يوم|الساعة|الساعه)\s+/i, '')
    .replace(/\s+(في|فى|يوم|الساعة|الساعه)$/i, '')
    .trim();

  if (!title) {
    title = far ? 'مشوار' : 'مهمة جديدة';
  }

  return { title, date, time, far, hasDate, hasTime };
}
