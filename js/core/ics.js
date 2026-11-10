// محلل ملفات التقويم (.ics) لاستيراد المناسبات من Google Calendar
import { pad2 } from './util.js';

function parseIcsDate(val) {
  if (!val) return null;
  const clean = val.trim();
  const m = clean.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
}

export function parseICS(icsText) {
  const text = String(icsText ?? '').replace(/\r\n/g, '\n');
  // Unfold lines per RFC 5545
  const unfolded = text.replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');

  const events = [];
  let cur = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      cur = { name: '', date: '', yearly: false };
    } else if (line === 'END:VEVENT') {
      if (cur && cur.name && cur.date) {
        events.push(cur);
      }
      cur = null;
    } else if (cur) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const keyPart = line.slice(0, colonIdx).toUpperCase();
      const valPart = line.slice(colonIdx + 1).trim();

      if (keyPart.startsWith('SUMMARY')) {
        cur.name = valPart.replace(/\\,/g, ',').replace(/\\n/g, ' ');
      } else if (keyPart.startsWith('DTSTART')) {
        const dt = parseIcsDate(valPart);
        if (dt) cur.date = dt;
      } else if (keyPart.startsWith('RRULE')) {
        if (/FREQ=YEARLY/i.test(valPart)) {
          cur.yearly = true;
        }
      }
    }
  }

  return events;
}
