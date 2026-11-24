// 📅 Calendrier : vue mois / semaine, événements, rappels et calendrier iCloud.
import { load, save } from '../store.js';
import { esc, uid, today, dkey, parseKey, fmtDate, fmtDateTime, confirmClick, toast, pageHead, MONTHS, DAYS_SHORT, cap } from '../utils.js';
import { parseICS, expandICS } from '../ics.js';

export const DEFAULTS = {
  view: 'month', events: [], reminders: [],
  icsUrl: '', useProxy: false, ics: [], icsFetched: 0, icsError: '', icsSource: '',
};
export const loadCal = () => load('calendrier', DEFAULTS);

const PROXY = 'https://corsproxy.io/?url=';

let cursor = new Date();
let selected = today();
let showDone = false;

// Tous les éléments d'un jour : événements perso, événements iCloud, rappels
export function itemsFor(s, key) {
  const items = [
    ...s.ics.filter((e) => e.date === key).map((e) => ({ kind: 'ics', ...e })),
    ...s.events.filter((e) => e.date === key).map((e) => ({ kind: 'event', ...e })),
    ...s.reminders.filter((r) => r.due === key).map((r) => ({ kind: 'rappel', ...r, date: r.due })),
  ];
  return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export async function syncICS(s) {
  if (!s.icsUrl) return false;
  const url = s.icsUrl.trim().replace(/^webcals?:\/\//i, 'https://');
  let text = '';
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) text = await r.text();
  } catch (e) { /* bloqué par le navigateur (CORS) */ }
  if (!text.includes('BEGIN:VCALENDAR') && s.useProxy) {
    try {
      const r = await fetch(PROXY + encodeURIComponent(url), { cache: 'no-store' });
      if (r.ok) text = await r.text();
    } catch (e) { /* ignore */ }
  }
  if (!text.includes('BEGIN:VCALENDAR')) {
    s.icsError = s.useProxy
      ? 'Impossible de lire ce calendrier. Vérifie que le lien est correct et que le calendrier est bien public.'
      : 'Ton navigateur bloque la lecture directe d’iCloud. Coche l’option « Passer par un service intermédiaire » puis réessaie.';
    save('calendrier', s);
    return false;
  }
  s.ics = expandICS(parseICS(text));
  s.icsFetched = Date.now();
  s.icsError = '';
  s.icsSource = 'url';
  save('calendrier', s);
  return true;
}

const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function chip(it) {
  const cls = it.kind === 'ics' ? 'c-ics' : it.kind === 'rappel' ? `c-rappel${it.done ? ' done' : ''}` : 'c-event';
  return `<span class="cchip ${cls}">${it.kind === 'rappel' ? (it.done ? '☑' : '☐') + ' ' : ''}${it.time ? `<b>${it.time}</b> ` : ''}${esc(it.title)}</span>`;
}

export default {
  id: 'calendrier',
  title: 'Calendrier',
  short: 'Agenda',
  icon: '📅',
  render(root) {
    const s = loadCal();

    const draw = () => {
      const t = today();
      let grid = '';
      let title = '';
      if (s.view === 'month') {
        const y = cursor.getFullYear(), m = cursor.getMonth();
        title = cap(`${MONTHS[m]} ${y}`);
        const first = new Date(y, m, 1);
        const start = startOfWeek(first);
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const weeks = Math.ceil((((first.getDay() + 6) % 7) + daysInMonth) / 7);
        let cells = '';
        for (let i = 0; i < weeks * 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const k = dkey(d);
          const items = itemsFor(s, k);
          cells += `<button class="day${d.getMonth() !== m ? ' other' : ''}${k === t ? ' today' : ''}${k === selected ? ' sel' : ''}" data-day="${k}" aria-label="${fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}, ${items.length} élément(s)">
            <span class="dnum">${d.getDate()}</span>
            <span class="dchips">${items.slice(0, 3).map(chip).join('')}${items.length > 3 ? `<span class="more">+${items.length - 3}</span>` : ''}</span>
            <span class="ddots">${items.slice(0, 4).map((it) => `<i class="dot d-${it.kind}"></i>`).join('')}</span>
          </button>`;
        }
        grid = `<div class="month"><div class="dow">${DAYS_SHORT.map((d) => `<span>${d}</span>`).join('')}</div><div class="mgrid">${cells}</div></div>`;
      } else {
        const start = startOfWeek(cursor);
        const end = new Date(start); end.setDate(end.getDate() + 6);
        title = `${start.getDate()} ${start.getMonth() !== end.getMonth() ? MONTHS[start.getMonth()].slice(0, 4) + '. ' : ''}– ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
        let cols = '';
        for (let i = 0; i < 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const k = dkey(d);
          const items = itemsFor(s, k);
          cols += `<button class="wday${k === t ? ' today' : ''}${k === selected ? ' sel' : ''}" data-day="${k}">
            <div class="wday-head"><span>${DAYS_SHORT[i]}</span><b>${d.getDate()}</b></div>
            <div class="wday-items">${items.map(chip).join('') || '<span class="muted small">—</span>'}</div>
          </button>`;
        }
        grid = `<div class="week">${cols}</div>`;
      }

      const dayItems = itemsFor(s, selected);
      const pending = s.reminders.filter((r) => !r.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '').localeCompare(b.time || ''));
      const done = s.reminders.filter((r) => r.done);
      const reminderLi = (r) => {
        const late = !r.done && r.due && r.due < t;
        return `<li class="list-item rem${r.done ? ' done' : ''}">
          <input type="checkbox" class="check" data-toggle="${r.id}" ${r.done ? 'checked' : ''} aria-label="Fait">
          <div class="li-main"><div class="li-title">${esc(r.title)}</div>
            ${r.due ? `<div class="li-sub${late ? ' late' : ''}">${late ? 'En retard · ' : ''}${fmtDate(r.due, { weekday: 'short', day: 'numeric', month: 'short' })}${r.time ? ' à ' + r.time : ''}</div>` : ''}</div>
          <button class="icon-btn" data-delrem="${r.id}" aria-label="Supprimer">🗑</button></li>`;
      };

      root.innerHTML = `
        ${pageHead('📅', 'Calendrier', 'Tes événements, tes rappels et ton calendrier iPhone.')}
        <section class="card cal-card">
          <div class="cal-bar">
            <div class="cal-nav">
              <button class="icon-btn" data-nav="-1" aria-label="Précédent">‹</button>
              <h2 class="cal-title">${title}</h2>
              <button class="icon-btn" data-nav="1" aria-label="Suivant">›</button>
            </div>
            <div class="row">
              <button class="btn" data-today>Aujourd’hui</button>
              <div class="seg">
                <button class="${s.view === 'month' ? 'on' : ''}" data-view="month">Mois</button>
                <button class="${s.view === 'week' ? 'on' : ''}" data-view="week">Semaine</button>
              </div>
            </div>
          </div>
          ${grid}
          <div class="legend"><span><i class="dot d-event"></i> Mes événements</span><span><i class="dot d-rappel"></i> Rappels</span>${s.ics.length ? '<span><i class="dot d-ics"></i> iCloud</span>' : ''}</div>
        </section>

        <div class="grid-2">
          <section class="card">
            <h2>${cap(fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
            ${dayItems.length ? `<ul class="list">${dayItems.map((it) => `
              <li class="list-item">
                <span class="li-icon">${it.kind === 'ics' ? '🍎' : it.kind === 'rappel' ? (it.done ? '☑️' : '🔔') : '📌'}</span>
                <div class="li-main"><div class="li-title">${esc(it.title)}</div>
                  <div class="li-sub">${[it.time || 'Toute la journée', it.location ? esc(it.location) : '', it.kind === 'ics' ? 'iCloud' : it.kind === 'rappel' ? 'Rappel' : ''].filter(Boolean).join(' · ')}</div></div>
                ${it.kind === 'event' ? `<button class="icon-btn" data-delev="${it.id}" aria-label="Supprimer">🗑</button>` : ''}
              </li>`).join('')}</ul>` : '<p class="empty">Rien de prévu ce jour-là.</p>'}
            <form id="addf" class="form" autocomplete="off">
              <div class="seg small">
                <label><input type="radio" name="kind" value="event" checked> 📌 Événement</label>
                <label><input type="radio" name="kind" value="rappel"> 🔔 Rappel</label>
              </div>
              <div class="row">
                <input name="title" class="grow" placeholder="Ajouter pour ce jour…" required>
                <input type="time" name="time" aria-label="Heure">
                <button class="btn primary">Ajouter</button>
              </div>
            </form>
          </section>

          <section class="card">
            <h2>🔔 Rappels <span class="count">${pending.length}</span></h2>
            <form id="remf" class="form" autocomplete="off">
              <input name="title" placeholder="Nouveau rappel…" required>
              <div class="row">
                <label class="field grow"><span>Date (facultatif)</span><input type="date" name="due"></label>
                <label class="field"><span>Heure</span><input type="time" name="time"></label>
              </div>
              <button class="btn primary">Ajouter le rappel</button>
            </form>
            ${pending.length ? `<ul class="list">${pending.map(reminderLi).join('')}</ul>` : '<p class="empty">Aucun rappel en cours ✨</p>'}
            ${done.length ? `<button class="btn ghost small" data-showdone>${showDone ? 'Masquer' : 'Voir'} les rappels terminés (${done.length})</button>
              ${showDone ? `<ul class="list">${done.map(reminderLi).join('')}</ul>` : ''}` : ''}
          </section>
        </div>

        <details class="card details"${!s.icsUrl && !s.ics.length ? '' : ''}>
          <summary><h2>🍎 Mon calendrier iPhone (iCloud)</h2><span class="muted small">${s.ics.length ? `Connecté · ${s.icsFetched ? 'mis à jour ' + fmtDateTime(s.icsFetched) : ''}` : 'Non connecté'}</span></summary>
          <div class="form">
            <ol class="steps">
              <li>Sur ton iPhone, ouvre l’app <b>Calendrier</b> puis touche <b>Calendriers</b> en bas.</li>
              <li>Touche le <b>ⓘ</b> à côté du calendrier à afficher.</li>
              <li>Active <b>Calendrier public</b>, puis touche <b>Partager le lien</b> → <b>Copier</b>.</li>
              <li>Colle le lien ci-dessous et touche <b>Synchroniser</b>.</li>
            </ol>
            <p class="hint">⚠️ Un calendrier public peut être vu par toute personne qui a le lien : ne le partage pas.</p>
            <label class="field"><span>Lien du calendrier (webcal://…)</span><input id="icsurl" value="${esc(s.icsUrl)}" placeholder="webcal://p00-caldav.icloud.com/published/2/…"></label>
            <label class="checkline"><input type="checkbox" id="icsproxy" ${s.useProxy ? 'checked' : ''}> Passer par un service intermédiaire (corsproxy.io) si la lecture directe est bloquée</label>
            <div class="row">
              <button class="btn primary" id="icssync">Synchroniser</button>
              <label class="btn">Importer un fichier .ics<input type="file" id="icsfile" accept=".ics,text/calendar" hidden></label>
              ${s.ics.length || s.icsUrl ? '<button class="btn ghost" id="icsclear">Déconnecter</button>' : ''}
            </div>
            ${s.icsError ? `<p class="error">${esc(s.icsError)}</p>` : ''}
            ${s.ics.length ? `<p class="hint">${s.ics.length} événement(s) iCloud chargés. Le calendrier se met à jour tout seul quand tu ouvres cette page.</p>` : ''}
            <p class="hint"><b>Et l’app Rappels ?</b> Apple ne permet pas de la relier à un site web. Tu peux noter tes rappels juste au-dessus, ils s’affichent aussi dans le calendrier.</p>
          </div>
        </details>`;

      bind();
    };

    const bind = () => {
      root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
        const n = +b.dataset.nav;
        if (s.view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7 * n);
        draw();
      }));
      root.querySelector('[data-today]').addEventListener('click', () => { cursor = new Date(); selected = today(); draw(); });
      root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
        s.view = b.dataset.view; save('calendrier', s); cursor = parseKey(selected); draw();
      }));
      root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
        selected = b.dataset.day;
        const d = parseKey(selected);
        if (s.view === 'month' && d.getMonth() !== cursor.getMonth()) cursor = new Date(d.getFullYear(), d.getMonth(), 1);
        draw();
      }));

      root.querySelector('#addf').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const title = f.title.value.trim();
        if (!title) return;
        if (f.kind.value === 'rappel') s.reminders.push({ id: uid(), title, due: selected, time: f.time.value, done: false, created: Date.now() });
        else s.events.push({ id: uid(), title, date: selected, time: f.time.value, created: Date.now() });
        save('calendrier', s); toast('Ajouté ✔'); draw();
      });
      root.querySelector('#remf').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const title = f.title.value.trim();
        if (!title) return;
        s.reminders.push({ id: uid(), title, due: f.due.value, time: f.time.value, done: false, created: Date.now() });
        save('calendrier', s); toast('Rappel ajouté 🔔'); draw();
      });
      root.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', () => {
        const r = s.reminders.find((x) => x.id === c.dataset.toggle);
        if (r) { r.done = c.checked; save('calendrier', s); setTimeout(draw, 250); }
      }));
      root.querySelectorAll('[data-delrem]').forEach((b) => b.addEventListener('click', () => confirmClick(b, () => {
        s.reminders = s.reminders.filter((x) => x.id !== b.dataset.delrem); save('calendrier', s); draw();
      })));
      root.querySelectorAll('[data-delev]').forEach((b) => b.addEventListener('click', () => confirmClick(b, () => {
        s.events = s.events.filter((x) => x.id !== b.dataset.delev); save('calendrier', s); draw();
      })));
      root.querySelector('[data-showdone]')?.addEventListener('click', () => { showDone = !showDone; draw(); });

      // iCloud
      root.querySelector('#icsproxy').addEventListener('change', (e) => { s.useProxy = e.target.checked; save('calendrier', s); });
      root.querySelector('#icssync').addEventListener('click', async (e) => {
        s.icsUrl = root.querySelector('#icsurl').value.trim();
        if (!s.icsUrl) { toast('Colle d’abord le lien du calendrier'); return; }
        save('calendrier', s);
        e.target.disabled = true; e.target.textContent = 'Synchronisation…';
        const ok = await syncICS(s);
        toast(ok ? `Calendrier synchronisé (${s.ics.length} événements) ✔` : 'La synchronisation a échoué');
        draw();
        root.querySelector('details.details')?.setAttribute('open', '');
      });
      root.querySelector('#icsfile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        if (!text.includes('BEGIN:VCALENDAR')) { toast('Ce fichier n’est pas un calendrier .ics'); return; }
        s.ics = expandICS(parseICS(text)); s.icsFetched = Date.now(); s.icsError = ''; s.icsSource = 'file';
        save('calendrier', s); toast(`${s.ics.length} événements importés ✔`); draw();
      });
      root.querySelector('#icsclear')?.addEventListener('click', (e) => confirmClick(e.currentTarget, () => {
        Object.assign(s, { icsUrl: '', ics: [], icsFetched: 0, icsError: '', icsSource: '' });
        save('calendrier', s); draw();
      }));
    };

    draw();

    // Mise à jour automatique d'iCloud si la dernière date de plus de 30 min
    if (s.icsUrl && Date.now() - s.icsFetched > 30 * 60 * 1000) {
      syncICS(s).then((ok) => { if (ok && root.isConnected) draw(); });
    }
  },
};
