// Zyklus: Erfasst werden nur Beginn und Ende der Periode. Daraus schätzt die App
// den Zyklustag und die Phase. Die Schätzung ist grob und für nichts anderes gedacht
// als für einen Hinweis im Tagesbereich: nicht zur Verhütung, nicht für medizinische
// Entscheidungen. Alle Angaben bleiben auf dem Gerät.
//
// Eine Periode (Typ periode): { beginn: '2026-11-03', ende: '2026-11-07' | null }
//   ende ist null, solange die Periode läuft.
//
// So wird geschätzt:
//   - Zyklustag: Tage seit dem letzten Periodenbeginn, der erste Tag ist Tag 1.
//   - Zykluslänge: Durchschnitt der letzten (höchstens sechs) Abstände zwischen zwei
//     Periodenbeginnen. Solange es noch keinen Abstand gibt, gilt die Angabe der Nutzerin.
//   - Eisprung: 14 Tage vor dem erwarteten Ende des Zyklus (übliche Faustregel).
//   - Phasen: Menstruation (bis zum Periodenende), Follikelphase, Eisprungphase
//     (der geschätzte Tag und je ein Tag davor und danach), Lutealphase.

import * as store from './store.js';
import { heute, tageZwischen } from './hilfen.js';

export const PHASEN = [
  {
    wert: 'menstruation',
    name: 'Menstruation',
    text: 'Ein neuer Zyklus beginnt. Viele haben in diesen Tagen weniger Energie und brauchen mehr Ruhe. Wenn es geht, plane etwas mehr Pausen ein.',
  },
  {
    wert: 'follikel',
    name: 'Follikelphase',
    text: 'Nach der Periode steigt bei vielen die Energie. Oft eine gute Zeit, um Neues anzufangen, zu planen und Anspruchsvolles anzugehen.',
  },
  {
    wert: 'eisprung',
    name: 'Eisprungphase',
    text: 'Rund um den Eisprung fühlen sich viele besonders energiegeladen und offen für Kontakte.',
  },
  {
    wert: 'luteal',
    name: 'Lutealphase',
    text: 'In der zweiten Zyklushälfte lässt die Energie bei vielen langsam nach, gegen Ende sind Müdigkeit oder Stimmungsschwankungen möglich. Gewohntes und Angefangenes fallen oft leichter als Neues.',
  },
];

export const LAENGE_MIN = 15;   // kürzeste und längste Zykluslänge, die als plausibel gilt
export const LAENGE_MAX = 60;
const PERIODE_STANDARD = 5;     // Dauer der Periode, solange es keine eigenen Daten gibt
const PERIODE_OFFEN_MAX = 10;   // eine laufende Periode ohne Ende gilt höchstens so lange als Menstruation

// ---------- Perioden ----------

// Alle Perioden, die älteste zuerst.
export function perioden() {
  return store.liste('periode').sort((a, b) => (a.beginn < b.beginn ? -1 : 1));
}

// Die laufende Periode (die jüngste, wenn sie noch kein Ende hat) oder null.
export function laufende() {
  const alle = perioden();
  const letzte = alle[alle.length - 1];
  return letzte && !letzte.ende ? letzte : null;
}

// Prüft Angaben zu einer Periode. Gibt einen Fehlertext zurück oder null.
export function pruefe(beginn, ende, ausser = null) {
  const tag = heute();
  if (!beginn) return 'Gib den ersten Tag der Periode an.';
  if (beginn > tag) return 'Der Beginn liegt in der Zukunft.';
  if (ende && ende < beginn) return 'Das Ende liegt vor dem Beginn.';
  if (ende && ende > tag) return 'Das Ende liegt in der Zukunft.';
  const andere = perioden().filter((p) => p.id !== ausser);
  const letzterTag = ende || beginn;
  const ueberschneidet = andere.some((p) => beginn <= (p.ende || p.beginn) && letzterTag >= p.beginn);
  if (ueberschneidet) return 'In diesem Zeitraum ist schon eine Periode eingetragen.';
  if (!ende && andere.some((p) => p.beginn > beginn)) return 'Es gibt schon eine spätere Periode. Gib deshalb auch das Ende an.';
  return null;
}

export function beginne(beginn) {
  return store.anlegen('periode', { beginn, ende: null });
}

// ---------- Längen ----------

// Abstände zwischen aufeinanderfolgenden Periodenbeginnen, die jüngsten zuerst.
// Unplausible Abstände (zum Beispiel, weil eine Periode nicht eingetragen wurde) zählen nicht.
export function zykluslaengen() {
  const alle = perioden();
  const laengen = [];
  for (let i = alle.length - 1; i > 0; i -= 1) {
    const laenge = tageZwischen(alle[i - 1].beginn, alle[i].beginn);
    if (laenge >= LAENGE_MIN && laenge <= LAENGE_MAX) laengen.push(laenge);
  }
  return laengen;
}

// Die Zykluslänge, mit der gerechnet wird: { tage, quelle: 'daten' | 'angabe', anzahl } oder null.
export function zykluslaenge() {
  const laengen = zykluslaengen().slice(0, 6);
  if (laengen.length) {
    const schnitt = laengen.reduce((summe, l) => summe + l, 0) / laengen.length;
    return { tage: Math.round(schnitt), quelle: 'daten', anzahl: laengen.length };
  }
  const angabe = store.einstellung('zyklus.laenge', null);
  if (angabe) return { tage: angabe, quelle: 'angabe', anzahl: 0 };
  return null;
}

// Durchschnittliche Dauer der abgeschlossenen Perioden in Tagen (oder null).
export function periodenDauer() {
  const dauern = perioden().filter((p) => p.ende).map((p) => tageZwischen(p.beginn, p.ende) + 1).slice(-6);
  if (!dauern.length) return null;
  return Math.round(dauern.reduce((summe, d) => summe + d, 0) / dauern.length);
}

// ---------- Texte zu den Phasen (änderbar) ----------

export function phasenText(wert) {
  const eigene = store.einstellung('zyklus.texte', null) || {};
  return eigene[wert] || PHASEN.find((p) => p.wert === wert).text;
}

export function phaseName(wert) {
  return PHASEN.find((p) => p.wert === wert).name;
}

// ---------- Stand an einem Tag ----------
// Rückgabe null, wenn es noch keine Periode gibt. Sonst:
//   { zyklustag, phase, laenge, eisprungTag, periode,
//     endeFehlt,        – die Periode läuft schon ungewöhnlich lange ohne eingetragenes Ende
//     laengerAlsUeblich,– der Zyklus dauert schon länger als die übliche Länge
//     veraltet,         – der letzte Beginn liegt zu lange zurück für eine Schätzung
//     brauchtLaenge }   – es fehlt noch die Angabe der üblichen Zykluslänge
export function stand(tag = heute()) {
  const vorher = perioden().filter((p) => p.beginn <= tag);
  const periode = vorher[vorher.length - 1];
  if (!periode) return null;
  const zyklustag = tageZwischen(periode.beginn, tag) + 1;
  const laenge = zykluslaenge();
  const ergebnis = {
    zyklustag,
    phase: null,
    laenge,
    eisprungTag: null,
    periode,
    endeFehlt: false,
    laengerAlsUeblich: false,
    veraltet: zyklustag > LAENGE_MAX,
    brauchtLaenge: false,
  };
  if (ergebnis.veraltet) return ergebnis;

  // Menstruation: bis zum eingetragenen Ende. Fehlt es, dann höchstens zehn Tage lang.
  let blutet;
  if (periode.ende) {
    blutet = tag <= periode.ende;
  } else {
    blutet = zyklustag <= PERIODE_OFFEN_MAX;
    ergebnis.endeFehlt = !blutet;
  }
  if (blutet) {
    ergebnis.phase = 'menstruation';
    return ergebnis;
  }
  if (!laenge) {
    ergebnis.brauchtLaenge = true;
    return ergebnis;
  }
  const eisprung = laenge.tage - 14;
  ergebnis.eisprungTag = eisprung;
  ergebnis.laengerAlsUeblich = zyklustag > laenge.tage;
  if (zyklustag < eisprung - 1) ergebnis.phase = 'follikel';
  else if (zyklustag <= eisprung + 1) ergebnis.phase = 'eisprung';
  else ergebnis.phase = 'luteal';
  return ergebnis;
}

// Anteile der vier Phasen an einem Zyklus, für den Balken (Tage je Phase).
export function phasenTage(st) {
  if (!st || !st.laenge) return null;
  const laenge = st.laenge.tage;
  const eisprung = laenge - 14;
  const periode = st.periode.ende
    ? tageZwischen(st.periode.beginn, st.periode.ende) + 1
    : periodenDauer() || PERIODE_STANDARD;
  const menstruation = Math.max(1, Math.min(periode, eisprung - 2));
  const follikel = Math.max(0, eisprung - 2 - menstruation);
  const eisprungTage = 3;
  const luteal = Math.max(1, laenge - menstruation - follikel - eisprungTage);
  return { menstruation, follikel, eisprung: eisprungTage, luteal, laenge };
}

// Soll die Phase im Tagesbereich stehen? (Standard: ja)
export function imTagesbereich() {
  return store.einstellung('zyklus.imTagesbereich', true) !== false;
}


