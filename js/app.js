// Point d'entrée : menu + navigation entre les rubriques.
import { sections } from './sections/index.js';
import { esc } from './utils.js';

const sidebar = document.getElementById('sidebar');
const bottomnav = document.getElementById('bottomnav');
const main = document.getElementById('main');

function currentId() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  return sections.some((s) => s.id === id) ? id : sections[0].id;
}

function renderNav(active) {
  const item = (s) => `<a href="#/${s.id}" class="nav-item${s.id === active ? ' active' : ''}"${s.id === active ? ' aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">${s.icon}</span><span class="nav-label">${esc(s.title)}</span></a>`;
  sidebar.innerHTML = `
    <div class="brand"><span class="brand-icon" aria-hidden="true">✨</span> Mon espace</div>
    <nav class="nav">${sections.filter((s) => !s.footer).map(item).join('')}</nav>
    <div class="nav nav-footer">${sections.filter((s) => s.footer).map(item).join('')}</div>`;
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
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
