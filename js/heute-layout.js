// Aufbau des Tabs „Heute“: Reihenfolge der Bereiche und was ausgeblendet ist.
//
// Gespeichert in der Einstellung "heute.layout" (im Backup):
//   reihenfolge – Liste der Bereiche von oben nach unten
//   aus         – Bereiche, die ausgeblendet sind, bis die Nutzerin sie wieder zeigt
//   ausAm       – je Tag die Bereiche, die nur an diesem Tag ausgeblendet sind
// Die Hinweise zu Installation und Backup stehen immer ganz oben und gehören nicht dazu.

import * as store from './store.js';
import { heute, plusTage } from './hilfen.js';

const EINSTELLUNG = 'heute.layout';

export const BEREICHE = [
  { id: 'level', name: 'Level', icon: 'sprout' },
  { id: 'termine', name: 'Termine', icon: 'calendar' },
  { id: 'habits', name: 'Habits', icon: 'flame' },
  { id: 'tagesroutinen', name: 'Tagesroutinen', icon: 'sunrise' },
  { id: 'ueberfaellig', name: 'Überfällig', icon: 'circle-alert' },
  { id: 'aufgaben', name: 'Aufgaben', icon: 'list-checks' },
  { id: 'vorschlaege', name: 'Vorschläge', icon: 'repeat' },
  { id: 'zyklus', name: 'Zyklus', icon: 'droplet' },
];

const STANDARD = BEREICHE.map((b) => b.id);

export function nameVon(id) {
  const b = BEREICHE.find((x) => x.id === id);
  return b ? b.name : id;
}

function roh() {
  const wert = store.einstellung(EINSTELLUNG, null);
  return wert && typeof wert === 'object' ? wert : {};
}

function speichere(neu) {
  // Tagesweises Ausblenden: alte Tage aufräumen (älter als zwei Wochen)
  const grenze = plusTage(heute(), -14);
  const ausAm = {};
  Object.entries(neu.ausAm || {}).forEach(([tag, ids]) => {
    if (tag >= grenze && ids.length) ausAm[tag] = ids;
  });
  return store.setzeEinstellung(EINSTELLUNG, { reihenfolge: neu.reihenfolge, aus: neu.aus || [], ausAm });
}

// Die Reihenfolge, ergänzt um Bereiche, die es beim Speichern noch nicht gab (an ihrer Standardstelle).
export function reihenfolge() {
  const gespeichert = (roh().reihenfolge || []).filter((id) => STANDARD.includes(id));
  const liste = [...gespeichert];
  STANDARD.forEach((id, i) => {
    if (liste.includes(id)) return;
    const vorher = STANDARD.slice(0, i).reverse().find((v) => liste.includes(v));
    liste.splice(vorher ? liste.indexOf(vorher) + 1 : 0, 0, id);
  });
  return liste;
}

export function istStandard() {
  const r = roh();
  return reihenfolge().join() === STANDARD.join() && !(r.aus || []).length && !Object.keys(r.ausAm || {}).length;
}

// 'dauerhaft', 'tag' oder null
export function ausgeblendet(id, tag = heute()) {
  const r = roh();
  if ((r.aus || []).includes(id)) return 'dauerhaft';
  if (((r.ausAm || {})[tag] || []).includes(id)) return 'tag';
  return null;
}

export function ausgeblendeteAm(tag = heute()) {
  return reihenfolge().filter((id) => ausgeblendet(id, tag));
}

export function setzeReihenfolge(liste) {
  const r = roh();
  return speichere({ ...r, reihenfolge: liste.filter((id) => STANDARD.includes(id)) });
}

// Setzt einen Bereich direkt vor (oder hinter) einen anderen.
export function setzeVor(id, vorId) {
  const liste = reihenfolge().filter((x) => x !== id);
  liste.splice(vorId ? liste.indexOf(vorId) : liste.length, 0, id);
  return setzeReihenfolge(liste);
}

export function setzeHinter(id, hinterId) {
  const liste = reihenfolge().filter((x) => x !== id);
  liste.splice(liste.indexOf(hinterId) + 1, 0, id);
  return setzeReihenfolge(liste);
}

// tag = null: bis auf Weiteres, sonst nur an diesem Tag
export function blendeAus(id, tag = null) {
  const r = roh();
  if (tag) {
    const ausAm = { ...(r.ausAm || {}) };
    ausAm[tag] = [...new Set([...(ausAm[tag] || []), id])];
    return speichere({ ...r, reihenfolge: reihenfolge(), ausAm });
  }
  return speichere({ ...r, reihenfolge: reihenfolge(), aus: [...new Set([...(r.aus || []), id])] });
}

// Zeigt den Bereich wieder: hebt das dauerhafte und das tagesweise Ausblenden für diesen Tag auf.
export function blendeEin(id, tag = heute()) {
  const r = roh();
  const ausAm = { ...(r.ausAm || {}) };
  if (ausAm[tag]) ausAm[tag] = ausAm[tag].filter((x) => x !== id);
  return speichere({ ...r, reihenfolge: reihenfolge(), aus: (r.aus || []).filter((x) => x !== id), ausAm });
}

// Merkt sich den ganzen Stand, damit „Rückgängig“ ihn wiederherstellen kann.
export function sichern() {
  const r = roh();
  return () => store.setzeEinstellung(EINSTELLUNG, Object.keys(r).length ? r : null);
}

export function zuruecksetzen() {
  return store.setzeEinstellung(EINSTELLUNG, null);
}
