// Notizen und Messwert-Tracker.
//
// Eine Notiz (Typ notiz):
//   { titel, art: 'text' | 'tracker', kategorieId, elternId, gesperrt,
//     bloecke: [...],        // nur bei art 'text'
//     einheit: 'kg' }        // nur bei art 'tracker'
//   elternId: Eine Unternotiz verweist auf ihre Notiz. Es gibt höchstens zwei Ebenen.
//
// Der Inhalt einer Textnotiz besteht aus Blöcken:
//   { id, art: 'text', text }            Text mit einfacher Formatierung (siehe bausteine/notiz-text.js)
//   { id, art: 'checkliste', punkte }    Punkte der Form { id, text, erledigt }
//   { id, art: 'tabelle', zeilen, kopf } zeilen: Liste von Zeilen, jede eine Liste von Texten
//
// Ein Messwert (Typ messwert): { notizId, datum, wert }. Je Tracker und Tag höchstens einer.

import * as store from './store.js';
import { neueId } from './hilfen.js';
import { schlicht } from './bausteine/notiz-text.js';

function vorhanden(id) {
  const n = id ? store.hole(id) : null;
  return n && !n.geloeschtAm ? n : null;
}

export function alle() {
  return store.liste('notiz');
}

// Die Notiz, zu der eine Unternotiz gehört (oder null).
export function elternVon(notiz) {
  return vorhanden(notiz.elternId);
}

// Notizen der ersten Ebene, zuletzt geänderte zuerst.
export function oberste() {
  return alle()
    .filter((n) => !elternVon(n))
    .sort((a, b) => (a.geaendertAm < b.geaendertAm ? 1 : -1));
}

export function kinderVon(notiz) {
  return alle()
    .filter((n) => n.elternId === notiz.id)
    .sort((a, b) => (a.erstelltAm < b.erstelltAm ? -1 : 1));
}

// Gesperrt ist eine Notiz selbst oder über die Notiz, zu der sie gehört.
export function istGesperrt(notiz) {
  if (notiz.gesperrt) return true;
  const eltern = elternVon(notiz);
  return Boolean(eltern && eltern.gesperrt);
}

// Die Kategorie einer Unternotiz ist die ihrer Notiz.
export function kategorieVon(notiz) {
  const eltern = elternVon(notiz);
  return vorhanden((eltern || notiz).kategorieId);
}

export function neuerBlock(art) {
  if (art === 'checkliste') return { id: neueId(), art, punkte: [] };
  if (art === 'tabelle') return { id: neueId(), art, kopf: true, zeilen: [['', ''], ['', '']] };
  return { id: neueId(), art: 'text', text: '' };
}

export function neu({ art = 'text', titel, kategorieId = null, elternId = null, einheit = '' }) {
  return store.anlegen('notiz', {
    titel,
    art,
    kategorieId: elternId ? null : kategorieId,
    elternId,
    gesperrt: false,
    bloecke: art === 'text' ? [neuerBlock('text')] : [],
    einheit: art === 'tracker' ? einheit : '',
  });
}

// Löscht eine Notiz samt Unternotizen (Papierkorb). Gibt eine Funktion zum Rückgängigmachen zurück.
export function loesche(notiz) {
  const ids = [notiz.id, ...kinderVon(notiz).map((k) => k.id)];
  ids.forEach((id) => store.loeschen(id));
  return () => ids.forEach((id) => store.wiederherstellen(id));
}

// Der gesamte Text einer Notiz (für die Suche).
export function textVon(notiz) {
  const teile = [];
  (notiz.bloecke || []).forEach((b) => {
    if (b.art === 'text') teile.push(schlicht(b.text));
    else if (b.art === 'checkliste') b.punkte.forEach((p) => teile.push(p.text));
    else if (b.art === 'tabelle') b.zeilen.forEach((z) => teile.push(z.join(' ')));
  });
  return teile.join('\n');
}

// Die erste Textzeile als Vorschau in Listen.
export function auszug(notiz) {
  const zeile = textVon(notiz).split('\n').map((z) => z.trim()).find((z) => z);
  if (!zeile) return '';
  return zeile.length > 90 ? `${zeile.slice(0, 90)}…` : zeile;
}

export function istLeer(notiz) {
  return !textVon(notiz).trim();
}

// ---------- Messwerte ----------

export function messwerte(notiz) {
  return store.liste('messwert')
    .filter((m) => m.notizId === notiz.id)
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

export function letzterWert(notiz) {
  const werte = messwerte(notiz);
  return werte.length ? werte[werte.length - 1] : null;
}

// Trägt einen Wert ein. Gibt es an dem Tag schon einen, wird er ersetzt.
// Rückgabe: 'neu' oder 'ersetzt'.
export function setzeMesswert(notiz, datum, wert, ausser = null) {
  const sauber = Math.round(Number(wert) * 100) / 100;
  const da = messwerte(notiz).find((m) => m.datum === datum && m.id !== ausser);
  if (da) {
    store.aendern(da.id, { wert: sauber });
    if (ausser) store.entfernen(ausser);
    return 'ersetzt';
  }
  if (ausser) store.aendern(ausser, { datum, wert: sauber });
  else store.anlegen('messwert', { notizId: notiz.id, datum, wert: sauber });
  return 'neu';
}

// Entfernt Messwerte, deren Tracker es endgültig nicht mehr gibt (beim Start der App).
export function raeumeAuf() {
  const verwaist = store.liste('messwert').filter((m) => !store.hole(m.notizId)).map((m) => m.id);
  if (verwaist.length) store.entfernen(verwaist);
}

// 72.4 -> "72,4"
export function zahlText(zahl) {
  return String(Math.round(zahl * 100) / 100).replace('.', ',');
}
