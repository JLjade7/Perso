// Point d'entrée : menu + navigation entre les rubriques + connexion à la synchro.
import { sections } from './sections/index.js';
import { esc, toast } from './utils.js';
import * as cloud from './cloud.js';

const sidebar = document.getElementById('sidebar');
const bottomnav = document.getElementById('bottomnav');
const main = document.getElementById('main');

const STATUS = {
  connecting: ['⏳', 'Connexion…'],
  synced: ['☁️', 'Synchronisé'],
  pending: ['🔄', 'Enregistrement…'],
  offline: ['📴', 'Hors ligne (enregistré sur l’appareil)'],
  error: ['⚠️', 'Synchro en pause'],
};

function currentId() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  return sections.some((s) => s.id === id) ? id : sections[0].id;
}

function syncBadge() {
  const st = STATUS[cloud.status.state];
  return st && cloud.currentUser() ? `<a href="#reglages" class="sync-badge sync-${cloud.status.state}" title="${st[1]}"><span aria-hidden="true">${st[0]}</span><span class="sync-label">${st[1]}</span></a>` : '';
}

function renderNav(active) {
  const item = (s) => `<a href="#${s.id}" class="nav-item${s.id === active ? ' active' : ''}"${s.id === active ? ' aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">${s.icon}</span><span class="nav-label">${esc(s.title)}</span></a>`;
  sidebar.innerHTML = `
    <div class="brand"><span class="brand-icon" aria-hidden="true">✨</span> Mon espace</div>
    <nav class="nav">${sections.filter((s) => !s.footer).map(item).join('')}</nav>
    <div class="nav nav-footer"><div id="sync-slot">${syncBadge()}</div>${sections.filter((s) => s.footer).map(item).join('')}</div>`;
  bottomnav.innerHTML = sections.filter((s) => s.mobile !== false)
    .map((s) => item({ ...s, title: s.short || s.title })).join('');
}

function route() {
  const id = currentId();
  const section = sections.find((s) => s.id === id);
  renderNav(id);
  main.innerHTML = '';
  const page = document.createElement('div');
  page.className = `page page-${id}`;
  main.appendChild(page);
  section.render(page);
  document.title = `${section.title} · Mon espace`;
}

// Écran de connexion (quand la synchro est activée et qu'on n'est pas connecté)
function loginScreen() {
  sidebar.innerHTML = '';
  bottomnav.innerHTML = '';
  document.body.classList.add('is-login');
  main.innerHTML = `
    <div class="page login">
      <div class="login-card card">
        <div class="page-icon" aria-hidden="true">✨</div>
        <h1>Mon espace</h1>
        <p class="muted">Connecte-toi pour retrouver tes données sur tous tes appareils.</p>
        <form id="lf" class="form" autocomplete="on">
          <label class="field"><span>E-mail</span><input id="lemail" type="email" autocomplete="email" required></label>
          <label class="field"><span>Mot de passe</span><input id="lpass" type="password" autocomplete="current-password" minlength="6" required></label>
          <button class="btn primary" value="in">Se connecter</button>
          <button class="btn" value="up">Créer mon compte (la première fois)</button>
          <button type="button" class="btn ghost small" id="lforgot">Mot de passe oublié ?</button>
          <p class="error" id="lerr" role="alert"></p>
        </form>
      </div>
    </div>`;
  const err = main.querySelector('#lerr');
  main.querySelector('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = main.querySelector('#lemail').value.trim();
    const pass = main.querySelector('#lpass').value;
    const btns = main.querySelectorAll('#lf button');
    btns.forEach((b) => { b.disabled = true; });
    err.textContent = '';
    try {
      if (e.submitter?.value === 'up') await cloud.signUp(email, pass);
      else await cloud.signIn(email, pass);
    } catch (ex) {
      err.textContent = cloud.errorText(ex);
      btns.forEach((b) => { b.disabled = false; });
    }
  });
  main.querySelector('#lforgot').addEventListener('click', async () => {
    const email = main.querySelector('#lemail').value.trim();
    if (!email) { err.textContent = 'Écris ton e-mail au-dessus, puis touche « Mot de passe oublié ? ».'; return; }
    try { await cloud.resetPassword(email); toast('E-mail envoyé : regarde ta boîte mail ✉️'); } catch (ex) { err.textContent = cloud.errorText(ex); }
  });
}

// Une modification arrive d'un autre appareil : on réaffiche la page,
// sauf si on est en train d'écrire (on attend alors la fin de la saisie).
let pendingRefresh = false;
function refreshFromRemote(kind) {
  if (kind === 'signedout') { loginScreen(); return; }
  if (kind === 'signedin') { document.body.classList.remove('is-login'); route(); return; }
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && main.contains(a)) {
    if (!pendingRefresh) {
      pendingRefresh = true;
      a.addEventListener('blur', () => { pendingRefresh = false; setTimeout(() => refreshFromRemote(), 300); }, { once: true });
    }
    return;
  }
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => {
  if (document.body.classList.contains('is-login')) return;
  route(); window.scrollTo(0, 0);
});
cloud.onStatus(() => {
  const slot = document.getElementById('sync-slot');
  if (slot) slot.innerHTML = syncBadge();
});

(async () => {
  if (!cloud.enabled()) { route(); return; }
  // Affiche tout de suite les données déjà sur l'appareil, puis se connecte
  route();
  const u = await cloud.start(refreshFromRemote);
  if (u === null) loginScreen();
  else refreshFromRemote();
})();
