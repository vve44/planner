// Aufgabenpools (zum Beispiel ein Putzplan): Einträge mit einem Abstand, die als
// Vorschlag im Tagesbereich auftauchen, sobald sie wieder dran sind.
//
// Ein Eintrag sieht so aus:
//   { poolId, titel, dauerMin, intervall: { n: 2, einheit: 'wochen' },
//     modus: 'abErledigung' | 'fest', zuletztErledigtAm, naechsteFaelligkeit }

import * as store from './store.js';
import { heute, plusTage, wochentagNr } from './hilfen.js';
import { naechstesPlandatum, beschreibeRegel } from './regeln.js';

// ---------- Pools ----------

export function pools() {
  return store.liste('pool').sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name, 'de'));
}

export function neuerPool({ name, icon, kategorieId }) {
  const letzter = pools().pop();
  return store.anlegen('pool', { name, icon: icon || 'repeat', kategorieId: kategorieId || null, reihenfolge: letzter ? letzter.reihenfolge + 1 : 1 });
}

// Der Pool eines Eintrags, falls es ihn noch gibt.
export function poolVon(eintrag) {
  const pool = store.hole(eintrag.poolId);
  return pool && !pool.geloeschtAm ? pool : null;
}

// Löscht einen Pool samt Einträgen. Gibt eine Funktion zum Rückgängigmachen zurück.
export function loeschePool(id) {
  const eigene = store.liste('poolEintrag').filter((e) => e.poolId === id);
  eigene.forEach((e) => store.loeschen(e.id));
  store.loeschen(id);
  return () => {
    store.wiederherstellen(id);
    eigene.forEach((e) => store.wiederherstellen(e.id));
  };
}

// ---------- Einträge ----------

export function eintraege(poolId) {
  return store.liste('poolEintrag')
    .filter((e) => e.poolId === poolId)
    .sort((a, b) => (a.naechsteFaelligkeit === b.naechsteFaelligkeit
      ? a.titel.localeCompare(b.titel, 'de')
      : a.naechsteFaelligkeit < b.naechsteFaelligkeit ? -1 : 1));
}

export function neuerEintrag({ poolId, titel, dauerMin, intervall, modus, naechsteFaelligkeit }) {
  return store.anlegen('poolEintrag', {
    poolId,
    titel,
    dauerMin: dauerMin || null,
    intervall,
    modus: modus || 'abErledigung',
    zuletztErledigtAm: null,
    naechsteFaelligkeit: naechsteFaelligkeit || heute(),
  });
}

function regelVon(eintrag) {
  return { art: 'intervall', n: eintrag.intervall.n, einheit: eintrag.intervall.einheit };
}

// "Alle 2 Wochen, ab Erledigung"
export function abstandText(eintrag) {
  return beschreibeRegel(regelVon(eintrag), eintrag.modus);
}

// Ab welchem Tag ein Eintrag als Vorschlag erscheint: ab Montag der Woche, in der
// er fällig wird. Bei Abständen unter einer Woche erst am Fälligkeitstag.
export function sichtbarAb(eintrag) {
  const kurz = eintrag.intervall.einheit === 'tage' && eintrag.intervall.n < 7;
  if (kurz) return eintrag.naechsteFaelligkeit;
  return plusTage(eintrag.naechsteFaelligkeit, -(wochentagNr(eintrag.naechsteFaelligkeit) - 1));
}

// Die offene Aufgabe, die aus diesem Eintrag übernommen wurde (oder null).
export function offeneAufgabeZu(eintrag) {
  return store.liste('aufgabe').find((a) => a.poolEintragId === eintrag.id && !a.erledigtAm) || null;
}

export function stehtAn(eintrag, tag = heute()) {
  return tag >= sichtbarAb(eintrag);
}

// Alle Einträge, die heute als Vorschlag gezeigt werden. Was schon als Aufgabe
// eingeplant ist, taucht nicht noch einmal auf.
export function vorschlaege(tag = heute()) {
  return store.liste('poolEintrag')
    .filter((e) => poolVon(e) && stehtAn(e, tag) && !offeneAufgabeZu(e))
    .sort((a, b) => (a.naechsteFaelligkeit === b.naechsteFaelligkeit
      ? a.titel.localeCompare(b.titel, 'de')
      : a.naechsteFaelligkeit < b.naechsteFaelligkeit ? -1 : 1));
}

// Hakt einen Eintrag ab und berechnet, wann er wieder dran ist.
// Gibt den Stand davor zurück, damit sich das Abhaken zurücknehmen lässt.
export function markiereErledigt(id, tag = heute()) {
  const eintrag = store.hole(id);
  if (!eintrag) return null;
  const vorher = { zuletztErledigtAm: eintrag.zuletztErledigtAm, naechsteFaelligkeit: eintrag.naechsteFaelligkeit };
  store.aendern(id, {
    zuletztErledigtAm: tag,
    naechsteFaelligkeit: naechstesPlandatum(regelVon(eintrag), eintrag.modus, eintrag.naechsteFaelligkeit, tag),
  });
  return vorher;
}

export function setzeZurueck(id, vorher) {
  if (vorher && store.hole(id)) store.aendern(id, vorher);
}
