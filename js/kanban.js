// Kanban: das Board eines Projekts oder einer Liste.
//
// Die Spalten stehen im Projekt:
//   kanbanSpalten: [{ id, name, erledigt }]   – Reihenfolge wie in der Liste, genau eine ist die Erledigt-Spalte
// Die Aufgabe merkt sich ihre Spalte und ihren Platz darin:
//   kanbanSpalteId, kanbanRang
//
// Regeln:
//   - Eine erledigte Aufgabe steht immer in der Erledigt-Spalte, egal von wo sie abgehakt wurde.
//     Ihre bisherige Spalte bleibt gemerkt: Wird das Häkchen zurückgenommen, steht sie wieder dort.
//   - Eine offene Aufgabe ohne (gültige) Spalte steht in der ersten offenen Spalte.
//   - Ändern sich die Spalten (neu, verschoben, gelöscht), bleibt jede Karte, wo sie ist.
//   - Eine Karte in die Erledigt-Spalte zu ziehen hakt die Aufgabe ab. Sie herauszuziehen öffnet sie wieder.

import * as store from './store.js';
import * as aufgaben from './aufgaben.js';
import { neueId } from './hilfen.js';

const STANDARD = [
  { name: 'Offen', erledigt: false },
  { name: 'In Arbeit', erledigt: false },
  { name: 'Erledigt', erledigt: true },
];

function gueltig(liste) {
  return Array.isArray(liste) && liste.length >= 2
    && liste.filter((s) => s.erledigt).length === 1 && liste.some((s) => !s.erledigt);
}

// Die Spalten eines Projekts. Solange noch keine angelegt sind, die drei Standardspalten
// (mit festen IDs, damit sie beim ersten Speichern dieselben bleiben).
export function spalten(projekt) {
  if (gueltig(projekt.kanbanSpalten)) return projekt.kanbanSpalten;
  return STANDARD.map((s, i) => ({ ...s, id: `${projekt.id}-s${i + 1}` }));
}

function speichere(projekt, liste) {
  return store.aendern(projekt.id, { kanbanSpalten: liste });
}

export function erledigtSpalte(projekt) {
  return spalten(projekt).find((s) => s.erledigt);
}

export function offeneSpalten(projekt) {
  return spalten(projekt).filter((s) => !s.erledigt);
}

// In welcher Spalte eine Aufgabe steht.
export function spalteVon(aufgabe, projekt) {
  if (aufgabe.erledigtAm) return erledigtSpalte(projekt).id;
  const offene = offeneSpalten(projekt);
  return offene.some((s) => s.id === aufgabe.kanbanSpalteId) ? aufgabe.kanbanSpalteId : offene[0].id;
}

function sortiereOffene(liste) {
  // Erst nach dem von Hand gesetzten Platz, sonst wie in der Liste (Datum, Priorität).
  const nachListe = aufgaben.sortiere(liste);
  return nachListe
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const rx = typeof x.a.kanbanRang === 'number' ? x.a.kanbanRang : Infinity;
      const ry = typeof y.a.kanbanRang === 'number' ? y.a.kanbanRang : Infinity;
      if (rx !== ry) return rx - ry;
      return x.i - y.i;
    })
    .map((x) => x.a);
}

// Alle Karten eines Projekts, nach Spalte: Map von Spalten-ID auf die sortierten Aufgaben.
export function karten(projekt) {
  const eigene = aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id);
  const jeSpalte = new Map(spalten(projekt).map((s) => [s.id, []]));
  eigene.forEach((a) => jeSpalte.get(spalteVon(a, projekt)).push(a));
  spalten(projekt).forEach((s) => {
    jeSpalte.set(s.id, s.erledigt ? aufgaben.sortiereErledigte(jeSpalte.get(s.id)) : sortiereOffene(jeSpalte.get(s.id)));
  });
  return jeSpalte;
}

// Verschiebt eine Karte in eine Spalte, an die Stelle "index" (gezählt ohne die Karte selbst).
// Ohne index kommt sie ans Ende.
export function verschiebe(aufgabeId, projekt, zielSpalteId, index = null) {
  const aufgabe = store.hole(aufgabeId);
  const ziel = spalten(projekt).find((s) => s.id === zielSpalteId);
  if (!aufgabe || !ziel) return;
  if (ziel.erledigt) {
    aufgaben.erledige(aufgabeId);
    return;
  }
  if (aufgabe.erledigtAm) aufgaben.oeffneWieder(aufgabeId);
  const reihe = karten(projekt).get(zielSpalteId).filter((a) => a.id !== aufgabeId);
  const stelle = index === null ? reihe.length : Math.max(0, Math.min(reihe.length, index));
  reihe.splice(stelle, 0, store.hole(aufgabeId));
  reihe.forEach((a, i) => {
    const felder = {};
    if (a.kanbanRang !== i + 1) felder.kanbanRang = i + 1;
    if (a.id === aufgabeId && a.kanbanSpalteId !== zielSpalteId) felder.kanbanSpalteId = zielSpalteId;
    if (Object.keys(felder).length) store.aendern(a.id, felder);
  });
}

// ---------- Spalten verwalten ----------

// Schreibt jeder Karte ihre jetzige Spalte fest ein, bevor sich die Spalten ändern.
// Sonst würden Karten, die noch nie verschoben wurden, in eine neue erste Spalte mitwandern.
function verankere(projekt) {
  const offene = offeneSpalten(projekt);
  aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id).forEach((a) => {
    if (!offene.some((s) => s.id === a.kanbanSpalteId)) store.aendern(a.id, { kanbanSpalteId: offene[0].id });
  });
}

export function neueSpalte(projekt, name) {
  verankere(projekt);
  const liste = [...spalten(projekt)];
  // Neue Spalten kommen vor die Erledigt-Spalte, wenn diese ganz rechts steht, sonst ans Ende.
  const neu = { id: neueId(), name, erledigt: false };
  if (liste[liste.length - 1].erledigt) liste.splice(liste.length - 1, 0, neu);
  else liste.push(neu);
  speichere(projekt, liste);
  return neu;
}

export function benenneUm(projekt, spalteId, name) {
  speichere(projekt, spalten(projekt).map((s) => (s.id === spalteId ? { ...s, name } : s)));
}

// um: -1 nach links, +1 nach rechts
export function verschiebeSpalte(projekt, spalteId, um) {
  const liste = [...spalten(projekt)];
  const von = liste.findIndex((s) => s.id === spalteId);
  const nach = von + um;
  if (von < 0 || nach < 0 || nach >= liste.length) return;
  verankere(projekt);
  const [spalte] = liste.splice(von, 1);
  liste.splice(nach, 0, spalte);
  speichere(projekt, liste);
}

// Legt fest, welche Spalte die Erledigt-Spalte ist.
export function setzeErledigtSpalte(projekt, spalteId) {
  if (!spalten(projekt).some((s) => s.id === spalteId)) return;
  verankere(projekt);
  speichere(projekt, spalten(projekt).map((s) => ({ ...s, erledigt: s.id === spalteId })));
}

// Ob sich eine Spalte löschen lässt: nicht die Erledigt-Spalte und nicht die letzte offene.
export function loeschbar(projekt, spalteId) {
  const spalte = spalten(projekt).find((s) => s.id === spalteId);
  return Boolean(spalte) && !spalte.erledigt && offeneSpalten(projekt).length > 1;
}

// Löscht eine Spalte. Ihre Karten stehen danach in der ersten offenen Spalte.
// Gibt eine Funktion zum Rückgängigmachen zurück.
export function loescheSpalte(projekt, spalteId) {
  if (!loeschbar(projekt, spalteId)) return null;
  verankere(projekt);
  const vorher = spalten(projekt);
  const betroffen = aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id && a.kanbanSpalteId === spalteId).map((a) => a.id);
  const ziel = vorher.find((s) => !s.erledigt && s.id !== spalteId).id;
  speichere(projekt, vorher.filter((s) => s.id !== spalteId));
  betroffen.forEach((id) => store.aendern(id, { kanbanSpalteId: ziel }));
  return () => {
    speichere(store.hole(projekt.id), vorher);
    betroffen.forEach((id) => { if (store.hole(id)) store.aendern(id, { kanbanSpalteId: spalteId }); });
  };
}

// Ansicht eines Projekts: 'liste' oder 'board'. Die Merkliste hat kein Board.
export function ansichtVon(projekt) {
  return !projekt.istMerkliste && projekt.ansicht === 'board' ? 'board' : 'liste';
}
