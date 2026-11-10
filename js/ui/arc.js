// رسم قوس الشمس (Hero Arc SVG) والـ Skyline القاهري (قباب ومآذن وكثبان رملية)
import { html, raw, formatTime12, timeToMinutes } from '../core/util.js';
import { PRAYERS_META } from '../core/prayer.js';

export function sceneSVG() {
  return raw(`
    <svg class="hero-scene-svg" viewBox="0 0 800 130" preserveAspectRatio="none" aria-hidden="true">
      <!-- الكثبان الخلفية -->
      <path d="M0,95 Q160,62 340,86 T680,74 L800,85 L800,130 L0,130 Z" fill="var(--c1)" opacity="0.72"/>
      <!-- الكثبان الوسطى مع القباب والمآذن -->
      <path d="M0,108 Q120,88 260,102 T560,92 T800,100 L800,130 L0,130 Z" fill="var(--c2)" opacity="0.88"/>
      <!-- silhouette مآذن وقباب القاهرة -->
      <g fill="var(--c3)">
        <!-- مئذنة وقبة يمين -->
        <rect x="645" y="42" width="6" height="68" rx="1"/>
        <polygon points="648,28 643,42 653,42"/>
        <circle cx="648" cy="25" r="2"/>
        <path d="M590,105 C590,74 635,74 635,105 Z"/>
        <rect x="611" y="67" width="3" height="9"/>
        <!-- مئذنة وقبة وسط -->
        <rect x="415" y="52" width="5" height="58"/>
        <polygon points="417.5,39 413,52 422,52"/>
        <path d="M368,108 C368,83 406,83 406,108 Z"/>
        <!-- مئذنة يسار -->
        <rect x="148" y="56" width="5" height="54"/>
        <polygon points="150.5,44 146,56 155,56"/>
        <path d="M160,108 C160,86 194,86 194,108 Z"/>
        <!-- خط الأفق الأمامي -->
        <path d="M0,114 Q220,100 440,111 T800,106 L800,130 L0,130 Z"/>
      </g>
    </svg>
  `);
}

// حساب نقطة على منحنى Quadratic Bezier: M 50,150 Q 300,20 550,150
function pointOnArc(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const x0 = 550; // RTL: الفجر يبدأ من اليمين (550) والعشاء في اليسار (50)
  const y0 = 148;
  const cx = 300;
  const cy = 18;
  const x1 = 50;
  const y1 = 148;

  const u = 1 - clamped;
  const x = u * u * x0 + 2 * u * clamped * cx + clamped * clamped * x1;
  const y = u * u * y0 + 2 * u * clamped * cy + clamped * clamped * y1;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function renderSunArc({ todayTimes, now = new Date(), prayersState = {}, dateStr }) {
  const fajrMin = timeToMinutes(todayTimes.fajr);
  const ishaMin = timeToMinutes(todayTimes.isha);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const span = Math.max(1, ishaMin - fajrMin);
  const rawProgress = (nowMin - fajrMin) / span;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const sunPt = pointOnArc(progress);

  // مواقع الصلوات الخمس على القوس
  const stops = PRAYERS_META.map((p, idx) => {
    const pMin = timeToMinutes(todayTimes[p.key]);
    const t = span > 0 ? Math.max(0, Math.min(1, (pMin - fajrMin) / span)) : idx / 4;
    const pt = pointOnArc(t);
    const rec = prayersState[`${dateStr}:${p.key}`];
    const status = rec?.s || (nowMin > pMin + 20 ? 'missed' : 'upcoming');
    return {
      ...p,
      time: todayTimes[p.key],
      x: pt.x,
      y: pt.y,
      passed: nowMin >= pMin,
      status
    };
  });

  const markersSvg = stops.map((st) => {
    const dotClass = st.status === 'prayed'
      ? 'arc-dot prayed'
      : st.passed
      ? 'arc-dot passed'
      : 'arc-dot';
    return `
      <g class="arc-stop" transform="translate(${st.x}, ${st.y})">
        <circle class="${dotClass}" r="5.5" cx="0" cy="0" />
        <text class="arc-label-name" x="0" y="-14" text-anchor="middle">${st.name}</text>
        <text class="arc-label-time" x="0" y="20" text-anchor="middle">${formatTime12(st.time)}</text>
      </g>
    `;
  }).join('');

  return html`
    <div class="arc-wrap">
      <svg class="arc-svg" viewBox="0 0 600 185" role="img" aria-label="قوس اليوم ومواقيت الصلاة">
        <defs>
          <linearGradient id="arcGrad" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="var(--lamp)" stop-opacity="0.95"/>
            <stop offset="50%" stop-color="var(--brand)" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="var(--ink-2)" stop-opacity="0.45"/>
          </linearGradient>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--lamp)" stop-opacity="1"/>
            <stop offset="45%" stop-color="var(--lamp)" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="var(--lamp)" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- المسار الخلفي المتقطع -->
        <path d="M 550,148 Q 300,18 50,148" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>

        <!-- المسار الرئيسي -->
        <path d="M 550,148 Q 300,18 50,148" fill="none" stroke="url(#arcGrad)" stroke-width="3.5" stroke-linecap="round"/>

        <!-- نقاط الصلوات الخمس -->
        ${raw(markersSvg)}

        <!-- قرص الشمس المتحرك -->
        <g class="arc-sun" transform="translate(${sunPt.x}, ${sunPt.y})">
          <circle r="22" cx="0" cy="0" fill="url(#sunGlow)"/>
          <circle r="8.5" cx="0" cy="0" fill="var(--lamp)" stroke="#fff" stroke-width="2"/>
        </g>
      </svg>
    </div>
  `;
}
