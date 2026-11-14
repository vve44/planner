// Alles, was mit Aufgaben, Listen und Wiederholungen passiert:
// anlegen, ändern, abhaken, verschieben, löschen. Die Ansichten rufen nur diese Funktionen auf.

import * as store from './store.js';
import { neueId, jetztIso, heute, plusTage, tageZwischen, datumLokal } from './hilfen.js';
import { naechstesPlandatum } from './regeln.js';
import * as pools from './pools.js';

// ---------- Listen und Projekte ----------

export function merkliste() {
  return store.liste('projekt').find((p) => p.istMerkliste) || null;
}

// Die Merkliste gibt es immer genau einmal. Sie wird beim Start angelegt, falls sie fehlt.
export function sicherstelleMerkliste() {
  if (!merkliste()) {
    store.anlegen('projekt', { name: 'Merkliste', kategorieId: null, icon: 'bookmark', istMerkliste: true, reihenfolge: 0 });
  }
}

// Alle Projekte und Listen ohne die Merkliste.
export function projekte() {
  return store.liste('projekt')
    .filter((p) => !p.istMerkliste)
    .sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name, 'de'));
}

export function neuesProjekt(felder) {
  const letzte = projekte().pop();
  return store.anlegen('projekt', {
    name: felder.name,
    kategorieId: felder.kategorieId || null,
    icon: felder.icon || 'list',
    istMerkliste: false,
    kanbanSpalten: [],
    reihenfolge: letzte ? letzte.reihenfolge + 1 : 1,
  });
}

// Löscht ein Projekt. Die Aufgaben darin wandern mit in den Papierkorb oder bleiben ohne Liste erhalten.
// Gibt eine Funktion zurück, die alles rückgängig macht.
export function loescheProjekt(id, { mitAufgaben }) {
  const betroffene = store.liste('aufgabe').filter((a) => a.projektId === id);
  betroffene.forEach((a) => {
    if (mitAufgaben) store.loeschen(a.id);
    else store.aendern(a.id, { projektId: null });
  });
  store.loeschen(id);
  return () => {
    store.wiederherstellen(id);
    betroffene.forEach((a) => {
      if (mitAufgaben) store.wiederherstellen(a.id);
      else store.aendern(a.id, { projektId: id });
    });
  };
}

// Gibt die Kategorie eines Eintrags zurück, falls sie noch existiert.
function vorhandeneKategorie(id) {
  const k = id ? store.hole(id) : null;
  return k && !k.geloeschtAm ? k : null;
}

function vorhandenesProjekt(id) {
  const p = id ? store.hole(id) : null;
  return p && !p.geloeschtAm ? p : null;
}

export function projektVon(aufgabe) {
  return vorhandenesProjekt(aufgabe.projektId);
}

// Kategorie einer Aufgabe: die eigene, sonst die ihrer Liste.
export function kategorieVon(aufgabe) {
  const eigene = vorhandeneKategorie(aufgabe.kategorieId);
  if (eigene) return eigene;
  const projekt = projektVon(aufgabe);
  return projekt ? vorhandeneKategorie(projekt.kategorieId) : null;
}

// ---------- Aufgaben: Grundform ----------

export function leereAufgabe(vorgaben = {}) {
  return {
    titel: '',
    dauerMin: null,      // nur Blocklänge im Kalender
    plandatum: null,     // "Wann mache ich es"
    startzeit: null,     // kommt mit dem Kalender (Etappe 4)
    deadline: null,      // Fälligkeit, unabhängig vom Plandatum
    prioritaet: 0,       // 0 keine, 1 niedrig, 2 mittel, 3 hoch
    kategorieId: null,
    projektId: null,
    kanbanSpalteId: null, // kommt mit Kanban (Etappe 8)
    icon: null,
    notiz: '',
    checkliste: [],      // einfache Abhakliste in der Notiz
    unteraufgaben: [],   // Teilaufgaben
    erledigtAm: null,
    serieId: null,       // gehört zu einer Wiederholung
    vorgaengerId: null,  // aus welcher Aufgabe der Wiederholung sie entstanden ist
    routineId: null,     // aus welcher Routine sie übernommen wurde
    poolEintragId: null, // aus welchem Pool-Eintrag (Vorschlag) sie entstanden ist
    poolVorher: null,    // Stand des Pool-Eintrags vor dem Abhaken (zum Zurücknehmen)
    ...vorgaben,
  };
}

export function neuerPunkt(text) {
  return { id: neueId(), text, erledigt: false };
}

// Die laufende Wiederholung einer Aufgabe (oder null).
export function serieVon(aufgabe) {
  const serie = aufgabe.serieId ? store.hole(aufgabe.serieId) : null;
  return serie && !serie.beendetAm && !serie.geloeschtAm ? serie : null;
}

// wiederholung: null = keine, sonst { regel, modus }
export function neueAufgabe(felder, wiederholung) {
  let serieId = null;
  if (wiederholung) {
    serieId = store.anlegen('serie', { regel: wiederholung.regel, modus: wiederholung.modus, beendetAm: null }).id;
  }
  return store.anlegen('aufgabe', { ...leereAufgabe(), ...felder, serieId });
}

// wiederholung: undefined = unverändert, null = Wiederholung beenden, sonst { regel, modus }
export function aendereAufgabe(id, felder, wiederholung) {
  const aufgabe = store.hole(id);
  if (!aufgabe) return null;
  let serieId = aufgabe.serieId;
  const serie = serieVon(aufgabe);
  if (wiederholung === null) {
    if (serie) store.aendern(serie.id, { beendetAm: jetztIso() });
    serieId = null;
  } else if (wiederholung) {
    if (serie) store.aendern(serie.id, { regel: wiederholung.regel, modus: wiederholung.modus });
    else serieId = store.anlegen('serie', { regel: wiederholung.regel, modus: wiederholung.modus, beendetAm: null }).id;
  }
  return store.aendern(id, { ...felder, serieId });
}

// ---------- Abhaken ----------

// Erzeugt die nächste Aufgabe einer Wiederholung: gleiche Angaben, frische Häkchen, neues Plandatum.
function erzeugeNachfolger(aufgabe, serie) {
  const plandatum = naechstesPlandatum(serie.regel, serie.modus, aufgabe.plandatum, heute());
  const abstand = aufgabe.deadline && aufgabe.plandatum ? tageZwischen(aufgabe.plandatum, aufgabe.deadline) : null;
  const { id, typ, erstelltAm, geaendertAm, geloeschtAm, ...rest } = aufgabe;
  return store.anlegen('aufgabe', {
    ...rest,
    plandatum,
    deadline: abstand !== null ? plusTage(plandatum, abstand) : null,
    unteraufgaben: aufgabe.unteraufgaben.map((u) => ({ ...u, id: neueId(), erledigt: false })),
    checkliste: aufgabe.checkliste.map((c) => ({ ...c, id: neueId(), erledigt: false })),
    erledigtAm: null,
    vorgaengerId: aufgabe.id,
  });
}

function offeneNachfolger(id) {
  return store.liste('aufgabe').filter((a) => a.vorgaengerId === id && !a.erledigtAm);
}

export function erledige(id) {
  const aufgabe = store.hole(id);
  if (!aufgabe || aufgabe.erledigtAm) return;
  // Stammt die Aufgabe aus einem Pool, gilt damit auch der Pool-Eintrag als erledigt.
  const eintrag = aufgabe.poolEintragId ? store.hole(aufgabe.poolEintragId) : null;
  const poolVorher = eintrag && !eintrag.geloeschtAm ? pools.markiereErledigt(eintrag.id) : null;
  store.aendern(id, { erledigtAm: jetztIso(), poolVorher });
  const serie = serieVon(aufgabe);
  // Es gibt immer nur eine offene Aufgabe je Wiederholung: Unerledigtes stapelt sich nicht.
  if (serie && !offeneNachfolger(id).length) erzeugeNachfolger(aufgabe, serie);
}

export function oeffneWieder(id) {
  const aufgabe = store.hole(id);
  if (!aufgabe || !aufgabe.erledigtAm) return;
  // Die schon erzeugte nächste Aufgabe der Wiederholung wird wieder entfernt.
  const nachfolger = offeneNachfolger(id);
  if (nachfolger.length) store.entfernen(nachfolger.map((a) => a.id));
  if (aufgabe.poolEintragId && aufgabe.poolVorher) pools.setzeZurueck(aufgabe.poolEintragId, aufgabe.poolVorher);
  store.aendern(id, { erledigtAm: null, poolVorher: null });
}

export function schalteErledigt(id) {
  const aufgabe = store.hole(id);
  if (!aufgabe) return;
  if (aufgabe.erledigtAm) oeffneWieder(id);
  else erledige(id);
}

export function schalteUnteraufgabe(id, unterId) {
  const aufgabe = store.hole(id);
  if (!aufgabe) return;
  store.aendern(id, {
    unteraufgaben: aufgabe.unteraufgaben.map((u) => (u.id === unterId ? { ...u, erledigt: !u.erledigt } : u)),
  });
}

// ---------- Vorschläge aus Pools ----------

// Übernimmt einen Vorschlag als Aufgabe für heute. Gibt eine Funktion zum Rückgängigmachen zurück.
export function ausPoolEintrag(eintragId) {
  const eintrag = store.hole(eintragId);
  if (!eintrag) return () => {};
  const pool = pools.poolVon(eintrag);
  const aufgabe = neueAufgabe({
    titel: eintrag.titel,
    dauerMin: eintrag.dauerMin || null,
    plandatum: heute(),
    kategorieId: pool ? pool.kategorieId : null,
    poolEintragId: eintrag.id,
  }, null);
  return () => store.entfernen(aufgabe.id);
}

// ---------- Verschieben ----------

// Ändert nur das Plandatum. Die Deadline bleibt, wie sie ist.
export function verschiebeAufMorgen(id) {
  const aufgabe = store.hole(id);
  if (!aufgabe) return () => {};
  const vorher = aufgabe.plandatum;
  store.aendern(id, { plandatum: plusTage(heute(), 1) });
  return () => store.aendern(id, { plandatum: vorher });
}

// ---------- Löschen ----------

// Legt eine Aufgabe in den Papierkorb.
//   serie: 'beenden'  – die ganze Wiederholung endet
//          'weiter'   – nur diese Aufgabe entfällt, die nächste wird angelegt
// Gibt eine Funktion zurück, die alles rückgängig macht.
export function loescheAufgabe(id, { serie: wahl = 'weiter' } = {}) {
  const aufgabe = store.hole(id);
  if (!aufgabe) return () => {};
  const serie = serieVon(aufgabe);
  let nachfolger = null;
  let beendet = false;
  if (serie && !aufgabe.erledigtAm) {
    if (wahl === 'beenden') {
      store.aendern(serie.id, { beendetAm: jetztIso() });
      beendet = true;
    } else if (!offeneNachfolger(id).length) {
      nachfolger = erzeugeNachfolger(aufgabe, serie);
    }
  }
  store.loeschen(id);
  return () => {
    store.wiederherstellen(id);
    if (nachfolger) store.entfernen(nachfolger.id);
    if (beendet) store.aendern(serie.id, { beendetAm: null });
  };
}

// ---------- Auswahl und Sortierung ----------

export function alleAufgaben() {
  return store.liste('aufgabe');
}

export function istUeberfaellig(aufgabe, stichtag = heute()) {
  return !aufgabe.erledigtAm && Boolean(aufgabe.plandatum) && aufgabe.plandatum < stichtag;
}

export function heuteErledigt(aufgabe) {
  return Boolean(aufgabe.erledigtAm) && datumLokal(new Date(aufgabe.erledigtAm)) === heute();
}

// Wie dringend ist die Deadline? null, 'bald' (in höchstens 2 Tagen) oder 'vorbei'.
export function deadlineLage(aufgabe) {
  if (!aufgabe.deadline || aufgabe.erledigtAm) return null;
  const tage = tageZwischen(heute(), aufgabe.deadline);
  if (tage < 0) return 'vorbei';
  if (tage <= 2) return 'bald';
  return null;
}

export function fortschritt(aufgabe) {
  const gesamt = aufgabe.unteraufgaben.length;
  return { gesamt, erledigt: aufgabe.unteraufgaben.filter((u) => u.erledigt).length };
}

// Nach Plandatum (ohne Datum zuletzt), dann nach Uhrzeit, Priorität und Anlagezeit.
export function sortiere(liste) {
  return [...liste].sort((a, b) => {
    const da = a.plandatum || '9999-99-99';
    const db = b.plandatum || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    const za = a.startzeit || '99:99';
    const zb = b.startzeit || '99:99';
    if (za !== zb) return za < zb ? -1 : 1;
    if (a.prioritaet !== b.prioritaet) return b.prioritaet - a.prioritaet;
    return a.erstelltAm < b.erstelltAm ? -1 : 1;
  });
}

// Erledigte, zuletzt Abgehaktes zuerst.
export function sortiereErledigte(liste) {
  return [...liste].sort((a, b) => (a.erledigtAm < b.erledigtAm ? 1 : -1));
}
