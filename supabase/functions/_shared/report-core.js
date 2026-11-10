// بناء تقرير آخر اليوم (مشترك بين المتصفح و Supabase Edge Function)

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES_AR = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء'
};

export function buildReport({ date, tasks = [], prayers = {} }) {
  const dayTasks = tasks
    .filter((t) => t && !t.x && t.date === date)
    .sort((a, b) => {
      const ta = a.time || '99:99';
      const tb = b.time || '99:99';
      return ta.localeCompare(tb);
    });

  let done = 0;
  let cancelled = 0;
  let postponed = 0;
  let pending = 0;

  for (const t of dayTasks) {
    const st = t.status || 'pending';
    if (st === 'done') done++;
    else if (st === 'cancelled') cancelled++;
    else if (st === 'postponed') postponed++;
    else pending++;
  }

  const total = dayTasks.length;
  const activeTotal = total - cancelled;
  const pct = activeTotal > 0 ? Math.round((done / activeTotal) * 100) : (total > 0 ? 100 : 0);

  const prayerSummary = {};
  let prayedCount = 0;
  let promisedCount = 0;

  for (const k of PRAYER_KEYS) {
    const rec = prayers[`${date}:${k}`] || prayers[k] || null;
    const status = rec?.s || rec?.status || 'missed';
    prayerSummary[k] = status;
    if (status === 'prayed') prayedCount++;
    else if (status === 'promised') promisedCount++;
  }

  return {
    date,
    total,
    done,
    pending,
    postponed,
    cancelled,
    pct,
    tasks: dayTasks.map((t) => ({
      id: t.id || '',
      title: t.title || '',
      time: t.time || '',
      status: t.status || 'pending',
      far: Boolean(t.far)
    })),
    prayers: prayerSummary,
    prayedCount,
    promisedCount,
    generatedAt: Date.now()
  };
}
