// 🚗 Voiture : dépenses, autonomie de chaque plein et récapitulatif du mois / de l'année.
import { load, save } from '../store.js';
import { esc, uid, money, num, today, fmtDate, parseNum, parseKey, confirmClick, toast, bars, pageHead, MONTHS, MONTHS_SHORT, cap } from '../utils.js';

export const CATS = {
  diesel:     { label: 'Plein diesel', short: 'Diesel', icon: '⛽', color: '#e9a23b' },
  reparation: { label: 'Réparation',   icon: '🔧', color: '#e16259' },
  entretien:  { label: 'Entretien',    icon: '🛠️', color: '#529cca' },
  assurance:  { label: 'Assurance',    icon: '🛡️', color: '#9a6dd7' },
  peage:      { label: 'Péage',        icon: '🛣️', color: '#4dab9a' },
  parking:    { label: 'Parking',      icon: '🅿️', color: '#5e87c9' },
  lavage:     { label: 'Lavage',       icon: '🧽', color: '#e255a1' },
  autre:      { label: 'Autre',        icon: '📦', color: '#9b9a97' },
};
const catOf = (e) => CATS[e.cat] || CATS.autre;
const catName = (c) => c.short || c.label;

export const DEFAULTS = { entries: [], period: 'month' };
export const loadVoiture = () => load('voiture', DEFAULTS);

export const monthKey = (k) => k.slice(0, 7);
export const thisMonth = () => today().slice(0, 7);
const sum = (arr, f = (e) => e.amount || 0) => arr.reduce((a, e) => a + f(e), 0);
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const plural = (n, w) => `${num(n)} ${w}${Math.abs(n) > 1 ? 's' : ''}`;

// Pour chaque plein : combien de km et de jours il a tenu (jusqu'au plein suivant)
export function fillsInfo(entries) {
  const fills = entries.filter((e) => e.cat === 'diesel' && e.km > 0)
    .sort((a, b) => a.km - b.km || a.date.localeCompare(b.date));
  const info = new Map();
  fills.forEach((f, i) => {
    const next = fills[i + 1];
    if (!next) { info.set(f.id, { current: true, days: daysBetween(f.date, today()) }); return; }
    const km = next.km - f.km;
    const days = daysBetween(f.date, next.date);
    const conso = next.liters > 0 && km > 0 ? (next.liters / km) * 100 : null;
    info.set(f.id, { km, days, conso });
  });
  return info;
}

// Km parcourus dans une période : dernier compteur de la période − dernier compteur avant
function kmInPeriod(entries, inPeriod, startKey) {
  const readings = entries.filter((e) => e.km > 0).sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  const inside = readings.filter(inPeriod);
  if (!inside.length) return 0;
  const before = readings.filter((e) => e.date < startKey);
  const from = before.length ? before[before.length - 1].km : inside[0].km;
  return Math.max(0, inside[inside.length - 1].km - from);
}

let recapMode = null;           // 'month' | 'year'
let recapDate = new Date();     // mois / année affiché dans le récap

export default {
  id: 'voiture',
  title: 'Voiture',
  icon: '🚗',
  render(root) {
    const s = loadVoiture();
    if (!recapMode) recapMode = s.period === 'year' ? 'year' : 'month';
    let formCat = 'diesel';

    const draw = () => {
      const all = s.entries;
      const info = fillsInfo(all);
      const done = [...info.values()].filter((x) => !x.current && x.km > 0);
      const avgKm = done.length ? sum(done, (x) => x.km) / done.length : 0;
      const avgDays = done.length ? sum(done, (x) => x.days) / done.length : 0;
      const consos = done.filter((x) => x.conso);
      const avgConso = consos.length ? sum(consos, (x) => x.conso) / consos.length : null;
      const fills = all.filter((e) => e.cat === 'diesel').sort((a, b) => b.date.localeCompare(a.date) || (b.km || 0) - (a.km || 0));
      const lastFill = fills[0];
      const lastKm = Math.max(0, ...all.map((e) => e.km || 0));

      // ----- Récapitulatif -----
      const y = recapDate.getFullYear(), m = recapDate.getMonth();
      const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
      const inPeriod = recapMode === 'year' ? (e) => e.date.startsWith(String(y)) : (e) => monthKey(e.date) === mk;
      const startKey = recapMode === 'year' ? `${y}-01-01` : `${mk}-01`;
      const list = all.filter(inPeriod).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
      const total = sum(list);
      const pFills = list.filter((e) => e.cat === 'diesel');
      const pLiters = sum(pFills, (e) => e.liters || 0);
      const pKm = kmInPeriod(all, inPeriod, startKey);
      const pDone = pFills.map((f) => info.get(f.id)).filter((x) => x && !x.current && x.km > 0);
      const pAvgKm = pDone.length ? sum(pDone, (x) => x.km) / pDone.length : 0;
      const byCat = Object.entries(CATS).map(([k, c]) => ({ k, ...c, value: sum(list.filter((e) => e.cat === k)) }))
        .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
      const periodLabel = recapMode === 'year' ? `Année ${y}` : cap(`${MONTHS[m]} ${y}`);

      let compare = '';
      if (recapMode === 'month') {
        const pd = new Date(y, m - 1, 1);
        const pk = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
        const prev = sum(all.filter((e) => monthKey(e.date) === pk));
        if (prev > 0 && total > 0) {
          const d = Math.round(((total - prev) / prev) * 100);
          compare = `<span class="pill ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} % vs ${MONTHS[pd.getMonth()]}</span>`;
        }
      }
      const yearBars = recapMode === 'year'
        ? bars(MONTHS_SHORT.map((label, i) => ({ label: label.replace('.', ''), value: sum(all.filter((e) => monthKey(e.date) === `${y}-${String(i + 1).padStart(2, '0')}`)) })), (v) => num(v) + ' €')
        : '';

      const fillLi = (f) => {
        const x = info.get(f.id);
        let tenue = '<span class="muted small">Ajoute le compteur pour savoir combien de km il tient</span>';
        if (x && x.current) tenue = `<span class="pill now">En cours · ${plural(x.days, 'jour')}</span>`;
        else if (x) tenue = `<span class="pill ok">A tenu <b>${num(x.km)} km</b> en ${plural(x.days, 'jour')}</span>${x.conso ? ` <span class="muted small">≈ ${num(x.conso, 1)} L/100</span>` : ''}`;
        const sub = [fmtDate(f.date, { day: 'numeric', month: 'short', year: 'numeric' }), f.liters ? `${num(f.liters, 2)} L` : '', f.km ? `${num(f.km)} km au compteur` : ''].filter(Boolean).join(' · ');
        return `<li class="list-item fill">
          <span class="li-icon">⛽</span>
          <div class="li-main"><div class="li-title">${money(f.amount)}${f.note ? ` <span class="muted">· ${esc(f.note)}</span>` : ''}</div>
            <div class="li-sub">${sub}</div><div class="fill-tenue">${tenue}</div></div>
          <button class="icon-btn" data-del="${f.id}" aria-label="Supprimer">🗑</button>
        </li>`;
      };

      root.innerHTML = `
        ${pageHead('🚗', 'Voiture', 'Tes pleins, tes dépenses et le récap de chaque mois.')}

        <div class="stats">
          <div class="stat stat-hero"><div class="stat-label">Un plein te dure en moyenne</div>
            <div class="stat-value">${avgKm ? num(avgKm) + ' km' : '—'}</div>
            <div class="stat-sub">${avgKm ? `soit environ ${plural(Math.round(avgDays), 'jour')}` : 'Note le compteur à chaque plein'}</div></div>
          <div class="stat"><div class="stat-label">Plein actuel</div>
            <div class="stat-value">${lastFill ? plural(daysBetween(lastFill.date, today()), 'jour') : '—'}</div>
            <div class="stat-sub">${lastFill ? `depuis le ${fmtDate(lastFill.date, { day: 'numeric', month: 'long' })}${avgDays && daysBetween(lastFill.date, today()) < avgDays ? ` · prochain vers le ${fmtDate(addDays(lastFill.date, Math.round(avgDays)), { day: 'numeric', month: 'long' })}` : ''}` : 'Aucun plein noté'}</div></div>
          <div class="stat"><div class="stat-label">Dépensé ce mois-ci</div>
            <div class="stat-value">${money(sum(all.filter((e) => monthKey(e.date) === thisMonth())))}</div>
            <div class="stat-sub">${lastKm ? `Compteur : ${num(lastKm)} km` : ''}</div></div>
          <div class="stat"><div class="stat-label">Consommation moyenne</div>
            <div class="stat-value">${avgConso ? num(avgConso, 1) + ' L/100' : '—'}</div>
            <div class="stat-sub">${avgConso ? '' : 'Note les litres pour la calculer'}</div></div>
        </div>

        <div class="grid-2">
          <section class="card">
            <h2>Ajouter</h2>
            <form id="vf" class="form" autocomplete="off">
              <div class="chips-select" role="radiogroup" aria-label="Catégorie">
                ${Object.entries(CATS).map(([k, c]) => `<button type="button" class="chip-opt${k === formCat ? ' on' : ''}" data-cat="${k}" role="radio" aria-checked="${k === formCat}">${c.icon} ${catName(c)}</button>`).join('')}
              </div>
              <div class="row">
                <label class="field grow"><span>Montant (€)</span><input name="amount" inputmode="decimal" placeholder="65,40" required></label>
                <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" required></label>
              </div>
              ${formCat === 'diesel' ? `
              <div class="row">
                <label class="field grow"><span>Compteur (km)</span><input name="km" inputmode="numeric" placeholder="${lastKm ? 'ex. ' + num(lastKm + 600) : 'ex. 84 500'}"></label>
                <label class="field grow"><span>Litres</span><input name="liters" inputmode="decimal" placeholder="ex. 40"></label>
              </div>
              <p class="hint">⛽ Fais le plein, note le compteur : le site calcule combien de km ton plein précédent a tenu.</p>` : `
              <label class="field"><span>Compteur (km, facultatif)</span><input name="km" inputmode="numeric" placeholder="${lastKm ? num(lastKm) : ''}"></label>`}
              <label class="field"><span>Note</span><input name="note" placeholder="${formCat === 'reparation' ? 'ex. Plaquettes de frein' : formCat === 'diesel' ? 'ex. Total Leclerc' : 'facultatif'}"></label>
              <button class="btn primary">Ajouter</button>
            </form>
          </section>

          <section class="card">
            <h2>Mes pleins <span class="count">${fills.length}</span></h2>
            ${fills.length ? `<ul class="list">${fills.slice(0, 8).map(fillLi).join('')}</ul>${fills.length > 8 ? '<p class="hint">Les plus anciens sont dans le récap ci-dessous.</p>' : ''}`
              : '<p class="empty">Aucun plein pour l’instant. Ajoute ton prochain plein avec le compteur ⛽</p>'}
          </section>
        </div>

        <section class="card recap">
          <div class="card-head">
            <div class="cal-nav">
              <button class="icon-btn" data-rnav="-1" aria-label="Précédent">‹</button>
              <h2 class="recap-title">Récap · ${periodLabel}</h2>
              <button class="icon-btn" data-rnav="1" aria-label="Suivant">›</button>
            </div>
            <div class="seg">
              <button class="${recapMode === 'month' ? 'on' : ''}" data-rmode="month">Mois</button>
              <button class="${recapMode === 'year' ? 'on' : ''}" data-rmode="year">Année</button>
            </div>
          </div>

          <div class="recap-total"><span class="big-number">${money(total)}</span> <span class="muted">dépensés</span> ${compare}</div>
          <div class="stats recap-stats">
            <div class="stat"><div class="stat-label">Pleins</div><div class="stat-value">${pFills.length}</div><div class="stat-sub">${money(sum(pFills))}</div></div>
            <div class="stat"><div class="stat-label">Litres</div><div class="stat-value">${pLiters ? num(pLiters, 1) + ' L' : '—'}</div><div class="stat-sub">${pLiters ? num(sum(pFills.filter((e) => e.liters > 0)) / pLiters, 3) + ' €/L' : ''}</div></div>
            <div class="stat"><div class="stat-label">Km parcourus</div><div class="stat-value">${pKm ? num(pKm) + ' km' : '—'}</div><div class="stat-sub">${pKm && total ? money(total / pKm) + ' par km' : ''}</div></div>
            <div class="stat"><div class="stat-label">Un plein a tenu</div><div class="stat-value">${pAvgKm ? num(pAvgKm) + ' km' : '—'}</div><div class="stat-sub">${pAvgKm ? 'en moyenne' : ''}</div></div>
          </div>

          ${yearBars ? `<div class="recap-bars">${yearBars}</div>` : ''}

          ${byCat.length ? `<div class="catbars">${byCat.map((c) => `
            <div class="catbar"><span class="catbar-label">${c.icon} ${catName(c)}</span>
              <div class="catbar-track"><div style="width:${(c.value / byCat[0].value) * 100}%;background:${c.color}"></div></div>
              <span class="catbar-val">${money(c.value)} <small class="muted">${Math.round((c.value / total) * 100)} %</small></span></div>`).join('')}</div>` : ''}

          ${list.length ? `<details class="recap-list"${recapMode === 'month' ? ' open' : ''}><summary>Toutes les dépenses (${list.length})</summary><ul class="list">${list.map((e) => {
            const c = catOf(e);
            const sub = [fmtDate(e.date), e.km ? `${num(e.km)} km` : '', e.liters ? `${num(e.liters, 2)} L` : ''].filter(Boolean).join(' · ');
            return `<li class="list-item">
              <span class="li-icon">${c.icon}</span>
              <div class="li-main"><div class="li-title">${esc(e.note) || catName(c)}</div><div class="li-sub">${esc(e.note) ? catName(c) + ' · ' : ''}${sub}</div></div>
              <span class="li-amount">${e.amount ? money(e.amount) : ''}</span>
              <button class="icon-btn" data-del="${e.id}" aria-label="Supprimer">🗑</button>
            </li>`;
          }).join('')}</ul></details>` : `<p class="empty">Rien de noté pour ${recapMode === 'year' ? 'cette année' : 'ce mois'}.</p>`}
        </section>`;

      bind();
    };

    const bind = () => {
      root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
        const f = root.querySelector('#vf');
        const keep = { amount: f.amount.value, date: f.date.value, km: f.km.value, note: f.note.value };
        formCat = b.dataset.cat;
        draw();
        const f2 = root.querySelector('#vf');
        Object.entries(keep).forEach(([k, v]) => { if (f2[k]) f2[k].value = v; });
      }));

      root.querySelector('#vf').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const amount = parseNum(f.amount.value);
        const kmv = parseNum(f.km?.value);
        const liters = f.liters ? parseNum(f.liters.value) : NaN;
        if (!(amount > 0)) { toast('Indique le montant'); return; }
        s.entries.push({
          id: uid(), created: Date.now(), cat: formCat, date: f.date.value || today(),
          amount, km: kmv > 0 ? Math.round(kmv) : 0, liters: liters > 0 ? liters : 0, note: f.note.value.trim(),
        });
        save('voiture', s);
        let msg = 'Ajouté ✔';
        if (formCat === 'diesel' && kmv > 0) {
          const x = fillsInfo(s.entries);
          const prev = s.entries.filter((e) => e.cat === 'diesel' && e.km > 0 && e.km < kmv).sort((a, b) => b.km - a.km)[0];
          const pi = prev && x.get(prev.id);
          if (pi && pi.km) msg = `Ton plein précédent a tenu ${num(pi.km)} km en ${plural(pi.days, 'jour')} ⛽`;
        }
        toast(msg);
        draw();
      });

      root.querySelectorAll('[data-rmode]').forEach((b) => b.addEventListener('click', () => {
        recapMode = b.dataset.rmode; s.period = recapMode; save('voiture', s); draw();
      }));
      root.querySelectorAll('[data-rnav]').forEach((b) => b.addEventListener('click', () => {
        const n = +b.dataset.rnav;
        recapDate = recapMode === 'year'
          ? new Date(recapDate.getFullYear() + n, recapDate.getMonth(), 1)
          : new Date(recapDate.getFullYear(), recapDate.getMonth() + n, 1);
        draw();
      }));

      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmClick(b, () => {
        s.entries = s.entries.filter((e) => e.id !== b.dataset.del);
        save('voiture', s);
        draw();
      })));
    };

    draw();
  },
};

function addDays(key, n) {
  const d = parseKey(key); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
