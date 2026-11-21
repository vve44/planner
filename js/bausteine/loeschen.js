// Löschen mit den passenden Rückfragen, für jede Art von Eintrag an einer Stelle.
// Genutzt von den Bearbeiten-Blättern und vom Menü beim langen Drücken.
// Jede Funktion gibt true zurück, wenn gelöscht wurde, und zeigt eine Meldung mit „Rückgängig“.

import { waehle, frage, melde } from './fenster.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as termine from '../termine.js';
import * as habits from '../habits.js';
import * as notizen from '../notizen.js';
import * as pools from '../pools.js';
import { tagLesbar } from '../hilfen.js';

const geloeschtMeldung = (name, zurueck) => melde(`„${name}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: zurueck });

// Einfache Einträge: in den Papierkorb, Rückgängig holt sie zurück.
function inDenPapierkorb(id, text) {
  store.loeschen(id);
  melde(text, { aktion: 'Rückgängig', beiAktion: () => store.wiederherstellen(id) });
  return true;
}

export async function loescheAufgabe(aufgabe) {
  let wahl = 'weiter';
  if (aufgaben.serieVon(aufgabe) && !aufgabe.erledigtAm) {
    wahl = await waehle({
      titel: 'Wiederkehrende Aufgabe löschen',
      text: 'Soll nur diese eine Aufgabe entfallen, oder soll die ganze Wiederholung enden?',
      optionen: [
        { wert: 'weiter', name: 'Nur diese Aufgabe' },
        { wert: 'beenden', name: 'Ganze Wiederholung beenden', art: 'gefahr' },
      ],
    });
    if (!wahl) return false;
  }
  geloeschtMeldung(aufgabe.titel, aufgaben.loescheAufgabe(aufgabe.id, { serie: wahl }));
  return true;
}

export async function loescheProjekt(projekt) {
  const anzahl = aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id).length;
  let mitAufgaben = false;
  if (anzahl) {
    const wahl = await waehle({
      titel: `„${projekt.name}“ löschen`,
      text: anzahl === 1 ? 'In dieser Liste steht 1 Aufgabe. Was soll mit ihr passieren?' : `In dieser Liste stehen ${anzahl} Aufgaben. Was soll mit ihnen passieren?`,
      optionen: [
        { wert: 'behalten', name: 'Aufgaben behalten, ohne Liste' },
        { wert: 'mit', name: 'Aufgaben mit löschen', art: 'gefahr' },
      ],
    });
    if (!wahl) return false;
    mitAufgaben = wahl === 'mit';
  }
  geloeschtMeldung(projekt.name, aufgaben.loescheProjekt(projekt.id, { mitAufgaben }));
  return true;
}

// start: Beginn des Vorkommens (bei Wiederholungen), sonst null.
export async function loescheTermin(termin, start = null) {
  let wahl = 'alle';
  if (termin.wiederholung && start) {
    const tag = tagLesbar(start);
    const wann = ['Heute', 'Morgen', 'Gestern'].includes(tag) ? tag.toLowerCase() : `am ${tag}`;
    wahl = await waehle({
      titel: 'Wiederkehrenden Termin löschen',
      text: `Soll nur der Termin ${wann} entfallen, oder die ganze Reihe?`,
      optionen: [
        { wert: 'einer', name: 'Nur diesen Termin' },
        { wert: 'alle', name: 'Alle Termine der Reihe', art: 'gefahr' },
      ],
    });
    if (!wahl) return false;
  }
  let zurueck;
  if (wahl === 'einer') {
    zurueck = termine.loescheVorkommen(termin, start);
  } else {
    store.loeschen(termin.id);
    zurueck = () => store.wiederherstellen(termin.id);
  }
  geloeschtMeldung(termin.titel, zurueck);
  return true;
}

export async function loescheHabit(habit) {
  const ja = await frage({
    titel: `„${habit.name}“ löschen?`,
    text: 'Das Habit kommt mit seinem Verlauf in den Papierkorb und lässt sich 30 Tage lang wiederherstellen.',
    ja: 'Löschen',
    gefahr: true,
  });
  if (!ja) return false;
  geloeschtMeldung(habit.name, habits.loesche(habit));
  return true;
}

export async function loescheNotiz(notiz) {
  const kinder = notizen.kinderVon(notiz).length;
  const ja = await frage({
    titel: `„${notiz.titel}“ löschen?`,
    text: kinder
      ? `Die Notiz kommt mit ${kinder === 1 ? 'ihrer Unternotiz' : `ihren ${kinder} Unternotizen`} in den Papierkorb und lässt sich 30 Tage lang wiederherstellen.`
      : 'Sie kommt in den Papierkorb und lässt sich 30 Tage lang wiederherstellen.',
    ja: 'Löschen',
    gefahr: true,
  });
  if (!ja) return false;
  geloeschtMeldung(notiz.titel, notizen.loesche(notiz));
  return true;
}

export async function loescheZiel(ziel) {
  const ja = await frage({
    titel: `„${ziel.titel}“ löschen?`,
    text: 'Das Ziel kommt in den Papierkorb. Die verknüpften Listen, Aufgaben und Habits bleiben erhalten.',
    ja: 'Löschen',
    gefahr: true,
  });
  if (!ja) return false;
  return inDenPapierkorb(ziel.id, `„${ziel.titel}“ gelöscht`);
}

// Ein Pool kommt mit seinen Einträgen in den Papierkorb (wie bisher ohne Rückfrage, mit Rückgängig).
export async function loeschePool(pool) {
  geloeschtMeldung(pool.name, pools.loeschePool(pool.id));
  return true;
}

export async function loescheMesswert(messwert) {
  const notiz = store.hole(messwert.notizId);
  const { datum, wert } = messwert;
  store.entfernen(messwert.id);
  melde('Eintrag gelöscht', { aktion: 'Rückgängig', beiAktion: () => notiz && notizen.setzeMesswert(notiz, datum, wert) });
  return true;
}

export async function loescheUrlaub(urlaub) {
  return inDenPapierkorb(urlaub.id, 'Urlaub gelöscht');
}

export async function loeschePeriode(periode) {
  return inDenPapierkorb(periode.id, 'Eintrag gelöscht');
}

// Tagesroutine, Routine, Pool-Eintrag, Kategorie: ohne Rückfrage, mit Rückgängig.
export async function loescheEinfach(datensatz) {
  return inDenPapierkorb(datensatz.id, `„${datensatz.titel || datensatz.name}“ gelöscht`);
}

// Für das Menü beim langen Drücken: die passende Funktion je Typ.
export const NACH_TYP = {
  aufgabe: loescheAufgabe,
  projekt: loescheProjekt,
  termin: loescheTermin,
  habit: loescheHabit,
  notiz: loescheNotiz,
  ziel: loescheZiel,
  pool: loeschePool,
  messwert: loescheMesswert,
  urlaub: loescheUrlaub,
  periode: loeschePeriode,
  tagesroutine: loescheEinfach,
  routine: loescheEinfach,
  poolEintrag: loescheEinfach,
  kategorie: loescheEinfach,
};
