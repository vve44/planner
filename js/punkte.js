// Erfahrungspunkte (EP) und Level.
//
// Für alles Abgehakte gibt es einen Datensatz "punkteEreignis":
//   schluessel   – eindeutig je Quelle, z. B. "aufgabe:<id>", "habit:<id>:<datum>"
//   art          – 'aufgabe' | 'pool' | 'habit' | 'tagesroutine' | 'streak'
//   punkte, datum, quelleId, schwelle (nur bei 'streak')
//
// Die Ereignisse werden nicht an jeder Stelle einzeln angelegt, sondern abgeglichen:
// Nach jeder Änderung an Aufgaben, Habits oder Tagesroutinen wird verglichen, was abgehakt ist
// und wofür es schon EP gibt. Fehlendes kommt dazu. Wurde ein Häkchen zurückgenommen, verschwinden
// die EP wieder. Wird dagegen etwas Abgehaktes gelöscht, bleiben die EP erhalten.
//
// Level: Die Aufstiege werden immer langsamer. Der erste kostet 50 EP, der zweite 10 EP mehr,
// und dieser Zuschlag wächst mit jedem Level um 1 (50, 60, 71, 83, 96, 110, …).
// Das Level sinkt nie: Das höchste erreichte Level steht in der Einstellung "level.erreicht",
// zusammen mit der Nummer der Formel. Ändert sich die Formel, wird das Level neu bestimmt.

import * as store from './store.js';
import * as habits from './habits.js';
import { heute, datumLokal } from './hilfen.js';

const TYP = 'punkteEreignis';
const EINSTELLUNG = 'level.erreicht';
const FORMEL = 2; // 1: +10 EP je Level (nur Version 9.0.0), 2: wachsender Zuschlag

export const EP = { aufgabe: 10, habit: 10, tagesroutine: 2 };

// Streak-Meilensteine eines Habits (in seiner Zähleinheit: Tage, Wochen, Monate oder Male).
export const MEILENSTEINE = [
  { ab: 7, ep: 20 },
  { ab: 30, ep: 50 },
  { ab: 100, ep: 100 },
  { ab: 365, ep: 300 },
];

const ERSTER_AUFSTIEG = 50;
const ERSTER_ZUSCHLAG = 10;

// ---------- Level ----------

// EP für den Aufstieg von diesem Level ins nächste: 50, 60, 71, 83, 96, 110, …
// Der Zuschlag gegenüber dem vorigen Aufstieg ist erst 10 und wächst jedes Mal um 1.
export function aufstieg(level) {
  const k = level - 1;
  return ERSTER_AUFSTIEG + ERSTER_ZUSCHLAG * k + (k * (k - 1)) / 2;
}

// EP, die insgesamt nötig sind, um dieses Level zu erreichen (Level 1: 0).
export function summeFuer(level) {
  const n = level - 1;
  return ERSTER_AUFSTIEG * n + (ERSTER_ZUSCHLAG * n * (n - 1)) / 2 + (n * (n - 1) * (n - 2)) / 6;
}

// Das höchste bisher erreichte Level (null, solange es für die geltende Formel noch nicht bestimmt ist).
function hoechstes() {
  const wert = store.einstellung(EINSTELLUNG, null);
  return wert && wert.formel === FORMEL ? wert.level : null;
}

export function levelAus(punkte) {
  let level = 1;
  while (punkte >= summeFuer(level + 1)) level += 1;
  return level;
}

export function ereignisse() {
  return store.liste(TYP);
}

export function summe() {
  return ereignisse().reduce((s, e) => s + e.punkte, 0);
}

// { punkte, level, imLevel, noetig, anteil, fehlen }
export function stand() {
  const punkte = summe();
  const level = Math.max(levelAus(punkte), hoechstes() || 1);
  const noetig = aufstieg(level);
  // Nach einem zurückgenommenen Häkchen können die EP unter der Schwelle des Levels liegen.
  const imLevel = Math.max(0, Math.min(noetig, punkte - summeFuer(level)));
  return { punkte, level, imLevel, noetig, anteil: imLevel / noetig, fehlen: summeFuer(level + 1) - punkte };
}

// Was an einem Tag gesammelt wurde.
export function amTag(tag = heute()) {
  const ergebnis = { aufgaben: { anzahl: 0, punkte: 0 }, habits: { anzahl: 0, punkte: 0 }, tagesroutinen: { anzahl: 0, punkte: 0 }, streaks: [], gesamt: 0 };
  ereignisse().forEach((e) => {
    if (e.datum !== tag) return;
    ergebnis.gesamt += e.punkte;
    if (e.art === 'streak') {
      const habit = store.hole(e.quelleId);
      ergebnis.streaks.push({ name: habit ? habit.name : 'Habit', schwelle: e.schwelle, einheit: habit ? habits.streakEinheit(habit)[1] : '', punkte: e.punkte });
      return;
    }
    const gruppe = e.art === 'habit' ? ergebnis.habits : e.art === 'tagesroutine' ? ergebnis.tagesroutinen : ergebnis.aufgaben;
    gruppe.anzahl += 1;
    gruppe.punkte += e.punkte;
  });
  return ergebnis;
}

// ---------- Abgleich ----------

// Wofür es nach dem jetzigen Stand der Daten EP geben soll: Map von Schlüssel auf die Felder des Ereignisses.
function soll() {
  const ergebnis = new Map();
  const alle = store.alleDatensaetze();
  const tag = heute();

  // Erledigte Aufgaben, auch wenn sie inzwischen im Papierkorb liegen.
  const ausPool = new Set();
  alle.forEach((d) => {
    if (d.typ !== 'aufgabe' || !d.erledigtAm) return;
    const datum = datumLokal(new Date(d.erledigtAm));
    ergebnis.set(`aufgabe:${d.id}`, { art: 'aufgabe', punkte: EP.aufgabe, datum, quelleId: d.id });
    if (d.poolEintragId) ausPool.add(`${d.poolEintragId}:${datum}`);
  });

  alle.forEach((d) => {
    if (d.geloeschtAm) return;
    if (d.typ === 'poolEintrag' && d.zuletztErledigtAm) {
      // Ein Vorschlag, der direkt abgehakt wurde. Lief er über eine Aufgabe, zählt die Aufgabe.
      if (!ausPool.has(`${d.id}:${d.zuletztErledigtAm}`)) {
        ergebnis.set(`pool:${d.id}:${d.zuletztErledigtAm}`, { art: 'pool', punkte: EP.aufgabe, datum: d.zuletztErledigtAm, quelleId: d.id });
      }
    } else if (d.typ === 'tagesroutineHaken') {
      (d.erledigt || []).forEach((id) => {
        ergebnis.set(`routine:${id}:${d.datum}`, { art: 'tagesroutine', punkte: EP.tagesroutine, datum: d.datum, quelleId: id });
      });
    } else if (d.typ === 'habitEintrag') {
      const habit = store.hole(d.habitId);
      if (habit && habits.erfuelltAm(habit, d.datum)) {
        ergebnis.set(`habit:${d.habitId}:${d.datum}`, { art: 'habit', punkte: EP.habit, datum: d.datum, quelleId: d.habitId });
      }
    } else if (d.typ === 'habit') {
      const laengste = habits.streak(d, tag).laengste;
      MEILENSTEINE.filter((m) => laengste >= m.ab).forEach((m) => {
        ergebnis.set(`streak:${d.id}:${m.ab}`, { art: 'streak', punkte: m.ep, datum: tag, quelleId: d.id, schwelle: m.ab });
      });
    }
  });
  return ergebnis;
}

// Ein Ereignis, das nicht mehr gedeckt ist: Wurde das Häkchen zurückgenommen (dann weg damit)
// oder ist nur die Quelle gelöscht (dann bleiben die EP)?
function zurueckgenommen(ereignis) {
  const quelle = store.hole(ereignis.quelleId);
  if (!quelle) return false;
  if (ereignis.art === 'aufgabe') return true; // Die Aufgabe gibt es noch, sie ist aber nicht mehr erledigt.
  if (quelle.geloeschtAm) return false;
  // Frühere Male eines Pool-Eintrags bleiben stehen. Nur das letzte kann zurückgenommen sein.
  if (ereignis.art === 'pool') return !quelle.zuletztErledigtAm || ereignis.datum >= quelle.zuletztErledigtAm;
  return true;
}

const BETEILIGT = ['aufgabe', 'habit', 'habitEintrag', 'tagesroutine', 'tagesroutineHaken', 'poolEintrag', 'urlaub', TYP];

// Kurzer Abdruck der beteiligten Daten: Ändert er sich nicht, ist kein Abgleich nötig
// (zum Beispiel wenn nur an einer Notiz geschrieben wird).
function abdruck() {
  return `${store.aenderungenAn(BETEILIGT)}|${heute()}`;
}

let letzterAbdruck = null;
let laeuft = false;
let geplant = false;
let aufstiegMelder = () => {};

// Wohin ein Levelaufstieg gemeldet wird (die App zeigt dann einen Hinweis).
export function beiAufstieg(fn) {
  aufstiegMelder = fn;
}

// Gleicht die EP mit dem Stand der Daten ab. Gibt zurück, ob sich etwas geändert hat.
export function gleicheAb() {
  if (laeuft) return false;
  const vorher = abdruck();
  if (vorher === letzterAbdruck) return false;
  laeuft = true;
  let geaendert = false;
  try {
    const gewollt = soll();
    const vorhanden = new Map();
    const doppelt = [];
    ereignisse().forEach((e) => {
      if (vorhanden.has(e.schluessel)) doppelt.push(e.id);
      else vorhanden.set(e.schluessel, e);
    });
    const weg = [...doppelt];
    vorhanden.forEach((e, schluessel) => {
      if (!gewollt.has(schluessel) && zurueckgenommen(e)) weg.push(e.id);
    });
    const neu = [];
    gewollt.forEach((felder, schluessel) => {
      if (!vorhanden.has(schluessel)) neu.push({ schluessel, ...felder });
    });
    if (weg.length || neu.length) {
      geaendert = true;
      store.stapel(() => {
        if (weg.length) store.entfernen(weg);
        neu.forEach((felder) => store.anlegen(TYP, felder));
      });
    }

    // Höchstes Level fortschreiben. Beim allerersten Abgleich (auch nach dem Einspielen eines Backups
    // oder einer geänderten Formel) ohne Meldung.
    const erreicht = levelAus(summe());
    const bisher = hoechstes();
    if (bisher === null || erreicht > bisher) {
      store.setzeEinstellung(EINSTELLUNG, { formel: FORMEL, level: erreicht }).catch(() => {});
      if (bisher !== null) aufstiegMelder(erreicht);
    }
  } finally {
    letzterAbdruck = abdruck();
    laeuft = false;
  }
  return geaendert;
}

// Startet den laufenden Abgleich: einmal sofort, danach nach jeder Änderung am Bestand.
export function starte() {
  gleicheAb();
  return store.abonniere(() => {
    if (laeuft || geplant) return;
    geplant = true;
    Promise.resolve().then(() => {
      geplant = false;
      gleicheAb();
    });
  });
}
