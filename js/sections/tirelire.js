// 🐷 Tirelire : objectif d'épargne + historique des versements.
import { load, save } from '../store.js';
import { esc, uid, money, today, fmtDate, parseNum, confirmClick, toast, pageHead, parseKey } from '../utils.js';

export const DEFAULTS = { goalName: 'Mon objectif', goal: 1000, deadline: '', entries: [] };

export const totalOf = (s) => s.entries.reduce((a, e) => a + (e.amount || 0), 0);
export const loadTirelire = () => load('tirelire', DEFAULTS);

// Dessin de la tirelire qui se remplit selon le pourcentage p (0 → 1)
export function pigSVG(p, { small = false } = {}) {
  const top = 45, h = 140;
  const y = top + h * (1 - p);
  const id = 'pig' + Math.random().toString(36).slice(2, 7);
  return `<svg class="pig${small ? ' pig-small' : ''}" viewBox="0 0 260 210" role="img" aria-label="Tirelire remplie à ${Math.round(p * 100)} %">
    <defs>
      <clipPath id="${id}c"><ellipse cx="125" cy="115" rx="95" ry="70"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--pig-fill-1)"/><stop offset="1" stop-color="var(--pig-fill-2)"/>
      </linearGradient>
    </defs>
    <rect x="62" y="158" width="28" height="40" rx="10" fill="var(--pig-dark)"/>
    <rect x="158" y="158" width="28" height="40" rx="10" fill="var(--pig-dark)"/>
    <path d="M33 108 q-20 -4 -16 -20 q5 -12 14 -2 q7 9 -6 15" fill="none" stroke="var(--pig-dark)" stroke-width="5" stroke-linecap="round"/>
    <path d="M146 58 L166 22 L184 62 Z" fill="var(--pig-dark)" stroke="var(--pig-dark)" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="125" cy="115" rx="95" ry="70" fill="var(--pig-empty)"/>
    <g clip-path="url(#${id}c)">
      <rect class="pig-level" x="20" y="${y}" width="220" height="${h * p + 2}" fill="url(#${id}g)"/>
      ${p > 0 && p < 1 ? `<path class="pig-wave" d="M20 ${y} q13.75 -7 27.5 0 t27.5 0 t27.5 0 t27.5 0 t27.5 0 t27.5 0 t27.5 0 t27.5 0 v6 h-220 z" fill="var(--pig-fill-1)"/>` : ''}
    </g>
    <ellipse cx="125" cy="115" rx="95" ry="70" fill="none" stroke="var(--pig-dark)" stroke-width="4"/>
    <path d="M160 60 L178 30 L192 66" fill="var(--pig-empty)" stroke="var(--pig-dark)" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="222" cy="120" rx="19" ry="24" fill="var(--pig-snout)" stroke="var(--pig-dark)" stroke-width="4"/>
    <ellipse cx="216" cy="120" rx="3" ry="6" fill="var(--pig-dark)"/>
    <ellipse cx="228" cy="120" rx="3" ry="6" fill="var(--pig-dark)"/>
    <circle cx="184" cy="96" r="5.5" fill="var(--pig-eye)"/>
    <rect x="98" y="51" width="50" height="9" rx="4.5" fill="var(--pig-dark)"/>
    ${small ? '' : `<text x="125" y="128" text-anchor="middle" class="pig-pct">${Math.round(p * 100)} %</text>`}
  </svg>`;
}

function monthsUntil(key) {
  const now = new Date();
  const d = parseKey(key);
  const m = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()) + (d.getDate() >= now.getDate() ? 0 : -1);
  return Math.max(1, m + 1);
}

export default {
  id: 'tirelire',
  title: 'Tirelire',
  icon: '🐷',
  render(root) {
    const s = loadTirelire();

    const draw = () => {
      const total = totalOf(s);
      const p = s.goal > 0 ? Math.max(0, Math.min(1, total / s.goal)) : 0;
      const rest = Math.max(0, s.goal - total);
      const entries = [...s.entries].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
      let plan = '';
      if (s.deadline && rest > 0) {
        const m = monthsUntil(s.deadline);
        plan = `<p class="hint">Pour y arriver d'ici le ${fmtDate(s.deadline, { day: 'numeric', month: 'long', year: 'numeric' })}, mets de côté environ <b>${money(rest / m)}</b> par mois (${m} mois).</p>`;
      }

      root.innerHTML = `
        ${pageHead('🐷', 'Tirelire', 'Suis tes économies jusqu’à ton objectif.')}
        <div class="grid-2">
          <section class="card pig-card">
            ${pigSVG(p)}
            <div class="big-number">${money(total)}</div>
            <div class="muted">sur ${money(s.goal)}</div>
            <div class="progress" aria-hidden="true"><div style="width:${p * 100}%"></div></div>
            <p>${rest > 0 ? `Encore <b>${money(rest)}</b> pour « ${esc(s.goalName)} »` : '🎉 Objectif atteint, bravo !'}</p>
            ${plan}
          </section>

          <div class="stack">
            <section class="card">
              <h2>Ajouter un mouvement</h2>
              <form id="mv" class="form" autocomplete="off">
                <div class="row">
                  <label class="field grow"><span>Montant (€)</span><input name="amount" inputmode="decimal" placeholder="50" required></label>
                  <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" required></label>
                </div>
                <label class="field"><span>Note</span><input name="note" placeholder="ex. Salaire, anniversaire…"></label>
                <div class="row">
                  <button class="btn primary grow" value="add">＋ Déposer</button>
                  <button class="btn grow" value="sub">－ Retirer</button>
                </div>
              </form>
            </section>

            <section class="card">
              <h2>Mon objectif</h2>
              <div class="form">
                <label class="field"><span>Nom de l'objectif</span><input data-k="goalName" value="${esc(s.goalName)}" placeholder="ex. Vacances, nouvelle voiture…"></label>
                <div class="row">
                  <label class="field grow"><span>Montant visé (€)</span><input data-k="goal" inputmode="decimal" value="${s.goal}"></label>
                  <label class="field"><span>Date visée (facultatif)</span><input type="date" data-k="deadline" value="${esc(s.deadline)}"></label>
                </div>
              </div>
            </section>
          </div>
        </div>

        <section class="card">
          <h2>Historique <span class="count">${entries.length}</span></h2>
          ${entries.length ? `<ul class="list">${entries.map((e) => `
            <li class="list-item">
              <span class="li-icon">${e.amount >= 0 ? '🪙' : '💸'}</span>
              <div class="li-main"><div class="li-title">${esc(e.note) || (e.amount >= 0 ? 'Dépôt' : 'Retrait')}</div>
                <div class="li-sub">${fmtDate(e.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
              <span class="li-amount ${e.amount >= 0 ? 'pos' : 'neg'}">${e.amount >= 0 ? '+' : ''}${money(e.amount)}</span>
              <button class="icon-btn" data-del="${e.id}" aria-label="Supprimer">🗑</button>
            </li>`).join('')}</ul>` : '<p class="empty">Aucun versement pour l’instant. Ajoute ton premier dépôt ci-dessus 🙂</p>'}
        </section>`;

      root.querySelector('#mv').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const amount = parseNum(f.amount.value);
        if (!(amount > 0)) { toast('Indique un montant valide'); return; }
        const sign = ev.submitter && ev.submitter.value === 'sub' ? -1 : 1;
        s.entries.push({ id: uid(), date: f.date.value || today(), amount: sign * amount, note: f.note.value.trim(), created: Date.now() });
        save('tirelire', s);
        toast(sign > 0 ? `+${money(amount)} dans la tirelire 🐷` : `${money(amount)} retiré`);
        draw();
      });

      root.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
        const k = inp.dataset.k;
        if (k === 'goal') {
          const v = parseNum(inp.value);
          if (!(v > 0)) { toast('Montant invalide'); inp.value = s.goal; return; }
          s.goal = v;
        } else s[k] = inp.value.trim();
        save('tirelire', s);
        draw();
      }));

      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmClick(b, () => {
        s.entries = s.entries.filter((e) => e.id !== b.dataset.del);
        save('tirelire', s);
        draw();
      })));
    };

    draw();
  },
};
