// ⚙️ Réglages : prénom, sauvegarde et restauration des données.
import { load, save, exportAll, importAll, clearAll, exportCode, importCode } from '../store.js';
import { esc, toast, confirmClick, pageHead, today } from '../utils.js';
import * as cloud from '../cloud.js';

export default {
  id: 'reglages',
  title: 'Réglages',
  icon: '⚙️',
  mobile: false,
  footer: true,
  render(root) {
    const s = load('reglages', { name: '' });
    root.innerHTML = `
      ${pageHead('⚙️', 'Réglages')}
      <section class="card">
        <h2>Moi</h2>
        <label class="field"><span>Mon prénom (affiché sur l’accueil)</span><input id="rname" value="${esc(s.name)}" placeholder="Ton prénom"></label>
      </section>

      ${cloud.currentUser() ? `<section class="card">
        <h2>☁️ Synchronisation</h2>
        <p>Connectée avec <b>${esc(cloud.currentUser().email)}</b>. Tout ce que tu ajoutes est enregistré en ligne et apparaît automatiquement sur tes autres appareils.</p>
        <p class="hint">Sur un nouvel appareil, ouvre le site et connecte-toi avec le même e-mail et mot de passe.</p>
        <div class="row wrap"><button class="btn" id="rlogout">Se déconnecter de cet appareil</button></div>
      </section>` : ''}

      <section class="card">
        <h2>🔄 Transférer mes données</h2>
        <p>Pour retrouver tes données ailleurs (aperçu Claude → vrai site, ordinateur → téléphone…) :</p>
        <ol class="steps">
          <li>Là où sont tes données, touche <b>Copier mes données</b>.</li>
          <li>Sur l’autre site ou appareil, ouvre <b>Réglages</b>, colle dans la case et touche <b>Importer</b>.</li>
        </ol>
        <div class="row wrap">
          <button class="btn primary" id="rcopy">📋 Copier mes données</button>
        </div>
        <textarea id="rcode" class="code-box" rows="3" placeholder="Colle ici le code copié (il commence par MONESPACE:)"></textarea>
        <div class="row wrap"><button class="btn" id="rpaste">⬆️ Importer</button></div>
        <p class="hint">L’import ajoute les données à celles déjà présentes, rien n’est effacé.</p>
      </section>

      <section class="card">
        <h2>Mes données</h2>
        <p>${cloud.currentUser() ? 'Tes données sont enregistrées en ligne dans ton espace Firebase, et gardées aussi sur cet appareil pour s’ouvrir vite.' : 'Tes données sont enregistrées <b>dans ce navigateur, sur cet appareil</b>. Si tu utilises le site sur ton téléphone et ton ordinateur, chacun a ses propres données.'}</p>
        <p class="hint">Pour garder une copie ou passer d’un appareil à l’autre : télécharge une sauvegarde ici, puis importe-la sur l’autre appareil.</p>
        <div class="row wrap">
          <button class="btn primary" id="rexp">⬇️ Télécharger une sauvegarde</button>
          <label class="btn">⬆️ Importer une sauvegarde<input type="file" id="rimp" accept=".json,application/json" hidden></label>
          ${cloud.currentUser() ? '' : '<button class="btn ghost danger-text" id="rclear">Tout effacer</button>'}
        </div>
      </section>

      <section class="card">
        <h2>Astuce iPhone</h2>
        <p>Pour l’avoir comme une app : ouvre le site dans Safari, touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.</p>
      </section>`;

    const codeBox = root.querySelector('#rcode');
    root.querySelector('#rcopy').addEventListener('click', () => {
      const code = exportCode();
      codeBox.value = code;
      const fallback = () => { codeBox.focus(); codeBox.select(); toast('Le code est sélectionné : fais Copier (Ctrl + C)'); };
      try {
        navigator.clipboard.writeText(code).then(() => toast('Données copiées ✔ Colle-les dans Réglages sur l’autre site'), fallback);
      } catch (e) { fallback(); }
    });
    root.querySelector('#rpaste').addEventListener('click', () => {
      try {
        importCode(codeBox.value);
        toast('Données importées ✔');
        setTimeout(() => { location.hash = '#accueil'; location.reload(); }, 700);
      } catch (e) { toast('Ce code n’est pas valide. Recopie-le en entier.'); }
    });
    root.querySelector('#rname').addEventListener('input', (e) => { s.name = e.target.value.trim(); save('reglages', s); });
    root.querySelector('#rexp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mon-espace-sauvegarde-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Sauvegarde téléchargée ✔');
    });
    root.querySelector('#rimp').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data._app !== 'mon-espace') throw new Error('format');
        importAll(data);
        toast('Sauvegarde importée ✔');
        setTimeout(() => location.reload(), 600);
      } catch { toast('Ce fichier n’est pas une sauvegarde valide'); }
    });
    root.querySelector('#rlogout')?.addEventListener('click', async () => { await cloud.signOut(); });
    const clr = root.querySelector('#rclear');
    clr?.addEventListener('click', () => confirmClick(clr, () => {
      clearAll(); toast('Toutes les données ont été effacées'); setTimeout(() => location.reload(), 600);
    }));
  },
};
