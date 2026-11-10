// حساب مواقيت الصلاة بالطريقة المصرية والمذهب الشافعي عبر adhan-js
import '../vendor/adhan.min.js';
import { pad2, isoDate } from './util.js';

const adhanLib = globalThis.adhan;

export const EGYPT_CITIES = [
  { id: 'cairo', name: 'القاهرة', lat: 30.0444, lng: 31.2357 },
  { id: 'giza', name: 'الجيزة', lat: 30.0131, lng: 31.2089 },
  { id: 'alexandria', name: 'الإسكندرية', lat: 31.2001, lng: 29.9187 },
  { id: 'mansoura', name: 'المنصورة', lat: 31.0409, lng: 31.3785 },
  { id: 'tanta', name: 'طنطا', lat: 30.7865, lng: 31.0004 },
  { id: 'zagazig', name: 'الزقازيق', lat: 30.5877, lng: 31.5020 },
  { id: 'ismailia', name: 'الإسماعيلية', lat: 30.5965, lng: 32.2715 },
  { id: 'portsaid', name: 'بورسعيد', lat: 31.2653, lng: 32.3019 },
  { id: 'suez', name: 'السويس', lat: 29.9668, lng: 32.5498 },
  { id: 'minya', name: 'المنيا', lat: 28.1099, lng: 30.7503 },
  { id: 'assiut', name: 'أسيوط', lat: 27.1810, lng: 31.1837 },
  { id: 'sohag', name: 'سوهاج', lat: 26.5591, lng: 31.6957 },
  { id: 'luxor', name: 'الأقصر', lat: 25.6872, lng: 32.6396 },
  { id: 'aswan', name: 'أسوان', lat: 24.0889, lng: 32.8998 }
];

export const PRAYERS_META = [
  { key: 'fajr', name: 'الفجر' },
  { key: 'dhuhr', name: 'الظهر' },
  { key: 'asr', name: 'العصر' },
  { key: 'maghrib', name: 'المغرب' },
  { key: 'isha', name: 'العشاء' }
];

export function getCityById(cityId) {
  return EGYPT_CITIES.find((c) => c.id === cityId) || EGYPT_CITIES[0];
}

function dateToHHMM(dt) {
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function computePrayerTimes(dateInput = new Date(), setting = {}) {
  const dt = typeof dateInput === 'string'
    ? new Date(`${dateInput}T12:00:00`)
    : new Date(dateInput);

  const city = getCityById(setting.city);
  const lat = Number(setting.lat ?? city.lat);
  const lng = Number(setting.lng ?? city.lng);
  const adj = Number(setting.adj || 0);

  const coords = new adhanLib.Coordinates(lat, lng);
  const params = adhanLib.CalculationMethod.Egyptian();
  params.madhab = adhanLib.Madhab.Shafi;
  params.adjustments = {
    fajr: adj,
    sunrise: adj,
    dhuhr: adj,
    asr: adj,
    maghrib: adj,
    isha: adj
  };

  const pt = new adhanLib.PrayerTimes(coords, dt, params);

  return {
    date: isoDate(dt),
    fajr: dateToHHMM(pt.fajr),
    sunrise: dateToHHMM(pt.sunrise),
    dhuhr: dateToHHMM(pt.dhuhr),
    asr: dateToHHMM(pt.asr),
    maghrib: dateToHHMM(pt.maghrib),
    isha: dateToHHMM(pt.isha),
    raw: pt
  };
}

export function getNextPrayerInfo(now = new Date(), setting = {}) {
  const todayTimes = computePrayerTimes(now, setting);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const p of PRAYERS_META) {
    const tStr = todayTimes[p.key];
    const [h, m] = tStr.split(':').map(Number);
    const pMin = h * 60 + m;
    if (pMin > nowMinutes) {
      return {
        key: p.key,
        name: p.name,
        time: tStr,
        minutesLeft: pMin - nowMinutes,
        isTomorrow: false,
        todayTimes
      };
    }
  }

  // بعد العشاء -> الصلاة القادمة فجر الغد
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomTimes = computePrayerTimes(tomorrow, setting);
  const [fh, fm] = tomTimes.fajr.split(':').map(Number);
  const fajrMin = fh * 60 + fm;
  const minutesLeft = (24 * 60 - nowMinutes) + fajrMin;

  return {
    key: 'fajr',
    name: 'الفجر',
    time: tomTimes.fajr,
    minutesLeft,
    isTomorrow: true,
    todayTimes
  };
}

export function getSkyState(now = new Date(), setting = {}) {
  const times = computePrayerTimes(now, setting);
  const toMin = (s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const fajr = toMin(times.fajr);
  const sunrise = toMin(times.sunrise);
  const maghrib = toMin(times.maghrib);
  const isha = toMin(times.isha);

  if (cur >= fajr && cur < sunrise + 35) return 'dawn';
  if (cur >= sunrise + 35 && cur < maghrib - 25) return 'day';
  if (cur >= maghrib - 25 && cur < isha + 15) return 'dusk';
  return 'night';
}
