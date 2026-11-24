// 🏠 Accueil : un résumé de toutes les rubriques.
import { load } from '../store.js';
import { esc, money, today, fmtDate, fmtDateTime, cap, num } from '../utils.js';
import { loadTirelire, totalOf, pigSVG } from './tirelire.js';
import { loadVoiture, monthKey, thisMonth } from './voiture.js';
import { loadNotes } from './notes.js';
import { loadCal, itemsFor } from './calendrier.js';
import { loadWish } from './wishlist.js';

export default {
  id: 'accueil',
  title: 'Accueil',
  icon: '🏠',
  render(root) {
    const settings = load('reglages', { name: '' });
    const h = new Date().getHours();
    const hello = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';

    const t = loadTirelire();
    const total = totalOf(t);
    const p = t.goal > 0 ? Math.max(0, Math.min(1, total / t.goal)) : 0;

    const v = loadVoiture();
    const carMonth = v.entries.filter((e) => monthKey(e.date) === thisMonth()).reduce((a, e) => a + (e.amount || 0), 0);
    const lastKm = Math.max(0, ...v.entries.map((e) => e.km || 0));

    const notes = loadNotes().notes.sort((a, b) => b.updated - a.updated).slice(0, 3);

    const cal = loadCal();
    const todayItems = itemsFor(cal, today());
    const lateCount = cal.reminders.filter((r) => !r.done && r.due && r.due < today()).length;

    const w = loadWish();
    const todo = w.items.filter((i) => !i.bought);
    const todoTotal = todo.reduce((a, i) => a + (i.price || 0), 0);

    root.innerHTML = `
      <header class="page-head home-head">
        <div class="page-title-row">
          <h1>${hello}${settings.name ? ' ' + esc(settings.name) : ''} 👋</h1>
          <a class="icon-btn gear" href="#/reglages" aria-label="Réglages">⚙️</a>
        </div>
        <p class="muted">${cap(fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
      </header>

      <div class="home-grid">
        <a class="card tile" href="#/tirelire">
          <div class="tile-head">🐷 Tirelire</div>
          <div class="tile-pig">${pigSVG(p, { small: true })}
            <div><div class="big-number">${money(total)}</div><div class="muted">${Math.round(p * 100)} % de « ${esc(t.goalName)} »</div></div></div>
          <div class="progress"><div style="width:${p * 100}%"></div></div>
        </a>

        <a class="card tile" href="#/calendrier">
          <div class="tile-head">📅 Aujourd’hui</div>
          ${todayItems.length ? `<ul class="mini">${todayItems.slice(0, 5).map((i) => `<li>${i.kind === 'rappel' ? (i.done ? '☑️' : '🔔') : i.kind === 'ics' ? '🍎' : '📌'} ${i.time ? `<b>${i.time}</b> ` : ''}${esc(i.title)}</li>`).join('')}</ul>` : '<p class="muted">Rien de prévu aujourd’hui.</p>'}
          ${lateCount ? `<p class="late small">${lateCount} rappel(s) en retard</p>` : ''}
        </a>

        <a class="card tile" href="#/voiture">
          <div class="tile-head">🚗 Voiture</div>
          <div class="big-number">${money(carMonth)}</div>
          <div class="muted">dépensés ce mois-ci${lastKm ? ` · compteur ${num(lastKm)} km` : ''}</div>
        </a>

        <a class="card tile" href="#/wishlist">
          <div class="tile-head">🛍️ Wish list</div>
          <div class="big-number">${money(todoTotal)}</div>
          <div class="muted">${todo.length} article(s) à acheter</div>
        </a>

        <a class="card tile tile-wide" href="#/notes">
          <div class="tile-head">📝 Dernières notes</div>
          ${notes.length ? `<ul class="mini">${notes.map((n) => `<li>${n.mood || '📄'} ${esc(n.title) || 'Sans titre'} <span class="muted small">· ${fmtDateTime(n.updated)}</span></li>`).join('')}</ul>` : '<p class="muted">Aucune note pour l’instant.</p>'}
        </a>
      </div>`;
  },
};
