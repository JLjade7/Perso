// 🚗 Voiture : dépenses par catégorie + kilomètres.
import { load, save } from '../store.js';
import { esc, uid, money, num, today, fmtDate, parseNum, confirmClick, toast, bars, pageHead, MONTHS_SHORT, MONTHS, cap } from '../utils.js';

export const CATS = {
  diesel:     { label: 'Diesel',      icon: '⛽', color: '#e9a23b' },
  reparation: { label: 'Réparation',  icon: '🔧', color: '#e16259' },
  entretien:  { label: 'Entretien',   icon: '🛠️', color: '#529cca' },
  assurance:  { label: 'Assurance',   icon: '🛡️', color: '#9a6dd7' },
  peage:      { label: 'Péage',       icon: '🛣️', color: '#4dab9a' },
  parking:    { label: 'Parking',     icon: '🅿️', color: '#5e87c9' },
  lavage:     { label: 'Lavage',      icon: '🧽', color: '#e255a1' },
  releve:     { label: 'Relevé km',   icon: '📍', color: '#9b9a97' },
  autre:      { label: 'Autre',       icon: '📦', color: '#9b9a97' },
};

export const DEFAULTS = { entries: [], period: 'month' };
export const loadVoiture = () => load('voiture', DEFAULTS);

export const monthKey = (k) => k.slice(0, 7);
export const thisMonth = () => today().slice(0, 7);

function kmStats(entries) {
  const withKm = entries.filter((e) => e.km > 0).sort((a, b) => a.km - b.km);
  if (withKm.length < 1) return { current: 0, driven: 0 };
  return { current: withKm[withKm.length - 1].km, driven: withKm[withKm.length - 1].km - withKm[0].km };
}

function consumption(entries) {
  // Consommation sur les pleins qui ont litres + compteur
  const fills = entries.filter((e) => e.cat === 'diesel' && e.liters > 0 && e.km > 0).sort((a, b) => a.km - b.km);
  if (fills.length < 2) return null;
  const liters = fills.slice(1).reduce((a, e) => a + e.liters, 0);
  const km = fills[fills.length - 1].km - fills[0].km;
  return km > 0 ? (liters / km) * 100 : null;
}

export default {
  id: 'voiture',
  title: 'Voiture',
  icon: '🚗',
  render(root) {
    const s = loadVoiture();
    let formCat = 'diesel';

    const draw = () => {
      const all = s.entries;
      const now = new Date();
      const inPeriod = (e) => s.period === 'all' ? true
        : s.period === 'year' ? e.date.startsWith(String(now.getFullYear()))
        : monthKey(e.date) === thisMonth();
      const list = all.filter(inPeriod).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
      const periodTotal = list.reduce((a, e) => a + (e.amount || 0), 0);
      const total = all.reduce((a, e) => a + (e.amount || 0), 0);
      const km = kmStats(all);
      const conso = consumption(all);
      const dieselL = all.filter((e) => e.cat === 'diesel' && e.liters > 0);
      const literPrice = dieselL.length ? dieselL.reduce((a, e) => a + e.amount, 0) / dieselL.reduce((a, e) => a + e.liters, 0) : null;

      // 6 derniers mois
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({ label: MONTHS_SHORT[d.getMonth()], value: all.filter((e) => monthKey(e.date) === key).reduce((a, e) => a + (e.amount || 0), 0) });
      }

      // Par catégorie (période choisie)
      const byCat = Object.entries(CATS).map(([k, c]) => ({ k, ...c, value: list.filter((e) => e.cat === k).reduce((a, e) => a + (e.amount || 0), 0) }))
        .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);

      const periodLabel = s.period === 'month' ? cap(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`) : s.period === 'year' ? `Année ${now.getFullYear()}` : 'Depuis le début';

      root.innerHTML = `
        ${pageHead('🚗', 'Voiture', 'Dépenses, carburant et kilomètres.')}

        <div class="stats">
          <div class="stat"><div class="stat-label">Ce mois-ci</div><div class="stat-value">${money(all.filter((e) => monthKey(e.date) === thisMonth()).reduce((a, e) => a + (e.amount || 0), 0))}</div></div>
          <div class="stat"><div class="stat-label">Total dépensé</div><div class="stat-value">${money(total)}</div></div>
          <div class="stat"><div class="stat-label">Km parcourus</div><div class="stat-value">${km.driven ? num(km.driven) + ' km' : '—'}</div>${km.current ? `<div class="stat-sub">Compteur : ${num(km.current)} km</div>` : ''}</div>
          <div class="stat"><div class="stat-label">Coût au km</div><div class="stat-value">${km.driven ? money(total / km.driven) : '—'}</div><div class="stat-sub">tout compris</div></div>
          ${conso ? `<div class="stat"><div class="stat-label">Consommation</div><div class="stat-value">${num(conso, 1)} L/100</div></div>` : ''}
          ${literPrice ? `<div class="stat"><div class="stat-label">Prix moyen du litre</div><div class="stat-value">${num(literPrice, 3)} €</div></div>` : ''}
        </div>

        <div class="grid-2">
          <section class="card">
            <h2>Ajouter une dépense</h2>
            <form id="vf" class="form" autocomplete="off">
              <div class="chips-select" role="radiogroup" aria-label="Catégorie">
                ${Object.entries(CATS).map(([k, c]) => `<button type="button" class="chip-opt${k === formCat ? ' on' : ''}" data-cat="${k}" role="radio" aria-checked="${k === formCat}">${c.icon} ${c.label}</button>`).join('')}
              </div>
              <div class="row">
                <label class="field grow"><span>Montant (€)</span><input name="amount" inputmode="decimal" placeholder="${formCat === 'releve' ? 'facultatif' : '65,40'}"></label>
                <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" required></label>
              </div>
              <div class="row">
                <label class="field grow"><span>Compteur (km)</span><input name="km" inputmode="numeric" placeholder="${km.current ? num(km.current) : 'ex. 84 500'}"></label>
                ${formCat === 'diesel' ? '<label class="field grow"><span>Litres</span><input name="liters" inputmode="decimal" placeholder="ex. 40"></label>' : ''}
              </div>
              <label class="field"><span>Note</span><input name="note" placeholder="${formCat === 'reparation' ? 'ex. Plaquettes de frein' : 'facultatif'}"></label>
              <button class="btn primary">Ajouter</button>
              <p class="hint">Astuce : note le compteur à chaque plein pour calculer tes km et ta consommation.</p>
            </form>
          </section>

          <section class="card">
            <h2>Dépenses par mois</h2>
            ${bars(months, (v) => num(v) + ' €')}
          </section>
        </div>

        <section class="card">
          <div class="card-head">
            <h2>${periodLabel} · ${money(periodTotal)}</h2>
            <div class="seg" role="tablist">
              ${[['month', 'Mois'], ['year', 'Année'], ['all', 'Tout']].map(([k, l]) => `<button class="${s.period === k ? 'on' : ''}" data-period="${k}">${l}</button>`).join('')}
            </div>
          </div>
          ${byCat.length ? `<div class="catbars">${byCat.map((c) => `
            <div class="catbar"><span class="catbar-label">${c.icon} ${c.label}</span>
              <div class="catbar-track"><div style="width:${(c.value / byCat[0].value) * 100}%;background:${c.color}"></div></div>
              <span class="catbar-val">${money(c.value)} <small class="muted">${Math.round((c.value / periodTotal) * 100)} %</small></span></div>`).join('')}</div>` : ''}
          ${list.length ? `<ul class="list">${list.map((e) => {
            const c = CATS[e.cat] || CATS.autre;
            const sub = [fmtDate(e.date), e.km ? `${num(e.km)} km` : '', e.liters ? `${num(e.liters, 2)} L` : ''].filter(Boolean).join(' · ');
            return `<li class="list-item">
              <span class="li-icon">${c.icon}</span>
              <div class="li-main"><div class="li-title">${esc(e.note) || c.label}</div><div class="li-sub">${esc(e.note) ? c.label + ' · ' : ''}${sub}</div></div>
              <span class="li-amount">${e.amount ? money(e.amount) : ''}</span>
              <button class="icon-btn" data-del="${e.id}" aria-label="Supprimer">🗑</button>
            </li>`;
          }).join('')}</ul>` : '<p class="empty">Rien sur cette période.</p>'}
        </section>`;

      root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
        const f = root.querySelector('#vf');
        const keep = { amount: f.amount.value, date: f.date.value, km: f.km.value, note: f.note.value };
        formCat = b.dataset.cat;
        draw();
        const f2 = root.querySelector('#vf');
        Object.entries(keep).forEach(([k, v]) => { f2[k].value = v; });
      }));

      root.querySelector('#vf').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const amount = parseNum(f.amount.value);
        const kmv = parseNum(f.km.value);
        const liters = f.liters ? parseNum(f.liters.value) : NaN;
        if (!(amount > 0) && !(kmv > 0)) { toast('Indique au moins un montant ou un kilométrage'); return; }
        s.entries.push({
          id: uid(), created: Date.now(), cat: formCat, date: f.date.value || today(),
          amount: amount > 0 ? amount : 0, km: kmv > 0 ? Math.round(kmv) : 0,
          liters: liters > 0 ? liters : 0, note: f.note.value.trim(),
        });
        save('voiture', s);
        toast('Ajouté ✔');
        draw();
      });

      root.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => {
        s.period = b.dataset.period; save('voiture', s); draw();
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
