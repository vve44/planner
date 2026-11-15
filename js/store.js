// Der Datenbestand der App im Arbeitsspeicher.
// Beim Start wird alles aus der Datenbank geladen. Jede Änderung wird sofort
// im Speicher sichtbar und gleichzeitig in die Datenbank geschrieben.

import * as db from './db.js';
import { neueId, jetztIso } from './hilfen.js';

// Version des Datenmodells. Steigt, wenn eine Etappe vorhandene Daten umstellen muss.
export const SCHEMA_VERSION = 1;

// Umstellungen für ältere Datenbestände: { 2: (datensaetze) => datensaetze, … }
// Sie laufen beim Start und beim Import älterer Backups.
const MIGRATIONEN = {};

// Gelöschtes bleibt so viele Tage im Papierkorb.
export const PAPIERKORB_TAGE = 30;

const zustand = {
  bereit: false,
  datensaetze: new Map(),
  einstellungen: {},
};

const hoerer = new Set();
let fehlerMelder = (fehler) => console.error(fehler);

// Während eines Stapels (viele Änderungen auf einmal) wird erst am Ende neu gezeichnet.
let stapelTiefe = 0;
let stapelOffen = false;

function benachrichtige() {
  if (stapelTiefe > 0) {
    stapelOffen = true;
    return;
  }
  hoerer.forEach((fn) => fn());
}

// Zählt die Änderungen je Typ. Damit lässt sich billig feststellen, ob sich an bestimmten
// Typen etwas getan hat (zum Beispiel für den Abgleich der EP).
const aenderungen = {};
function zaehle(typ) {
  aenderungen[typ] = (aenderungen[typ] || 0) + 1;
}

// Summe der Änderungen an diesen Typen seit dem Start (plus alles, was den ganzen Bestand ersetzt hat).
export function aenderungenAn(typen) {
  return typen.reduce((summe, typ) => summe + (aenderungen[typ] || 0), aenderungen['*'] || 0);
}

// Führt mehrere Änderungen aus und meldet sie den Ansichten als eine einzige.
export function stapel(fn) {
  stapelTiefe += 1;
  try {
    return fn();
  } finally {
    stapelTiefe -= 1;
    if (stapelTiefe === 0 && stapelOffen) {
      stapelOffen = false;
      benachrichtige();
    }
  }
}

// Ansichten melden sich hier an und werden bei jeder Änderung neu gezeichnet.
export function abonniere(fn) {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

// Wohin Speicherfehler gemeldet werden (die App zeigt dann einen Hinweis).
export function beiSpeicherfehler(fn) {
  fehlerMelder = fn;
}

function sichere(versprechen) {
  versprechen.catch((fehler) => fehlerMelder(fehler));
}

// Bringt einen Datenbestand auf den aktuellen Stand des Datenmodells.
export function migriere(datensaetze, vonVersion) {
  let ergebnis = datensaetze;
  for (let v = (vonVersion || 1) + 1; v <= SCHEMA_VERSION; v += 1) {
    if (MIGRATIONEN[v]) ergebnis = MIGRATIONEN[v](ergebnis);
  }
  return ergebnis;
}

export async function initialisiere() {
  const [datensaetze, einstellungen] = await Promise.all([db.ladeAlleDatensaetze(), db.ladeEinstellungen()]);
  zustand.einstellungen = einstellungen;

  let bestand = datensaetze;
  const gespeicherteVersion = einstellungen.schemaVersion || SCHEMA_VERSION;
  if (gespeicherteVersion < SCHEMA_VERSION) {
    bestand = migriere(bestand, gespeicherteVersion);
    await db.ersetzeAlleDatensaetze(bestand);
  }
  if (einstellungen.schemaVersion !== SCHEMA_VERSION) {
    zustand.einstellungen.schemaVersion = SCHEMA_VERSION;
    await db.schreibeEinstellung('schemaVersion', SCHEMA_VERSION);
  }

  // Papierkorb aufräumen: was länger als 30 Tage gelöscht ist, wird endgültig entfernt.
  const grenze = Date.now() - PAPIERKORB_TAGE * 86400000;
  const abgelaufen = bestand.filter((d) => d.geloeschtAm && new Date(d.geloeschtAm).getTime() < grenze);
  if (abgelaufen.length) {
    const ids = new Set(abgelaufen.map((d) => d.id));
    bestand = bestand.filter((d) => !ids.has(d.id));
    await db.entferneDatensaetze([...ids]);
  }

  zustand.datensaetze = new Map(bestand.map((d) => [d.id, d]));
  zaehle('*');
  zustand.bereit = true;
  benachrichtige();
}

// ---------- Datensätze ----------

// Alle Einträge eines Typs, standardmäßig ohne Gelöschtes.
export function liste(typ, { geloeschte = false } = {}) {
  const ergebnis = [];
  zustand.datensaetze.forEach((d) => {
    if (d.typ !== typ) return;
    if (!geloeschte && d.geloeschtAm) return;
    if (geloeschte && !d.geloeschtAm) return;
    ergebnis.push(d);
  });
  return ergebnis;
}

export function hole(id) {
  return zustand.datensaetze.get(id) || null;
}

export function alleDatensaetze() {
  return [...zustand.datensaetze.values()];
}

// Anzahl der Einträge je Typ (ohne Gelöschtes), z. B. für die Backup-Vorschau.
export function zaehleNachTyp(datensaetze = alleDatensaetze()) {
  const zaehler = {};
  datensaetze.forEach((d) => {
    if (d.geloeschtAm) return;
    zaehler[d.typ] = (zaehler[d.typ] || 0) + 1;
  });
  return zaehler;
}

export function anlegen(typ, felder) {
  const jetzt = jetztIso();
  const datensatz = { ...felder, id: neueId(), typ, erstelltAm: jetzt, geaendertAm: jetzt, geloeschtAm: null };
  zustand.datensaetze.set(datensatz.id, datensatz);
  zaehle(typ);
  sichere(db.schreibeDatensatz(datensatz));
  benachrichtige();
  return datensatz;
}

export function aendern(id, felder) {
  const alt = zustand.datensaetze.get(id);
  if (!alt) return null;
  const neu = { ...alt, ...felder, id: alt.id, typ: alt.typ, erstelltAm: alt.erstelltAm, geaendertAm: jetztIso() };
  zustand.datensaetze.set(id, neu);
  zaehle(neu.typ);
  sichere(db.schreibeDatensatz(neu));
  benachrichtige();
  return neu;
}

// Löschen heißt: in den Papierkorb legen.
export function loeschen(id) {
  return aendern(id, { geloeschtAm: jetztIso() });
}

export function wiederherstellen(id) {
  return aendern(id, { geloeschtAm: null });
}

// Entfernt Einträge endgültig (ohne Papierkorb).
export function entfernen(ids) {
  const liste = Array.isArray(ids) ? ids : [ids];
  liste.forEach((id) => {
    const alt = zustand.datensaetze.get(id);
    if (alt) zaehle(alt.typ);
    zustand.datensaetze.delete(id);
  });
  sichere(db.entferneDatensaetze(liste));
  benachrichtige();
}

// Alles, was im Papierkorb liegt, neueste Löschung zuerst.
export function papierkorb() {
  return alleDatensaetze()
    .filter((d) => d.geloeschtAm)
    .sort((a, b) => (a.geloeschtAm < b.geloeschtAm ? 1 : -1));
}

// ---------- Einstellungen ----------

export function einstellung(name, standard = null) {
  const wert = zustand.einstellungen[name];
  return wert === undefined ? standard : wert;
}

export async function setzeEinstellung(name, wert) {
  zustand.einstellungen[name] = wert;
  benachrichtige();
  await db.schreibeEinstellung(name, wert);
}

// ---------- Wiederherstellen ----------

// Ersetzt den gesamten Datenbestand durch den Inhalt eines Backups.
export async function ersetzeBestand(datensaetze) {
  await db.ersetzeAlleDatensaetze(datensaetze);
  zustand.datensaetze = new Map(datensaetze.map((d) => [d.id, d]));
  zaehle('*');
  benachrichtige();
}

// Zeichnet alle Ansichten neu, ohne dass sich Daten geändert haben (zum Beispiel beim Tageswechsel).
export function zeichneNeu() {
  benachrichtige();
}

export function istBereit() {
  return zustand.bereit;
}
