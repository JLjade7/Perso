// Petites fonctions utiles partagées par toutes les rubriques.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const money = (n) => eur.format(Number.isFinite(n) ? n : 0);
export const num = (n, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);

export const parseNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export const pad = (n) => String(n).padStart(2, '0');
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dkey(new Date());
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtDate = (k, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseKey(k).toLocaleDateString('fr-FR', opts);
export const fmtDateTime = (ts) => new Date(ts).toLocaleString('fr-FR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août',
  'sept.', 'oct.', 'nov.', 'déc.'];
export const DAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

// Bouton de suppression en deux temps : 1er clic = "Confirmer ?", 2e clic = action.
export function confirmClick(btn, action) {
  if (btn.dataset.armed) { action(); return; }
  btn.dataset.armed = '1';
  const old = btn.innerHTML;
  btn.innerHTML = 'Confirmer ?';
  btn.classList.add('armed');
  setTimeout(() => {
    if (!btn.isConnected) return;
    delete btn.dataset.armed;
    btn.innerHTML = old;
    btn.classList.remove('armed');
  }, 3000);
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Graphique en barres simple (HTML/CSS), data = [{ label, value, color? }]
export function bars(data, fmt = money) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div class="bars">${data.map((d) => `
    <div class="bar">
      <div class="bar-val">${d.value ? esc(fmt(d.value)) : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="height:${(d.value / max) * 100}%;${d.color ? `background:${d.color}` : ''}"></div></div>
      <div class="bar-label">${esc(d.label)}</div>
    </div>`).join('')}</div>`;
}

export function pageHead(icon, title, subtitle = '', extra = '') {
  return `<header class="page-head">
    <div class="page-icon" aria-hidden="true">${icon}</div>
    <div class="page-title-row"><h1>${esc(title)}</h1>${extra}</div>
    ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
  </header>`;
}
