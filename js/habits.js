// Habits: Gewohnheiten mit Frequenz, Menge, Streak, Auslassen, Pause und Urlaub.
//
// Ein Habit sieht so aus:
//   { name, icon, kategorieId,
//     frequenz: { art: 'taeglich' | 'wochentage' | 'proWoche' | 'proMonat' | 'intervall',
//                 wochentage: [1, 3, 5],   // bei 'wochentage' (1 = Montag … 7 = Sonntag)
//                 anzahl: 3,               // bei 'proWoche' und 'proMonat'
//                 n: 2 },                  // bei 'intervall' (alle n Tage)
//     menge: null | { einheit: 'Gläser', ziel: 8 },   // Tagesziel, Teilmengen möglich
//     beginn: '2026-11-14',                // ab diesem Tag zählt das Habit
//     pausiertSeit: null | '2026-11-20',   // läuft gerade eine Pause, dann seit wann
//     pausen: [{ von, bis }],              // abgeschlossene Pausen
//     reihenfolge }
//
// Ein Eintrag (Typ habitEintrag), höchstens einer je Habit und Tag:
//   { habitId, datum, wert, ausgelassen }
//   wert: eingetragene Menge, bei Habits ohne Menge 1 für "erledigt".
//
// Urlaub (Typ urlaub): { von, bis }. In dieser Zeit ruhen alle Habits.
//
// Die Regeln in Kürze:
//   - Ein Tag ist erfüllt, wenn der Wert das Tagesziel erreicht (ohne Menge: 1).
//   - Ruhetage sind ausgelassene Tage, Pausen und Urlaub. Sie brechen keine Streak
//     und zählen auch nicht mit.
//   - Täglich und Wochentage: Die Streak zählt die fälligen Tage in Folge.
//   - x-mal pro Woche oder Monat: Die Streak zählt Wochen oder Monate, in denen das Ziel
//     erreicht wurde. Eine Woche (ein Monat) mit Ruhetag kann die Streak nicht brechen.
//   - Alle n Tage: fällig n Tage nach dem letzten Mal. Die Streak zählt, wie oft in Folge
//     der Abstand eingehalten wurde.

import * as store from './store.js';
import { heute, plusTage, plusMonate, tageZwischen, wochentagNr, montagVon, monatsErster } from './hilfen.js';
import { WOCHENTAGE } from './typen.js';

// ---------- Schneller Zugriff auf Einträge und Urlaube ----------
// Wird bei jeder Änderung der Daten verworfen und beim nächsten Zugriff neu aufgebaut.

let index = null;
store.abonniere(() => { index = null; });

function idx() {
  if (index) return index;
  const jeHabit = new Map();
  store.liste('habitEintrag').forEach((e) => {
    let tage = jeHabit.get(e.habitId);
    if (!tage) {
      tage = new Map();
      jeHabit.set(e.habitId, tage);
    }
    tage.set(e.datum, e);
  });
  const urlaube = store.liste('urlaub').sort((a, b) => (a.von < b.von ? -1 : 1));
  index = { jeHabit, urlaube, merk: new Map() };
  return index;
}

function eintraegeVon(habit) {
  return idx().jeHabit.get(habit.id) || new Map();
}

function runde(zahl) {
  return Math.round(zahl * 100) / 100;
}

// ---------- Habits ----------

export function alle() {
  return store.liste('habit').sort((a, b) => a.reihenfolge - b.reihenfolge || a.name.localeCompare(b.name, 'de'));
}

export function leeresHabit() {
  return {
    name: '',
    icon: 'sparkles',
    kategorieId: null,
    frequenz: { art: 'taeglich', wochentage: [1, 2, 3, 4, 5], anzahl: 3, n: 2 },
    menge: null,
  };
}

export function neu(felder) {
  const letztes = alle().pop();
  return store.anlegen('habit', {
    ...leeresHabit(),
    ...felder,
    beginn: heute(),
    pausiertSeit: null,
    pausen: [],
    reihenfolge: letztes ? letztes.reihenfolge + 1 : 1,
  });
}

// Löscht ein Habit (Papierkorb). Die Einträge bleiben liegen und kommen beim
// Wiederherstellen zurück. Gibt eine Funktion zum Rückgängigmachen zurück.
export function loesche(habit) {
  store.loeschen(habit.id);
  return () => store.wiederherstellen(habit.id);
}

// Entfernt Einträge, deren Habit es endgültig nicht mehr gibt (beim Start der App).
export function raeumeAuf() {
  const verwaist = store.liste('habitEintrag').filter((e) => !store.hole(e.habitId)).map((e) => e.id);
  if (verwaist.length) store.entfernen(verwaist);
}

// "Täglich", "Mo, Mi, Fr", "3-mal pro Woche", "Alle 2 Tage"
export function frequenzText(habit) {
  const f = habit.frequenz;
  if (f.art === 'wochentage') {
    const tage = [...f.wochentage].sort((a, b) => a - b);
    if (tage.length === 7) return 'Täglich';
    return tage.map((nr) => WOCHENTAGE[nr - 1].kurz).join(', ');
  }
  if (f.art === 'proWoche') return `${f.anzahl}-mal pro Woche`;
  if (f.art === 'proMonat') return `${f.anzahl}-mal pro Monat`;
  if (f.art === 'intervall') return `Alle ${f.n} Tage`;
  return 'Täglich';
}

// Zahl mit Komma statt Punkt: 1.5 -> "1,5"
export function zahlText(zahl) {
  return String(runde(zahl)).replace('.', ',');
}

// "8 Gläser" (Tagesziel) oder "" bei Habits ohne Menge
export function mengeText(habit, wert = null) {
  if (!habit.menge) return '';
  const zahl = wert === null ? zahlText(habit.menge.ziel) : `${zahlText(wert)}/${zahlText(habit.menge.ziel)}`;
  return habit.menge.einheit ? `${zahl} ${habit.menge.einheit}` : zahl;
}

// ---------- Einzelne Tage ----------

export function tagesziel(habit) {
  return habit.menge ? habit.menge.ziel : 1;
}

export function eintragAm(habit, tag) {
  return eintraegeVon(habit).get(tag) || null;
}

// Eingetragener Wert des Tages (0, wenn nichts eingetragen ist).
export function wertAm(habit, tag) {
  const e = eintragAm(habit, tag);
  return e ? e.wert : 0;
}

export function erfuelltAm(habit, tag) {
  return wertAm(habit, tag) >= tagesziel(habit);
}

export function ausgelassenAm(habit, tag) {
  const e = eintragAm(habit, tag);
  return Boolean(e && e.ausgelassen) && !erfuelltAm(habit, tag);
}

// ---------- Urlaub und Pause ----------

export function urlaube() {
  return idx().urlaube;
}

export function urlaubAm(tag) {
  return idx().urlaube.find((u) => u.von <= tag && tag <= u.bis) || null;
}

export function neuerUrlaub(von, bis) {
  return store.anlegen('urlaub', { von, bis });
}

export function pausiertAm(habit, tag) {
  if (habit.pausiertSeit && tag >= habit.pausiertSeit) return true;
  return (habit.pausen || []).some((p) => p.von <= tag && tag <= p.bis);
}

export function istPausiert(habit) {
  return Boolean(habit.pausiertSeit);
}

// Pause oder Urlaub: Das Habit ruht an diesem Tag.
export function ruhtAm(habit, tag) {
  return pausiertAm(habit, tag) || Boolean(urlaubAm(tag));
}

function ruhetag(habit, tag) {
  return ruhtAm(habit, tag) || ausgelassenAm(habit, tag);
}

export function pausiere(habit, tag = heute()) {
  store.aendern(habit.id, { pausiertSeit: tag });
}

// Beendet die Pause. Der heutige Tag zählt wieder.
export function setzeFort(habit, tag = heute()) {
  if (!habit.pausiertSeit) return;
  const bis = plusTage(tag, -1);
  const pausen = [...(habit.pausen || [])];
  if (bis >= habit.pausiertSeit) pausen.push({ von: habit.pausiertSeit, bis });
  store.aendern(habit.id, { pausiertSeit: null, pausen });
}

// ---------- Eintragen ----------

export function setzeWert(habit, tag, wert) {
  const e = eintragAm(habit, tag);
  const sauber = Math.max(0, runde(Number(wert) || 0));
  if (!e) {
    if (sauber > 0) store.anlegen('habitEintrag', { habitId: habit.id, datum: tag, wert: sauber, ausgelassen: false });
    return;
  }
  if (sauber <= 0 && !e.ausgelassen) {
    store.entfernen(e.id);
    return;
  }
  // Wer das Ziel erreicht, hat den Tag nicht ausgelassen.
  store.aendern(e.id, { wert: sauber, ausgelassen: sauber >= tagesziel(habit) ? false : e.ausgelassen });
}

export function addiere(habit, tag, menge) {
  setzeWert(habit, tag, wertAm(habit, tag) + menge);
}

// Abhaken und Häkchen zurücknehmen (bei Mengen: Tagesziel setzen oder leeren).
export function schalteErledigt(habit, tag = heute()) {
  setzeWert(habit, tag, erfuelltAm(habit, tag) ? 0 : tagesziel(habit));
}

export function setzeAusgelassen(habit, tag, an) {
  const e = eintragAm(habit, tag);
  if (an) {
    if (e) store.aendern(e.id, { ausgelassen: true });
    else store.anlegen('habitEintrag', { habitId: habit.id, datum: tag, wert: 0, ausgelassen: true });
  } else if (e) {
    if (e.wert > 0) store.aendern(e.id, { ausgelassen: false });
    else store.entfernen(e.id);
  }
}

// ---------- Zeiträume ----------

function wocheVon(tag) {
  const von = montagVon(tag);
  return { von, bis: plusTage(von, 6) };
}

function monatVon(tag) {
  const von = monatsErster(tag);
  return { von, bis: plusTage(plusMonate(von, 1), -1) };
}

// Wie viele Tage im Zeitraum erfüllt sind.
export function zaehleErfuellt(habit, von, bis) {
  const ziel = tagesziel(habit);
  let anzahl = 0;
  eintraegeVon(habit).forEach((e, datum) => {
    if (datum >= von && datum <= bis && e.wert >= ziel) anzahl += 1;
  });
  return anzahl;
}

function hatRuhetag(habit, von, bis) {
  for (let tag = von; tag <= bis; tag = plusTage(tag, 1)) {
    if (ruhetag(habit, tag)) return true;
  }
  return false;
}

// Der Tag, ab dem das Habit zählt: sein Beginn oder ein früherer nachgetragener Eintrag.
export function ersterTag(habit) {
  let erster = habit.beginn || (habit.erstelltAm || '').slice(0, 10) || heute();
  const ziel = tagesziel(habit);
  eintraegeVon(habit).forEach((e, datum) => {
    if (e.wert >= ziel && datum < erster) erster = datum;
  });
  return erster;
}

// Stand der laufenden Woche oder des laufenden Monats: { ist, soll, wort } oder null.
export function periodenStand(habit, tag = heute()) {
  const f = habit.frequenz;
  if (f.art === 'proWoche') {
    const { von, bis } = wocheVon(tag);
    return { ist: zaehleErfuellt(habit, von, bis), soll: f.anzahl, wort: 'diese Woche' };
  }
  if (f.art === 'proMonat') {
    const { von, bis } = monatVon(tag);
    return { ist: zaehleErfuellt(habit, von, bis), soll: f.anzahl, wort: 'diesen Monat' };
  }
  return null;
}

// Alle erfüllten Tage, aufsteigend.
function erfuellteTage(habit) {
  const ziel = tagesziel(habit);
  const tage = [];
  eintraegeVon(habit).forEach((e, datum) => { if (e.wert >= ziel) tage.push(datum); });
  return tage.sort();
}

// ---------- Was steht an einem Tag an? ----------
//   'erledigt'      – der Tag ist erfüllt
//   'ruht'          – Pause oder Urlaub
//   'ausgelassen'   – für diesen Tag ausgelassen
//   'zielErreicht'  – Wochen- oder Monatsziel schon erreicht, heute nichts mehr nötig
//   'offen'         – steht an
//   'frei'          – an diesem Tag nicht dran

export function lageAm(habit, tag = heute()) {
  if (erfuelltAm(habit, tag)) return 'erledigt';
  if (ruhtAm(habit, tag)) return 'ruht';
  if (ausgelassenAm(habit, tag)) return 'ausgelassen';
  const f = habit.frequenz;
  if (f.art === 'wochentage') return f.wochentage.includes(wochentagNr(tag)) ? 'offen' : 'frei';
  if (f.art === 'proWoche' || f.art === 'proMonat') {
    const stand = periodenStand(habit, tag);
    return stand.ist >= stand.soll ? 'zielErreicht' : 'offen';
  }
  if (f.art === 'intervall') {
    const davor = erfuellteTage(habit).filter((t) => t < tag);
    if (!davor.length) return 'offen';
    return tageZwischen(davor[davor.length - 1], tag) >= f.n ? 'offen' : 'frei';
  }
  return 'offen';
}

// Wann ein Habit mit "alle n Tage" das nächste Mal dran ist (oder null).
export function naechstesMal(habit, tag = heute()) {
  if (habit.frequenz.art !== 'intervall') return null;
  const tage = erfuellteTage(habit).filter((t) => t <= tag);
  if (!tage.length) return tag;
  const dran = plusTage(tage[tage.length - 1], habit.frequenz.n);
  return dran < tag ? tag : dran;
}

// ---------- Streak ----------
// Jede Frequenz wird in eine Folge von Abschnitten übersetzt:
//   'ja' (erfüllt), 'nein' (verpasst), 'neutral' (Ruhetag, zählt nicht), 'offen' (läuft noch).
// Die Streak ist die Zahl der 'ja' seit dem letzten 'nein'.

function folgeTage(habit, bisTag) {
  const f = habit.frequenz;
  const folge = [];
  for (let tag = ersterTag(habit); tag <= bisTag; tag = plusTage(tag, 1)) {
    const faellig = f.art !== 'wochentage' || f.wochentage.includes(wochentagNr(tag));
    if (!faellig) continue;
    let z = 'nein';
    if (erfuelltAm(habit, tag)) z = 'ja';
    else if (ruhetag(habit, tag)) z = 'neutral';
    else if (tag === bisTag) z = 'offen';
    folge.push({ z, von: tag });
  }
  return folge;
}

function folgePerioden(habit, bisTag, zeitraumVon, weiter) {
  const soll = habit.frequenz.anzahl;
  const start = ersterTag(habit);
  const folge = [];
  let erste = true;
  for (let p = zeitraumVon(start); p.von <= bisTag; p = zeitraumVon(weiter(p))) {
    let z = 'nein';
    if (zaehleErfuellt(habit, p.von, p.bis) >= soll) z = 'ja';
    else if (bisTag <= p.bis) z = 'offen';
    // Die angebrochene erste Woche (der erste Monat) und Zeiträume mit Ruhetag brechen nichts.
    else if (erste || hatRuhetag(habit, p.von < start ? start : p.von, p.bis)) z = 'neutral';
    folge.push({ z, von: p.von });
    erste = false;
  }
  return folge;
}

function folgeIntervall(habit, bisTag) {
  const n = habit.frequenz.n;
  const tage = erfuellteTage(habit).filter((t) => t <= bisTag);
  const folge = [];
  // Ruhetage zwischen zwei Tagen verlängern die Frist.
  const ruhetageZwischen = (von, bis, mitEnde) => {
    let anzahl = 0;
    for (let tag = plusTage(von, 1); mitEnde ? tag <= bis : tag < bis; tag = plusTage(tag, 1)) {
      if (ruhetag(habit, tag)) anzahl += 1;
    }
    return anzahl;
  };
  tage.forEach((tag, i) => {
    if (i > 0) {
      const davor = tage[i - 1];
      if (tageZwischen(davor, tag) - ruhetageZwischen(davor, tag, false) > n) folge.push({ z: 'nein', von: plusTage(davor, n + 1) });
    }
    folge.push({ z: 'ja', von: tag });
  });
  if (tage.length) {
    const letzter = tage[tage.length - 1];
    if (tageZwischen(letzter, bisTag) - ruhetageZwischen(letzter, bisTag, true) > n) folge.push({ z: 'nein', von: bisTag });
  }
  return folge;
}

function folgeVon(habit, bisTag) {
  const schluessel = `${habit.id}|${bisTag}`;
  const merk = idx().merk;
  if (merk.has(schluessel)) return merk.get(schluessel);
  const art = habit.frequenz.art;
  let folge;
  if (art === 'proWoche') folge = folgePerioden(habit, bisTag, wocheVon, (p) => plusTage(p.bis, 1));
  else if (art === 'proMonat') folge = folgePerioden(habit, bisTag, monatVon, (p) => plusTage(p.bis, 1));
  else if (art === 'intervall') folge = folgeIntervall(habit, bisTag);
  else folge = folgeTage(habit, bisTag);
  merk.set(schluessel, folge);
  return folge;
}

// Worin die Streak zählt: [Einzahl, Mehrzahl]
export function streakEinheit(habit) {
  const art = habit.frequenz.art;
  if (art === 'proWoche') return ['Woche', 'Wochen'];
  if (art === 'proMonat') return ['Monat', 'Monate'];
  if (art === 'intervall') return ['Mal', 'Mal'];
  return ['Tag', 'Tage'];
}

// { aktuell, laengste, text: "5 Tage" }
export function streak(habit, tag = heute()) {
  let lauf = 0;
  let laengste = 0;
  folgeVon(habit, tag).forEach(({ z }) => {
    if (z === 'ja') {
      lauf += 1;
      laengste = Math.max(laengste, lauf);
    } else if (z === 'nein') {
      lauf = 0;
    }
  });
  const [eins, viele] = streakEinheit(habit);
  const text = (zahl) => `${zahl} ${zahl === 1 ? eins : viele}`;
  return { aktuell: lauf, laengste, text: text(lauf), textLaengste: text(laengste) };
}

// ---------- Auswertung ----------

// Erfüllungsquote der letzten Zeit: { anteil (0 bis 1), zeitraum } oder null ohne Daten.
// Ruhetage und der noch laufende Abschnitt zählen nicht mit.
export function quote(habit, tag = heute()) {
  const art = habit.frequenz.art;
  let ab = plusTage(tag, -29);
  let zeitraum = 'letzte 30 Tage';
  if (art === 'proWoche') {
    ab = plusTage(montagVon(tag), -11 * 7);
    zeitraum = 'letzte 12 Wochen';
  } else if (art === 'proMonat') {
    ab = plusMonate(monatsErster(tag), -11);
    zeitraum = 'letzte 12 Monate';
  } else if (art === 'intervall') {
    ab = plusTage(tag, -89);
    zeitraum = 'letzte 90 Tage';
  }
  const gewertet = folgeVon(habit, tag).filter(({ z, von }) => von >= ab && (z === 'ja' || z === 'nein'));
  if (!gewertet.length) return null;
  const ja = gewertet.filter(({ z }) => z === 'ja').length;
  return { anteil: ja / gewertet.length, zeitraum };
}

// Zahlen für die Statistikseite.
export function statistik(habit, tag = heute()) {
  const tage = erfuellteTage(habit);
  let summe = 0;
  let tageMitWert = 0;
  eintraegeVon(habit).forEach((e) => {
    if (e.wert > 0) {
      summe += e.wert;
      tageMitWert += 1;
    }
  });
  const woche = wocheVon(tag);
  const monat = monatVon(tag);
  return {
    erfuellteTage: tage.length,
    summe: runde(summe),
    schnitt: tageMitWert ? runde(summe / tageMitWert) : 0,
    dieseWoche: zaehleErfuellt(habit, woche.von, woche.bis),
    dieserMonat: zaehleErfuellt(habit, monat.von, monat.bis),
    seit: ersterTag(habit),
  };
}

// Stufe eines Tages für die Heatmap:
//   0 nichts, 1 bis 3 Teilmenge, 4 erfüllt, 'ruhe' Ruhetag, 'vor' vor Beginn oder in der Zukunft
export function stufeAm(habit, tag, heuteTag = heute()) {
  if (tag > heuteTag) return 'vor';
  if (erfuelltAm(habit, tag)) return 4;
  if (ruhetag(habit, tag)) return 'ruhe';
  const wert = wertAm(habit, tag);
  if (wert > 0) return Math.max(1, Math.min(3, Math.ceil((wert / tagesziel(habit)) * 3)));
  if (tag < ersterTag(habit)) return 'vor';
  return 0;
}
