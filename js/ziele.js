// Langfristige Ziele.
//
// Ein Ziel (Typ ziel):
//   { titel, kategorieId, zieldatum: '2027-02-12' | null,
//     projektIds: [], aufgabenIds: [], habitIds: [],   // Verknüpfungen
//     erreichtAm: null | ISO-Zeit }
//
// Der Fortschritt wird nicht gespeichert, sondern berechnet: der Anteil erledigter
// Aufgaben unter den verknüpften Aufgaben und den Aufgaben der verknüpften Projekte
// und Listen. Verknüpfte Habits zeigen daneben ihre Erfüllungsquote.

import * as store from './store.js';
import { heute, jetztIso, tageZwischen, datumKurz, datumAusText } from './hilfen.js';

function vorhanden(id, typ) {
  const d = store.hole(id);
  return d && !d.geloeschtAm && d.typ === typ ? d : null;
}

// Offene Ziele zuerst (nach Zieldatum, ohne Datum zuletzt), dann erreichte.
export function alle() {
  return store.liste('ziel').sort((a, b) => {
    if (Boolean(a.erreichtAm) !== Boolean(b.erreichtAm)) return a.erreichtAm ? 1 : -1;
    if (a.zieldatum !== b.zieldatum) {
      if (!a.zieldatum) return 1;
      if (!b.zieldatum) return -1;
      return a.zieldatum < b.zieldatum ? -1 : 1;
    }
    return a.erstelltAm < b.erstelltAm ? -1 : 1;
  });
}

export function neu(felder) {
  return store.anlegen('ziel', {
    titel: '',
    kategorieId: null,
    zieldatum: null,
    projektIds: [],
    aufgabenIds: [],
    habitIds: [],
    erreichtAm: null,
    ...felder,
  });
}

export function projekteVon(ziel) {
  return (ziel.projektIds || []).map((id) => vorhanden(id, 'projekt')).filter(Boolean);
}

export function habitsVon(ziel) {
  return (ziel.habitIds || []).map((id) => vorhanden(id, 'habit')).filter(Boolean);
}

// Die einzeln verknüpften Aufgaben.
export function einzelAufgaben(ziel) {
  return (ziel.aufgabenIds || []).map((id) => vorhanden(id, 'aufgabe')).filter(Boolean);
}

// Die Aufgaben einer verknüpften Liste.
export function aufgabenImProjekt(projekt) {
  return store.liste('aufgabe').filter((a) => a.projektId === projekt.id);
}

// Alle Aufgaben, die für den Fortschritt zählen (jede nur einmal).
export function aufgabenVon(ziel) {
  const gesehen = new Map();
  einzelAufgaben(ziel).forEach((a) => gesehen.set(a.id, a));
  projekteVon(ziel).forEach((p) => aufgabenImProjekt(p).forEach((a) => gesehen.set(a.id, a)));
  return [...gesehen.values()];
}

// { gesamt, erledigt, anteil (0 bis 1) }
export function fortschritt(ziel) {
  const liste = aufgabenVon(ziel);
  const erledigt = liste.filter((a) => a.erledigtAm).length;
  return { gesamt: liste.length, erledigt, anteil: liste.length ? erledigt / liste.length : 0 };
}

export function setzeErreicht(ziel, erreicht) {
  store.aendern(ziel.id, { erreichtAm: erreicht ? jetztIso() : null });
}

// "bis 12.02.2027, noch 90 Tage" / "bis heute" / "bis 01.11.2026, seit 13 Tagen überfällig"
export function fristText(ziel, tag = heute()) {
  if (!ziel.zieldatum) return '';
  const datum = datumKurz(datumAusText(ziel.zieldatum));
  if (ziel.erreichtAm) return `bis ${datum}`;
  const tage = tageZwischen(tag, ziel.zieldatum);
  if (tage === 0) return 'bis heute';
  if (tage === 1) return `bis ${datum}, noch 1 Tag`;
  if (tage > 1) return `bis ${datum}, noch ${tage} Tage`;
  return `bis ${datum}, seit ${tage === -1 ? '1 Tag' : `${-tage} Tagen`} überfällig`;
}

export function istUeberfaellig(ziel, tag = heute()) {
  return Boolean(ziel.zieldatum) && !ziel.erreichtAm && ziel.zieldatum < tag;
}
