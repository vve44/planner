// Regeln für Wiederholungen: Wann ist eine wiederkehrende Aufgabe das nächste Mal dran?
//
// Eine Regel sieht so aus:
//   { art: 'taeglich' }
//   { art: 'wochentage', wochentage: [4] }            jeden Donnerstag
//   { art: 'intervall', n: 2, einheit: 'wochen' }     alle 2 Wochen
// Dazu kommt der Modus:
//   'fest'          – der Rhythmus folgt dem Kalender (jeden Donnerstag bleibt Donnerstag)
//   'abErledigung'  – gezählt wird ab dem Tag, an dem die Aufgabe abgehakt wurde

import { heute, plusTage, plusMonate, wochentagNr } from './hilfen.js';
import { WOCHENTAGE } from './typen.js';

export function standardRegel(datum) {
  return { art: 'wochentage', wochentage: [wochentagNr(datum || heute())], n: 2, einheit: 'wochen' };
}

export function regelGueltig(regel) {
  if (!regel) return false;
  if (regel.art === 'taeglich') return true;
  if (regel.art === 'wochentage') return Array.isArray(regel.wochentage) && regel.wochentage.length > 0;
  if (regel.art === 'intervall') return Number.isInteger(regel.n) && regel.n >= 1 && ['tage', 'wochen', 'monate'].includes(regel.einheit);
  return false;
}

// Der nächste Termin nach einem Termin der Reihe.
function schritt(regel, datum) {
  if (regel.art === 'wochentage') {
    for (let i = 1; i <= 7; i += 1) {
      const kandidat = plusTage(datum, i);
      if (regel.wochentage.includes(wochentagNr(kandidat))) return kandidat;
    }
    return plusTage(datum, 7);
  }
  if (regel.art === 'intervall') {
    if (regel.einheit === 'monate') return plusMonate(datum, regel.n);
    return plusTage(datum, regel.einheit === 'wochen' ? regel.n * 7 : regel.n);
  }
  return plusTage(datum, 1);
}

// Plandatum der nächsten Aufgabe einer Wiederholung.
//   plandatum   – Plandatum der Aufgabe, die gerade abgehakt (oder übersprungen) wird
//   stichtag    – der Tag, an dem das passiert (normalerweise heute)
// Im festen Rhythmus werden verpasste Termine übersprungen: Es entsteht immer nur
// eine nächste Aufgabe, und zwar für den nächsten Termin nach dem Stichtag.
export function naechstesPlandatum(regel, modus, plandatum, stichtag = heute()) {
  if (modus === 'abErledigung') return schritt(regel, stichtag);
  let datum = schritt(regel, plandatum || stichtag);
  let wache = 0;
  while (datum <= stichtag && wache < 4000) {
    datum = schritt(regel, datum);
    wache += 1;
  }
  return datum;
}

// Regel in Worten: "Jeden Donnerstag", "Alle 2 Wochen, ab Erledigung"
export function beschreibeRegel(regel, modus) {
  let text = 'Täglich';
  if (regel.art === 'wochentage') {
    const tage = [...regel.wochentage].sort((a, b) => a - b);
    if (tage.length === 7) text = 'Täglich';
    else if (tage.length === 1) {
      const tag = WOCHENTAGE.find((w) => w.nr === tage[0]);
      text = `Jeden ${tag.lang}`;
    } else if (tage.join() === '1,2,3,4,5') text = 'Montag bis Freitag';
    else text = tage.map((nr) => WOCHENTAGE.find((w) => w.nr === nr).kurz).join(', ');
  } else if (regel.art === 'intervall') {
    const einzahl = { tage: 'Täglich', wochen: 'Jede Woche', monate: 'Jeden Monat' };
    const mehrzahl = { tage: 'Tage', wochen: 'Wochen', monate: 'Monate' };
    text = regel.n === 1 ? einzahl[regel.einheit] : `Alle ${regel.n} ${mehrzahl[regel.einheit]}`;
  }
  return modus === 'abErledigung' ? `${text}, ab Erledigung` : text;
}
