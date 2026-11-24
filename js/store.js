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

export function importAll(obj) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    localStorage.setItem(PREFIX + k, JSON.stringify(obj[k]));
  }
}

export function clearAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
