// ☁️ Synchronisation en ligne avec Firebase (compte e-mail + mot de passe, base Firestore).
// Les données restent aussi dans le navigateur (localStorage) pour que le site s'ouvre vite
// et fonctionne sans réseau ; chaque modification est envoyée en ligne, et les
// modifications faites sur un autre appareil arrivent ici automatiquement.
import { firebaseConfig } from './firebase-config.js';
import { setSaveHook, getMeta, setMeta, readRaw, writeRaw, localKeys } from './store.js';

const V = '10.12.2';
let fb = null;          // modules Firebase chargés
let auth = null;
let db = null;
let user = null;
let unsub = null;
let onRemote = () => {};
const timers = {};
const listeners = new Set();

export const enabled = () => !!firebaseConfig;
export const currentUser = () => user;
export const status = { state: 'off' }; // off | connecting | synced | pending | error | offline

function setStatus(state) {
  status.state = state;
  listeners.forEach((fn) => fn(state));
}
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function loadFirebase() {
  if (fb) return fb;
  const [app, authMod, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  fb = { ...app, ...authMod, ...fs };
  const a = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(a);
  await fb.setPersistence(auth, fb.browserLocalPersistence);
  db = fb.getFirestore(a);
  return fb;
}

const docRef = (name) => fb.doc(db, 'users', user.uid, 'data', name);

function push(name) {
  if (!user) return;
  setStatus('pending');
  clearTimeout(timers[name]);
  timers[name] = setTimeout(async () => {
    try {
      const raw = readRaw(name);
      if (raw == null) return;
      await fb.setDoc(docRef(name), { value: raw, updated: getMeta()[name] || Date.now() });
      if (!Object.values(timers).some(Boolean)) setStatus('synced');
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      timers[name] = null;
      if (!Object.values(timers).some(Boolean) && status.state === 'pending') setStatus('synced');
    }
  }, 700);
}

// Premier échange après la connexion : on garde la version la plus récente de chaque rubrique
async function initialSync() {
  const snap = await fb.getDocs(fb.collection(db, 'users', user.uid, 'data'));
  const meta = getMeta();
  const remote = new Set();
  let changed = false;
  snap.forEach((d) => {
    remote.add(d.id);
    const { value, updated } = d.data();
    if (!readRaw(d.id) || (updated || 0) > (meta[d.id] || 0)) {
      writeRaw(d.id, value); setMeta(d.id, updated || Date.now()); changed = true;
    } else if ((meta[d.id] || 0) > (updated || 0)) push(d.id);
  });
  // Données déjà présentes sur cet appareil mais pas encore en ligne : on les envoie
  localKeys().filter((k) => !remote.has(k)).forEach(push);
  return changed;
}

function listen() {
  if (unsub) unsub();
  unsub = fb.onSnapshot(fb.collection(db, 'users', user.uid, 'data'), (snap) => {
    let changed = false;
    snap.docChanges().forEach((ch) => {
      if (ch.doc.metadata.hasPendingWrites || ch.type === 'removed') return;
      const { value, updated } = ch.doc.data();
      if ((updated || 0) > (getMeta()[ch.doc.id] || 0) && value !== readRaw(ch.doc.id)) {
        writeRaw(ch.doc.id, value); setMeta(ch.doc.id, updated); changed = true;
      }
    });
    if (changed) onRemote();
    if (!Object.values(timers).some(Boolean)) setStatus('synced');
  }, () => setStatus(navigator.onLine ? 'error' : 'offline'));
}

// Démarre la synchro. Renvoie l'utilisateur connecté, ou null s'il faut se connecter.
export async function start(onRemoteChange) {
  if (!enabled()) return null;
  onRemote = onRemoteChange;
  setStatus('connecting');
  try {
    await loadFirebase();
  } catch (e) {
    setStatus('offline');
    return 'offline';
  }
  return new Promise((resolve) => {
    let first = true;
    fb.onAuthStateChanged(auth, async (u) => {
      user = u;
      if (!u) {
        if (unsub) { unsub(); unsub = null; }
        setSaveHook(null); setStatus('off');
        if (first) { first = false; resolve(null); } else onRemote('signedout');
        return;
      }
      setSaveHook(push);
      try {
        const changed = await initialSync();
        listen();
        setStatus('synced');
        if (!first && changed) onRemote();
      } catch (e) {
        setStatus(navigator.onLine ? 'error' : 'offline');
      }
      if (first) { first = false; resolve(u); } else onRemote('signedin');
    });
  });
}

const ERRORS = {
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/missing-password': 'Indique ton mot de passe.',
  'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : utilise « Se connecter ».',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail : utilise « Créer mon compte ».',
  'auth/too-many-requests': 'Trop d’essais. Attends quelques minutes puis réessaie.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/operation-not-allowed': 'La connexion par e-mail n’est pas activée dans Firebase (Authentication → E-mail/Mot de passe).',
};
export const errorText = (e) => ERRORS[e?.code] || 'Une erreur est survenue. Réessaie.';

export async function signIn(email, password) { await loadFirebase(); return fb.signInWithEmailAndPassword(auth, email, password); }
export async function signUp(email, password) { await loadFirebase(); return fb.createUserWithEmailAndPassword(auth, email, password); }
export async function resetPassword(email) { await loadFirebase(); return fb.sendPasswordResetEmail(auth, email); }
export async function signOut() { if (auth) await fb.signOut(auth); }
