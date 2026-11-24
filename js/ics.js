// Lecture d'un calendrier au format .ics (iCloud, Google…) et calcul des répétitions.
import { dkey, pad } from './utils.js';

function parseDate(val, params) {
  const allDay = params.includes('VALUE=DATE') || /^\d{8}$/.test(val);
  let m = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se = '0', z] = m;
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)) : new Date(+y, +mo - 1, +d, +h, +mi, +se);
  return { date, allDay };
}

const unescapeText = (t) => t.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

export function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [name, ...params] = line.slice(0, idx).split(';');
    const val = line.slice(idx + 1);
    if (name === 'DTSTART') { const p = parseDate(val, params); if (p) { cur.start = p.date; cur.allDay = p.allDay; } }
    else if (name === 'DTEND') { const p = parseDate(val, params); if (p) cur.end = p.date; }
    else if (name === 'SUMMARY') cur.title = unescapeText(val);
    else if (name === 'LOCATION') cur.location = unescapeText(val);
    else if (name === 'RRULE') cur.rrule = val;
    else if (name === 'EXDATE') val.split(',').forEach((v) => { const p = parseDate(v, params); if (p) cur.exdates.push(p.date.getTime()); });
    else if (name === 'RECURRENCE-ID') cur.recurrenceId = true;
  }
  return events;
}

const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function occurrences(start, rule, limit) {
  const r = Object.fromEntries(rule.split(';').map((p) => p.split('=')));
  const interval = +r.INTERVAL || 1;
  const count = r.COUNT ? +r.COUNT : Infinity;
  let end = limit;
  if (r.UNTIL) { const u = parseDate(r.UNTIL, []); if (u && u.date < limit) end = u.date; }
  const out = [];
  const MAX = 4000;

  if (r.FREQ === 'WEEKLY' && r.BYDAY) {
    const days = r.BYDAY.split(',').map((d) => WD.indexOf(d.slice(-2))).filter((d) => d >= 0)
      .map((d) => (d + 6) % 7).sort((a, b) => a - b); // 0 = lundi
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    for (let w = 0; out.length < count && w < MAX; w += interval) {
      for (const wd of days) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + w * 7 + wd);
        d.setHours(start.getHours(), start.getMinutes(), start.getSeconds());
        if (d < start) continue;
        if (d > end) return out;
        out.push(d);
        if (out.length >= count) return out;
      }
    }
    return out;
  }

  for (let i = 0; out.length < count && i < MAX; i++) {
    const d = new Date(start);
    if (r.FREQ === 'DAILY') d.setDate(d.getDate() + i * interval);
    else if (r.FREQ === 'WEEKLY') d.setDate(d.getDate() + i * 7 * interval);
    else if (r.FREQ === 'MONTHLY') d.setMonth(d.getMonth() + i * interval);
    else if (r.FREQ === 'YEARLY') d.setFullYear(d.getFullYear() + i * interval);
    else { out.push(start); break; }
    if (d > end) break;
    out.push(d);
  }
  return out;
}

// Transforme les événements en une liste simple { date: 'AAAA-MM-JJ', time, title }
// sur la période de 6 mois avant à 18 mois après aujourd'hui.
export function expandICS(events) {
  const from = new Date(); from.setMonth(from.getMonth() - 6);
  const to = new Date(); to.setMonth(to.getMonth() + 18);
  const out = [];
  for (const ev of events) {
    const dur = ev.end ? ev.end - ev.start : 0;
    const starts = ev.rrule ? occurrences(ev.start, ev.rrule, to) : [ev.start];
    const ex = new Set(ev.exdates);
    for (const st of starts) {
      if (ex.has(st.getTime())) continue;
      if (st.getTime() + dur < from.getTime() || st > to) continue;
      const title = ev.title || '(Sans titre)';
      if (ev.allDay) {
        const n = Math.max(1, Math.min(31, Math.round(dur / 864e5)));
        for (let i = 0; i < n; i++) {
          const d = new Date(st); d.setDate(d.getDate() + i);
          out.push({ date: dkey(d), time: '', title, location: ev.location || '' });
        }
      } else {
        out.push({ date: dkey(st), time: `${pad(st.getHours())}:${pad(st.getMinutes())}`, title, location: ev.location || '' });
      }
    }
  }
  return out;
}
