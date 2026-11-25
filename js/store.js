// Sauvegarde des données dans le navigateur (localStorage).
// Chaque rubrique a sa propre clé : "perso:tirelire", "perso:voiture", etc.
import { toast } from './utils.js';

const PREFIX = 'perso:';

export function load(name, defaults) {
  const base = structuredClone(defaults);
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch (e) { /* données illisibles : on repart des valeurs par défaut */ }
  return base;
}

export function save(name, value) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
    return true;
  } catch (e) {
    toast("Impossible d'enregistrer (stockage plein ou bloqué)");
    return false;
  }
}

export function exportAll() {
  const out = { _app: 'mon-espace', _version: 1, _date: new Date().toISOString() };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
    }
  } catch (e) { /* ignore */ }
  return out;
}

// Importe une sauvegarde en la FUSIONNANT avec ce qui existe déjà :
// les listes (versements, pleins, notes, articles, groupes) sont réunies sans doublon.
export function importAll(obj) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem(PREFIX + k)); } catch (e) { cur = null; }
    const inc = obj[k];
    let out = inc;
    if (cur && typeof cur === 'object' && inc && typeof inc === 'object' && !Array.isArray(inc)) {
      out = { ...cur, ...inc };
      for (const f of Object.keys(inc)) {
        if (Array.isArray(inc[f]) && Array.isArray(cur[f])) {
          const ids = new Set(inc[f].map((x) => x && x.id));
          out[f] = [...cur[f].filter((x) => !(x && ids.has(x.id))), ...inc[f]];
        }
      }
    }
    localStorage.setItem(PREFIX + k, JSON.stringify(out));
  }
}

// Code texte à copier-coller pour transférer ses données d'un endroit à l'autre
export function exportCode() {
  const json = JSON.stringify(exportAll());
  return 'MONESPACE:' + btoa(unescape(encodeURIComponent(json)));
}
export function importCode(text) {
  const m = String(text).match(/MONESPACE:([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error('code');
  const data = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  if (data._app !== 'mon-espace') throw new Error('format');
  importAll(data);
}

export function clearAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
