// 🛍 Wish list : tableau façon Notion (nom, lien, prix, priorité, image, acheté).
import { load, save } from '../store.js';
import { esc, uid, money, parseNum, confirmClick, toast, pageHead } from '../utils.js';
import { loadTirelire, totalOf } from './tirelire.js';

export const PRIORITIES = {
  haute:   { label: 'Haute',   cls: 'red' },
  moyenne: { label: 'Moyenne', cls: 'yellow' },
  basse:   { label: 'Basse',   cls: 'gray' },
};
const PRI_ORDER = { haute: 0, moyenne: 1, basse: 2 };

export const DEFAULTS = { items: [], filter: 'todo', sort: 'priority', view: 'gallery' };
export const loadWish = () => load('wishlist', DEFAULTS);

let openImg = null;
const loading = new Set();

// Récupère l'image (et le nom) du produit à partir de son lien.
// Utilise le service gratuit microlink.io, qui lit la page du produit.
export async function fetchPreview(url) {
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== 'success' || !j.data) return null;
    const d = j.data;
    return {
      image: d.image?.url || d.logo?.url || '',
      title: (d.title || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    };
  } catch (e) {
    return null;
  }
}

const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '';
const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

export default {
  id: 'wishlist',
  title: 'Wish list',
  short: 'Wish',
  icon: '🛍️',
  render(root) {
    const s = loadWish();

    const draw = (focusId) => {
      const items = s.items.filter((i) => s.filter === 'all' ? true : s.filter === 'bought' ? i.bought : !i.bought);
      const sorters = {
        priority: (a, b) => (PRI_ORDER[a.priority] ?? 1) - (PRI_ORDER[b.priority] ?? 1) || b.created - a.created,
        priceAsc: (a, b) => (a.price || 0) - (b.price || 0),
        priceDesc: (a, b) => (b.price || 0) - (a.price || 0),
        recent: (a, b) => b.created - a.created,
      };
      items.sort(sorters[s.sort] || sorters.priority);

      const totalAll = s.items.reduce((a, i) => a + (i.price || 0), 0);
      const totalTodo = s.items.filter((i) => !i.bought).reduce((a, i) => a + (i.price || 0), 0);
      const totalBought = totalAll - totalTodo;
      const piggy = totalOf(loadTirelire());

      const row = (i) => {
        const url = safeUrl(i.url);
        const img = safeUrl(i.image);
        const p = PRIORITIES[i.priority] || PRIORITIES.moyenne;
        return `<div class="wrow${i.bought ? ' bought' : ''}${url ? ' has-url' : ''}" data-id="${i.id}">
          <label class="wcheck"><input type="checkbox" class="check" data-f="bought" ${i.bought ? 'checked' : ''} aria-label="Acheté"></label>
          <button class="wimg" data-act="img" aria-label="Changer l’image">${loading.has(i.id) ? '<span class="spin" aria-label="Recherche de l’image"></span>' : img ?`<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span>🛍️</span>'}</button>
          <div class="wname">
            <input class="cell" data-f="name" value="${esc(i.name)}" placeholder="Nom de l’article">
            <div class="wlink">
              <input class="cell small" data-f="url" value="${esc(i.url)}" placeholder="Coller le lien (https://…)" inputmode="url">
              ${url ? `<a class="open" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Ouvrir ${esc(domain(url))}">↗ ${esc(domain(url))}</a>` : ''}
            </div>
            ${openImg === i.id ? `<div class="wimgedit">
              ${url ? '<button class="btn small" data-act="refetch">🔄 Retrouver l’image depuis le lien</button>' : ''}
              <input class="cell small" data-f="image" value="${esc(i.image)}" placeholder="…ou colle le lien d’une image (appui long sur l’image → copier)">
            </div>` : ''}
          </div>
          <div class="wprice"><input class="cell num" data-f="price" inputmode="decimal" value="${i.price ? i.price.toFixed(2).replace('.', ',') : ''}" placeholder="0,00"><span>€</span></div>
          <div class="wpri"><select class="tag tag-${p.cls}" data-f="priority" aria-label="Priorité">
            ${Object.entries(PRIORITIES).map(([k, v]) => `<option value="${k}"${k === i.priority ? ' selected' : ''}>${v.label}</option>`).join('')}
          </select></div>
          <button class="icon-btn wdel" data-act="del" aria-label="Supprimer">🗑</button>
        </div>`;
      };

      root.innerHTML = `
        ${pageHead('🛍️', 'Wish list', 'Mes futurs achats, avec liens et prix.')}
        <div class="stats">
          <div class="stat"><div class="stat-label">Reste à acheter</div><div class="stat-value">${money(totalTodo)}</div><div class="stat-sub">${s.items.filter((i) => !i.bought).length} article(s)</div></div>
          <div class="stat"><div class="stat-label">Déjà acheté</div><div class="stat-value">${money(totalBought)}</div></div>
          <div class="stat"><div class="stat-label">Total de la liste</div><div class="stat-value">${money(totalAll)}</div></div>
          <div class="stat"><div class="stat-label">Dans la tirelire 🐷</div><div class="stat-value">${money(piggy)}</div><div class="stat-sub">${totalTodo > 0 ? (piggy >= totalTodo ? 'De quoi tout acheter !' : `Il manque ${money(totalTodo - piggy)}`) : ''}</div></div>
        </div>

        <form id="wquick" class="card quickadd" autocomplete="off">
          <label for="wqurl" class="quickadd-label">🔗 Ajouter un article avec son lien</label>
          <div class="row">
            <input id="wqurl" class="grow" inputmode="url" placeholder="Colle ici le lien du produit (https://…)">
            <button class="btn primary">Ajouter</button>
          </div>
          <p class="hint">L’image et le nom du produit s’affichent tout seuls. Tu n’as plus qu’à mettre le prix.</p>
        </form>

        <section class="card wcard">
          <div class="card-head">
            <div class="seg">
              ${[['todo', 'À acheter'], ['bought', 'Achetés'], ['all', 'Tout']].map(([k, l]) => `<button class="${s.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}
            </div>
            <div class="row">
              <select id="wsort" aria-label="Trier">
                <option value="priority"${s.sort === 'priority' ? ' selected' : ''}>Trier : priorité</option>
                <option value="priceAsc"${s.sort === 'priceAsc' ? ' selected' : ''}>Prix croissant</option>
                <option value="priceDesc"${s.sort === 'priceDesc' ? ' selected' : ''}>Prix décroissant</option>
                <option value="recent"${s.sort === 'recent' ? ' selected' : ''}>Plus récents</option>
              </select>
              <div class="seg" aria-label="Affichage">
                <button class="${s.view !== 'table' ? 'on' : ''}" data-view="gallery" title="Galerie">▦ Galerie</button>
                <button class="${s.view === 'table' ? 'on' : ''}" data-view="table" title="Tableau">☰ Tableau</button>
              </div>
              <button class="btn primary" id="wadd">＋ Nouveau</button>
            </div>
          </div>
          <div class="wtable${s.view !== 'table' ? ' gallery' : ''}">
            <div class="whead"><span>✓</span><span></span><span>Article</span><span>Prix</span><span>Priorité</span><span></span></div>
            ${items.map(row).join('') || `<p class="empty">${s.items.length ? 'Rien dans ce filtre.' : 'Ta wish list est vide. Clique sur « Nouveau » pour ajouter ton premier article ✨'}</p>`}
          </div>
          <button class="wnew" id="wadd2">＋ Nouvel article</button>
        </section>`;

      bind();
      if (focusId) root.querySelector(`[data-id="${focusId}"] [data-f="name"]`)?.focus();
    };

    const addItem = () => {
      const it = { id: uid(), name: '', url: '', price: 0, priority: 'moyenne', image: '', bought: false, created: Date.now() };
      s.items.push(it);
      if (s.filter === 'bought') s.filter = 'todo';
      save('wishlist', s);
      draw(it.id);
    };

    // Cherche l'image + le nom depuis le lien, puis met à jour la ligne
    const autofill = async (it, { force = false } = {}) => {
      const url = safeUrl(it.url);
      if (!url) return;
      if (it.image && !it.imageAuto && !force) return; // image choisie à la main : on n'y touche pas
      loading.add(it.id); draw();
      const meta = await fetchPreview(url);
      loading.delete(it.id);
      if (meta) {
        if (meta.image) { it.image = meta.image; it.imageAuto = true; }
        if (!it.name && meta.title) it.name = meta.title;
        save('wishlist', s);
        if (!meta.image) toast('Pas d’image trouvée pour ce lien. Touche l’image pour en mettre une.');
      } else {
        toast('Impossible de lire ce lien pour l’instant. Réessaie plus tard ou ajoute l’image à la main.');
      }
      if (root.isConnected) draw();
    };

    const bind = () => {
      root.querySelector('#wquick').addEventListener('submit', (e) => {
        e.preventDefault();
        let url = root.querySelector('#wqurl').value.trim();
        const m = url.match(/https?:\/\/\S+/i); // si on colle un texte qui contient un lien
        if (m) url = m[0];
        if (!safeUrl(url)) { toast('Colle un lien qui commence par https://'); return; }
        const it = { id: uid(), name: '', url, price: 0, priority: 'moyenne', image: '', imageAuto: true, bought: false, created: Date.now() };
        s.items.push(it);
        if (s.filter === 'bought') s.filter = 'todo';
        save('wishlist', s);
        autofill(it);
      });
      root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { s.view = b.dataset.view; save('wishlist', s); draw(); }));
      root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { s.filter = b.dataset.filter; save('wishlist', s); draw(); }));
      root.querySelector('#wsort').addEventListener('change', (e) => { s.sort = e.target.value; save('wishlist', s); draw(); });
      root.querySelector('#wadd').addEventListener('click', addItem);
      root.querySelector('#wadd2').addEventListener('click', addItem);

      root.querySelectorAll('.wrow').forEach((rowEl) => {
        const it = s.items.find((x) => x.id === rowEl.dataset.id);
        rowEl.querySelectorAll('[data-f]').forEach((inp) => {
          const f = inp.dataset.f;
          inp.addEventListener('change', () => {
            if (f === 'bought') { it.bought = inp.checked; if (inp.checked) toast('Acheté 🎉'); }
            else if (f === 'price') { const v = parseNum(inp.value); it.price = v > 0 ? Math.round(v * 100) / 100 : 0; }
            else if (f === 'priority') it.priority = inp.value;
            else it[f] = inp.value.trim();
            if (f === 'image') { openImg = null; it.imageAuto = !it.image; }
            save('wishlist', s);
            if (f === 'url' && it.url) { autofill(it); return; }
            setTimeout(draw, f === 'bought' ? 300 : 0);
          });
          if (inp.tagName === 'INPUT' && inp.type !== 'checkbox') {
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
          }
        });
        rowEl.querySelector('img')?.addEventListener('error', (e) => { e.target.replaceWith(Object.assign(document.createElement('span'), { textContent: '🛍️' })); });
        rowEl.querySelector('[data-act="img"]').addEventListener('click', () => {
          openImg = openImg === it.id ? null : it.id; draw();
          root.querySelector(`[data-id="${it.id}"] [data-f="image"]`)?.focus();
        });
        rowEl.querySelector('[data-act="refetch"]')?.addEventListener('click', () => { openImg = null; autofill(it, { force: true }); });
        const del = rowEl.querySelector('[data-act="del"]');
        del.addEventListener('click', () => confirmClick(del, () => {
          s.items = s.items.filter((x) => x.id !== it.id); save('wishlist', s); draw();
        }));
      });
    };

    draw();
  },
};
