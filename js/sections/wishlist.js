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

export const DEFAULTS = { items: [], groups: [], group: '', filter: 'todo', sort: 'priority', view: 'gallery' };
export const loadWish = () => load('wishlist', DEFAULTS);

let openImg = null;
let newGroupOpen = false;
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

    // Groupe affiché : '' = tout, '_none' = sans groupe, sinon l'id du groupe
    const inGroup = (i) => !s.group ? true : s.group === '_none' ? !i.group : i.group === s.group;
    const currentGroup = () => s.groups.find((g) => g.id === s.group);
    if (s.group && s.group !== '_none' && !currentGroup()) s.group = '';

    const draw = (focusId) => {
      const scope = s.items.filter(inGroup);
      const items = scope.filter((i) => s.filter === 'all' ? true : s.filter === 'bought' ? i.bought : !i.bought);
      const sorters = {
        priority: (a, b) => (PRI_ORDER[a.priority] ?? 1) - (PRI_ORDER[b.priority] ?? 1) || b.created - a.created,
        priceAsc: (a, b) => (a.price || 0) - (b.price || 0),
        priceDesc: (a, b) => (b.price || 0) - (a.price || 0),
        recent: (a, b) => b.created - a.created,
      };
      items.sort(sorters[s.sort] || sorters.priority);

      const totalAll = scope.reduce((a, i) => a + (i.price || 0), 0);
      const totalTodo = scope.filter((i) => !i.bought).reduce((a, i) => a + (i.price || 0), 0);
      const g = currentGroup();
      const groupTotal = (id) => s.items.filter((i) => (id === '_none' ? !i.group : i.group === id) && !i.bought).reduce((a, i) => a + (i.price || 0), 0);
      const groupCount = (id) => s.items.filter((i) => id === '_none' ? !i.group : i.group === id).length;
      const groupSelect = (i) => s.groups.length ? `<select class="wgroup-sel" data-f="group" aria-label="Groupe">
              <option value="">📁 Aucun groupe</option>
              ${s.groups.map((gr) => `<option value="${gr.id}"${gr.id === i.group ? ' selected' : ''}>📁 ${esc(gr.name)}</option>`).join('')}
            </select>` : '';
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
            ${groupSelect(i)}
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
          <div class="stat"><div class="stat-label">Reste à acheter</div><div class="stat-value">${money(totalTodo)}</div><div class="stat-sub">${scope.filter((i) => !i.bought).length} article(s)${g ? ' · ' + esc(g.name) : ''}</div></div>
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

        <section class="card wgroups">
          <h2>Mes groupes</h2>
          <div class="gchips" role="tablist" aria-label="Groupes">
            <button class="gchip${!s.group ? ' on' : ''}" data-group="">✨ Tout <span>${s.items.length}</span></button>
            ${s.groups.map((gr) => `<button class="gchip${s.group === gr.id ? ' on' : ''}" data-group="${gr.id}">📁 ${esc(gr.name)} <span>${groupCount(gr.id)} · ${money(groupTotal(gr.id))}</span></button>`).join('')}
            ${s.groups.length && groupCount('_none') ? `<button class="gchip${s.group === '_none' ? ' on' : ''}" data-group="_none">Sans groupe <span>${groupCount('_none')}</span></button>` : ''}
            ${newGroupOpen ? '' : '<button class="gchip gadd" id="gnew">＋ Nouveau groupe</button>'}
          </div>
          ${newGroupOpen ? `<form id="gform" class="row gform" autocomplete="off">
            <input id="gname" class="grow" placeholder="Nom du groupe, ex. Cadeau maman 🎁" maxlength="40">
            <button class="btn primary">Créer</button>
            <button type="button" class="btn ghost" id="gcancel">Annuler</button>
          </form>` : ''}
          ${!s.groups.length && !newGroupOpen ? '<p class="hint">Crée des groupes pour ranger tes articles, par exemple « Cadeau maman » ou « Noël ». Chaque groupe affiche son total.</p>' : ''}
          ${g ? `<div class="gedit">
            <label class="field grow"><span>Nom du groupe</span><input id="grename" value="${esc(g.name)}" maxlength="40"></label>
            <button class="btn ghost danger-text" id="gdel">Supprimer le groupe</button>
          </div>
          <p class="hint">Les articles ajoutés maintenant vont directement dans « ${esc(g.name)} ». Supprimer le groupe garde ses articles dans la liste.</p>` : ''}
        </section>

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
            ${items.map(row).join('') || `<p class="empty">${s.items.length ? (g && !scope.length ? 'Ce groupe est vide. Ajoute un article avec son lien, ou choisis « 📁 ' + esc(g.name) + ' » sur un article existant.' : 'Rien dans ce filtre.') : 'Ta wish list est vide. Clique sur « Nouveau » pour ajouter ton premier article ✨'}</p>`}
          </div>
          <button class="wnew" id="wadd2">＋ Nouvel article</button>
        </section>`;

      bind();
      if (focusId) root.querySelector(`[data-id="${focusId}"] [data-f="name"]`)?.focus();
    };

    const addItem = () => {
      const it = { id: uid(), name: '', url: '', price: 0, priority: 'moyenne', image: '', bought: false, group: currentGroup()?.id || '', created: Date.now() };
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
        const it = { id: uid(), name: '', url, price: 0, priority: 'moyenne', image: '', imageAuto: true, bought: false, group: currentGroup()?.id || '', created: Date.now() };
        s.items.push(it);
        if (s.filter === 'bought') s.filter = 'todo';
        save('wishlist', s);
        autofill(it);
      });
      root.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => { s.group = b.dataset.group; save('wishlist', s); draw(); }));
      root.querySelector('#gnew')?.addEventListener('click', () => { newGroupOpen = true; draw(); root.querySelector('#gname')?.focus(); });
      root.querySelector('#gcancel')?.addEventListener('click', () => { newGroupOpen = false; draw(); });
      root.querySelector('#gform')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = root.querySelector('#gname').value.trim();
        if (!name) { toast('Donne un nom à ton groupe'); return; }
        const gr = { id: uid(), name, created: Date.now() };
        s.groups.push(gr); s.group = gr.id; newGroupOpen = false;
        save('wishlist', s); toast(`Groupe « ${name} » créé ✔`); draw();
      });
      root.querySelector('#grename')?.addEventListener('change', (e) => {
        const gr = currentGroup(); const name = e.target.value.trim();
        if (gr && name) { gr.name = name; save('wishlist', s); draw(); }
      });
      const gdel = root.querySelector('#gdel');
      gdel?.addEventListener('click', () => confirmClick(gdel, () => {
        const id = s.group;
        s.items.forEach((i) => { if (i.group === id) i.group = ''; });
        s.groups = s.groups.filter((gr) => gr.id !== id); s.group = '';
        save('wishlist', s); toast('Groupe supprimé'); draw();
      }));
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
            else if (f === 'group') { it.group = inp.value; const gr = s.groups.find((x) => x.id === it.group); toast(gr ? `Rangé dans « ${gr.name} »` : 'Retiré du groupe'); }
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
