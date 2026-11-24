// 📝 Notes : un journal libre pour écrire ce que je pense.
import { load, save } from '../store.js';
import { esc, uid, fmtDateTime, confirmClick, pageHead } from '../utils.js';

export const DEFAULTS = { notes: [] };
export const loadNotes = () => load('notes', DEFAULTS);
const MOODS = ['😄', '🙂', '😐', '😔', '😡', '🥰'];

let currentId = null;
let query = '';

export default {
  id: 'notes',
  title: 'Notes',
  icon: '📝',
  render(root) {
    const s = loadNotes();
    const sorted = () => [...s.notes].sort((a, b) => b.updated - a.updated);
    const current = () => s.notes.find((n) => n.id === currentId);
    if (currentId && !current()) currentId = null;

    const snippet = (n) => (n.body || '').replace(/\s+/g, ' ').slice(0, 90);
    const matches = (n) => !query || `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase());

    const listHTML = () => {
      const items = sorted().filter(matches);
      if (!s.notes.length) return '<p class="empty">Pas encore de note. Clique sur « Nouvelle » pour commencer ✍️</p>';
      if (!items.length) return '<p class="empty">Aucun résultat.</p>';
      return items.map((n) => `
        <button class="nitem${n.id === currentId ? ' on' : ''}" data-open="${n.id}">
          <div class="nitem-title">${n.mood ? n.mood + ' ' : ''}${esc(n.title) || '<span class="muted">Sans titre</span>'}</div>
          <div class="nitem-snip">${esc(snippet(n)) || '&nbsp;'}</div>
          <div class="nitem-date">${fmtDateTime(n.updated)}</div>
        </button>`).join('');
    };

    const editorHTML = () => {
      const n = current();
      if (!n) return '<div class="empty editor-empty">Choisis une note ou crée-en une nouvelle.</div>';
      return `
        <div class="editor-bar">
          <button class="btn ghost back" data-back>‹ Notes</button>
          <span class="muted small">Créée le ${fmtDateTime(n.created)} · enregistré automatiquement</span>
          <button class="icon-btn" data-delnote aria-label="Supprimer la note">🗑</button>
        </div>
        <input class="note-title" data-f="title" placeholder="Sans titre" value="${esc(n.title)}">
        <div class="moods" aria-label="Humeur">${MOODS.map((m) => `<button class="mood${n.mood === m ? ' on' : ''}" data-mood="${m}" aria-label="Humeur ${m}">${m}</button>`).join('')}</div>
        <textarea class="note-body" data-f="body" placeholder="Écris ce que tu penses…">${esc(n.body)}</textarea>`;
    };

    const draw = () => {
      root.innerHTML = `
        ${pageHead('📝', 'Notes', 'Un espace libre pour écrire ce que tu penses.')}
        <div class="notes${currentId ? ' editing' : ''}">
          <aside class="notes-side">
            <div class="row">
              <input type="search" class="grow" id="nq" placeholder="🔍 Rechercher…" value="${esc(query)}">
              <button class="btn primary" id="nnew">＋ Nouvelle</button>
            </div>
            <div class="nlist">${listHTML()}</div>
          </aside>
          <section class="note-editor card">${editorHTML()}</section>
        </div>`;
      bind();
      autosize();
    };

    const refreshList = () => {
      root.querySelector('.nlist').innerHTML = listHTML();
      bindList();
    };

    const autosize = () => {
      const ta = root.querySelector('.note-body');
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.max(260, ta.scrollHeight) + 'px';
    };

    const bindList = () => {
      root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
        currentId = b.dataset.open; draw();
      }));
    };

    const bind = () => {
      bindList();
      root.querySelector('#nq').addEventListener('input', (e) => { query = e.target.value; refreshList(); });
      root.querySelector('#nnew').addEventListener('click', () => {
        const n = { id: uid(), title: '', body: '', mood: '', created: Date.now(), updated: Date.now() };
        s.notes.push(n); save('notes', s);
        currentId = n.id; query = '';
        draw();
        root.querySelector('.note-title')?.focus();
      });
      const n = current();
      if (!n) return;
      root.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => {
        n[inp.dataset.f] = inp.value;
        n.updated = Date.now();
        save('notes', s);
        if (inp.dataset.f === 'body') autosize();
        refreshList();
      }));
      root.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => {
        n.mood = n.mood === b.dataset.mood ? '' : b.dataset.mood;
        n.updated = Date.now(); save('notes', s); draw();
      }));
      root.querySelector('[data-back]').addEventListener('click', () => { currentId = null; draw(); });
      const del = root.querySelector('[data-delnote]');
      del.addEventListener('click', () => confirmClick(del, () => {
        s.notes = s.notes.filter((x) => x.id !== n.id);
        save('notes', s); currentId = null; draw();
      }));
    };

    draw();
  },
};
