// Termine: einmalig oder wiederkehrend, mit Uhrzeit oder ganztägig, auch über mehrere Tage.
//
// Ein Termin sieht so aus:
//   { titel, datum: '2026-11-14', bisDatum: '2026-11-14', ganztaegig: false,
//     von: '09:00', bis: '10:00', kategorieId,
//     wiederholung: null | { n: 1, einheit: 'tage' | 'wochen' | 'monate' | 'jahre' },
//     wiederholtBis: null | '2027-01-31', ausnahmen: ['2026-12-24'] }
// Wiederholungen werden nicht einzeln gespeichert, sondern für den sichtbaren
// Zeitraum berechnet. "ausnahmen" sind einzelne gelöschte Termine einer Reihe.

import * as store from './store.js';
import { heute, plusTage, plusMonate, tageZwischen, zeitZuMin, minZuZeit, jetztMin } from './hilfen.js';

export function alle() {
  return store.liste('termin');
}

// Vorbelegung für einen neuen Termin: nächste volle Stunde, eine Stunde lang.
export function leererTermin(vorgaben = {}) {
  const start = Math.min(22 * 60, Math.ceil((jetztMin() + 1) / 60) * 60);
  return {
    titel: '',
    datum: heute(),
    bisDatum: vorgaben.datum || heute(),
    ganztaegig: false,
    von: minZuZeit(start),
    bis: minZuZeit(start + 60),
    kategorieId: null,
    wiederholung: null,
    wiederholtBis: null,
    ausnahmen: [],
    ...vorgaben,
  };
}

export function neu(felder) {
  return store.anlegen('termin', { ...leererTermin(), ...felder });
}

// Beginn des k-ten Termins einer Reihe. Gerechnet wird immer vom ersten Termin aus,
// damit sich der Tag im Monat nicht verschiebt (31. Januar, 28. Februar, 31. März).
function beginnNr(termin, k) {
  const { n, einheit } = termin.wiederholung;
  if (einheit === 'tage') return plusTage(termin.datum, k * n);
  if (einheit === 'wochen') return plusTage(termin.datum, k * n * 7);
  if (einheit === 'monate') return plusMonate(termin.datum, k * n);
  return plusMonate(termin.datum, k * n * 12);
}

// Alle Vorkommen eines Termins, die den Zeitraum von..bis berühren.
// Ergebnis: [{ termin, start, ende }] mit Kalendertagen.
export function vorkommen(termin, von, bis) {
  const dauerTage = Math.max(0, tageZwischen(termin.datum, termin.bisDatum));
  if (!termin.wiederholung) {
    if (termin.datum > bis || termin.bisDatum < von) return [];
    return [{ termin, start: termin.datum, ende: termin.bisDatum }];
  }

  // Ungefähr dort einsteigen, wo der Zeitraum beginnt, statt beim ersten Termin.
  const { n, einheit } = termin.wiederholung;
  const tageBisVon = tageZwischen(termin.datum, von) - dauerTage;
  const schrittTage = einheit === 'tage' ? n : einheit === 'wochen' ? n * 7 : einheit === 'monate' ? n * 31 : n * 366;
  let k = Math.max(0, Math.floor(tageBisVon / schrittTage) - 1);

  const ergebnis = [];
  const ausnahmen = termin.ausnahmen || [];
  for (let wache = 0; wache < 5000; wache += 1, k += 1) {
    const start = beginnNr(termin, k);
    if (start > bis) break;
    if (termin.wiederholtBis && start > termin.wiederholtBis) break;
    const ende = plusTage(start, dauerTage);
    if (ende >= von && !ausnahmen.includes(start)) ergebnis.push({ termin, start, ende });
  }
  return ergebnis;
}

// Alle Vorkommen aller Termine im Zeitraum.
export function vorkommenIm(von, bis) {
  const ergebnis = [];
  alle().forEach((termin) => ergebnis.push(...vorkommen(termin, von, bis)));
  return ergebnis;
}

// Was an einem Tag im Kalender steht:
//   ganztags – ganztägige Termine (auch mehrtägige, an jedem ihrer Tage)
//   zeitlich – Termine mit Uhrzeit, zugeschnitten auf diesen Tag (vonMin, bisMin)
export function eintraegeAm(tag, liste = vorkommenIm(tag, tag)) {
  const ganztags = [];
  const zeitlich = [];
  liste.forEach((v) => {
    if (v.start > tag || v.ende < tag) return;
    if (v.termin.ganztaegig) {
      ganztags.push(v);
      return;
    }
    const vonMin = v.start === tag ? zeitZuMin(v.termin.von) : 0;
    let bisMin = v.ende === tag ? zeitZuMin(v.termin.bis) : 1440;
    // Endet ein Termin genau um Mitternacht, gehört der Folgetag nicht mehr dazu.
    if (v.ende === tag && v.start < tag && bisMin === 0) return;
    if (bisMin <= vonMin) bisMin = Math.min(1440, vonMin + 30);
    zeitlich.push({ ...v, vonMin, bisMin });
  });
  ganztags.sort((a, b) => a.termin.titel.localeCompare(b.termin.titel, 'de'));
  zeitlich.sort((a, b) => a.vonMin - b.vonMin || a.bisMin - b.bisMin);
  return { ganztags, zeitlich };
}

// "09:00 – 10:00", "Ganztägig", bei mehrtägigen mit Hinweis auf Beginn oder Ende.
export function zeitText(v, tag) {
  if (v.termin.ganztaegig) return 'Ganztägig';
  const beginntHeute = v.start === tag;
  const endetHeute = v.ende === tag;
  if (beginntHeute && endetHeute) return `${v.termin.von} – ${v.termin.bis}`;
  if (beginntHeute) return `ab ${v.termin.von}`;
  if (endetHeute) return `bis ${v.termin.bis}`;
  return 'Ganztägig';
}

// "Jede Woche", "Alle 2 Monate", "Jedes Jahr"
export function wiederholungText(wiederholung) {
  if (!wiederholung) return '';
  const { n, einheit } = wiederholung;
  const einzahl = { tage: 'Jeden Tag', wochen: 'Jede Woche', monate: 'Jeden Monat', jahre: 'Jedes Jahr' };
  const mehrzahl = { tage: 'Tage', wochen: 'Wochen', monate: 'Monate', jahre: 'Jahre' };
  return n === 1 ? einzahl[einheit] : `Alle ${n} ${mehrzahl[einheit]}`;
}

// Entfernt einen einzelnen Termin aus einer Reihe. Gibt eine Funktion zum Rückgängigmachen zurück.
export function loescheVorkommen(termin, start) {
  const vorher = termin.ausnahmen || [];
  store.aendern(termin.id, { ausnahmen: [...vorher, start] });
  return () => store.aendern(termin.id, { ausnahmen: vorher });
}
