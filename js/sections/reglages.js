// ⚙️ Réglages : prénom, sauvegarde et restauration des données.
import { load, save, exportAll, importAll, clearAll } from '../store.js';
import { esc, toast, confirmClick, pageHead, today } from '../utils.js';

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

      <section class="card">
        <h2>Mes données</h2>
        <p>Tes données sont enregistrées <b>dans ce navigateur, sur cet appareil</b>. Elles ne partent sur aucun serveur.
        Si tu utilises le site sur ton téléphone et ton ordinateur, chacun a ses propres données.</p>
        <p class="hint">Pour garder une copie ou passer d’un appareil à l’autre : télécharge une sauvegarde ici, puis importe-la sur l’autre appareil.</p>
        <div class="row wrap">
          <button class="btn primary" id="rexp">⬇️ Télécharger une sauvegarde</button>
          <label class="btn">⬆️ Importer une sauvegarde<input type="file" id="rimp" accept=".json,application/json" hidden></label>
          <button class="btn ghost danger-text" id="rclear">Tout effacer</button>
        </div>
      </section>

      <section class="card">
        <h2>Astuce iPhone</h2>
        <p>Pour l’avoir comme une app : ouvre le site dans Safari, touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.</p>
      </section>`;

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
    const clr = root.querySelector('#rclear');
    clr.addEventListener('click', () => confirmClick(clr, () => {
      clearAll(); toast('Toutes les données ont été effacées'); setTimeout(() => location.reload(), 600);
    }));
  },
};
