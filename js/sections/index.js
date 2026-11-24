// Liste des rubriques du site, dans l'ordre du menu.
// Pour ajouter une rubrique : créer un fichier dans ce dossier (copier notes.js
// par exemple), puis l'importer et l'ajouter dans la liste ci-dessous.
//
// Chaque rubrique est un objet :
//   { id, title, icon, short?, mobile?, footer?, render(element) }
//   - short  : nom court pour la barre du bas sur téléphone
//   - mobile : false pour ne pas l'afficher dans la barre du bas
//   - footer : true pour la mettre en bas du menu ordinateur

import accueil from './accueil.js';
import tirelire from './tirelire.js';
import voiture from './voiture.js';
import notes from './notes.js';
import wishlist from './wishlist.js';
import reglages from './reglages.js';

export const sections = [accueil, tirelire, voiture, notes, wishlist, reglages];
