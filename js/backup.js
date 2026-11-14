// Backup: verschlüsselte Datei erstellen, teilen und wiederherstellen.
// Verschlüsselt wird mit der im Browser eingebauten Kryptografie (Web Crypto):
//   Schlüssel aus dem Passwort: PBKDF2 mit SHA-256
//   Verschlüsselung:            AES-256-GCM
// Das Passwort selbst wird nirgends gespeichert. Auf dem Gerät liegt nur der
// daraus berechnete Schlüssel, damit das wöchentliche Backup mit einem Tipp geht.

import * as store from './store.js';
import { datumLokal, tageSeit } from './hilfen.js';

const FORMAT = 'planner-backup';
const FORMAT_VERSION = 1;
const ITERATIONEN = 600000;
const PRUEFTEXT = 'planner-pruefwert';
export const ERINNERUNG_TAGE = 7;
export const PASSWORT_MINDESTLAENGE = 8;

// Einstellungen, die mit ins Backup wandern (der Schlüssel gehört nicht dazu).
const EINSTELLUNGEN_IM_BACKUP = ['schrift', 'kalender.ansicht'];

const kodierer = new TextEncoder();
const dekodierer = new TextDecoder();

// ---------- Hilfen ----------

function zuBase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = '';
  for (let i = 0; i < b.length; i += 0x8000) {
    text += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

function vonBase64(text) {
  const roh = atob(text);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

async function leiteSchluesselAb(passwort, salt, iterationen) {
  const basis = await crypto.subtle.importKey('raw', kodierer.encode(passwort), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iterationen, hash: 'SHA-256' },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function verschluessele(schluessel, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const daten = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, schluessel, bytes);
  return { iv: zuBase64(iv), daten: zuBase64(daten) };
}

async function entschluesseleBytes(schluessel, iv, daten) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: vonBase64(iv) }, schluessel, vonBase64(daten));
}

function fehlerMitArt(art, text) {
  const fehler = new Error(text);
  fehler.art = art;
  return fehler;
}

// ---------- Passwort ----------

export function passwortGesetzt() {
  return Boolean(store.einstellung('backup.schluessel'));
}

// Manche Browser können den Schlüssel nicht dauerhaft ablegen. Dann fragt die
// App das Passwort bei jedem Export ab.
export function brauchtPasswortFuerExport() {
  const ablage = store.einstellung('backup.schluessel');
  return Boolean(ablage) && !ablage.schluessel;
}

async function speichereSchluessel(schluessel, salt, iterationen) {
  const pruef = await verschluessele(schluessel, kodierer.encode(PRUEFTEXT));
  const ablage = { schluessel, salt: zuBase64(salt), iterationen, pruef };
  try {
    await store.setzeEinstellung('backup.schluessel', ablage);
  } catch (fehler) {
    await store.setzeEinstellung('backup.schluessel', { ...ablage, schluessel: null });
  }
}

export async function setzePasswort(passwort) {
  if (passwort.length < PASSWORT_MINDESTLAENGE) {
    throw fehlerMitArt('zu-kurz', `Das Passwort braucht mindestens ${PASSWORT_MINDESTLAENGE} Zeichen.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const schluessel = await leiteSchluesselAb(passwort, salt, ITERATIONEN);
  await speichereSchluessel(schluessel, salt, ITERATIONEN);
}

// Prüft, ob ein eingegebenes Passwort das Backup-Passwort ist
// (wird später auch zum Zurücksetzen der Notiz-PIN gebraucht).
export async function pruefePasswort(passwort) {
  const ablage = store.einstellung('backup.schluessel');
  if (!ablage) return false;
  try {
    const schluessel = await leiteSchluesselAb(passwort, vonBase64(ablage.salt), ablage.iterationen);
    const klar = await entschluesseleBytes(schluessel, ablage.pruef.iv, ablage.pruef.daten);
    return dekodierer.decode(klar) === PRUEFTEXT;
  } catch (fehler) {
    return false;
  }
}

// ---------- Status und Erinnerung ----------

export function backupStatus() {
  const eingerichtet = passwortGesetzt();
  const letztesAm = store.einstellung('backup.letztesAm');
  const tage = letztesAm ? tageSeit(letztesAm) : null;
  const faellig = eingerichtet && (tage === null || tage >= ERINNERUNG_TAGE);
  return { eingerichtet, letztesAm, tage, faellig };
}

export async function markiereGesichert() {
  await store.setzeEinstellung('backup.letztesAm', new Date().toISOString());
}

// ---------- Export ----------

// Erstellt die verschlüsselte Backup-Datei. "passwort" ist nur nötig, wenn der
// Schlüssel nicht auf dem Gerät abgelegt werden konnte.
export async function erstelleBackup(passwort) {
  const ablage = store.einstellung('backup.schluessel');
  if (!ablage) throw fehlerMitArt('kein-passwort', 'Es ist noch kein Backup-Passwort festgelegt.');

  let schluessel = ablage.schluessel;
  if (!schluessel) {
    if (!passwort || !(await pruefePasswort(passwort))) {
      throw fehlerMitArt('falsches-passwort', 'Das Passwort stimmt nicht.');
    }
    schluessel = await leiteSchluesselAb(passwort, vonBase64(ablage.salt), ablage.iterationen);
  }

  const einstellungen = {};
  EINSTELLUNGEN_IM_BACKUP.forEach((name) => {
    const wert = store.einstellung(name);
    if (wert !== null) einstellungen[name] = wert;
  });

  const erstelltAm = new Date().toISOString();
  const datensaetze = store.alleDatensaetze();
  const inhalt = { schemaVersion: store.SCHEMA_VERSION, exportiertAm: erstelltAm, datensaetze, einstellungen };
  const geheim = await verschluessele(schluessel, kodierer.encode(JSON.stringify(inhalt)));

  const umschlag = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: store.SCHEMA_VERSION,
    erstelltAm,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterationen: ablage.iterationen, salt: ablage.salt },
    verschluesselung: { name: 'AES-GCM', iv: geheim.iv },
    daten: geheim.daten,
  };

  const text = JSON.stringify(umschlag);
  const name = `Planner-Backup-${datumLokal()}`;
  return {
    text,
    name,
    groesse: kodierer.encode(text).length,
    anzahl: datensaetze.filter((d) => !d.geloeschtAm).length,
  };
}

function alsDatei(backup, variante) {
  if (variante === 'text') {
    return new File([backup.text], `${backup.name}.txt`, { type: 'text/plain' });
  }
  return new File([backup.text], `${backup.name}.planerbackup`, { type: 'application/octet-stream' });
}

// Kann das Gerät Dateien über das Teilen-Menü weitergeben?
export function kannTeilen(backup) {
  if (!navigator.canShare || !navigator.share) return false;
  return ['eigen', 'text'].some((variante) => {
    try { return navigator.canShare({ files: [alsDatei(backup, variante)] }); } catch (fehler) { return false; }
  });
}

// Öffnet das Teilen-Menü. Ergebnis: 'geteilt' oder 'abgebrochen'.
export async function teileBackup(backup) {
  let datei = alsDatei(backup, 'eigen');
  if (!navigator.canShare({ files: [datei] })) datei = alsDatei(backup, 'text');
  try {
    await navigator.share({ files: [datei] });
    return 'geteilt';
  } catch (fehler) {
    if (fehler && fehler.name === 'AbortError') return 'abgebrochen';
    throw fehler;
  }
}

// Ausweichweg: Datei herunterladen.
export function ladeBackupHerunter(backup) {
  const datei = alsDatei(backup, 'eigen');
  const adresse = URL.createObjectURL(datei);
  const link = document.createElement('a');
  link.href = adresse;
  link.download = datei.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 60000);
}

// ---------- Import ----------

// Liest eine Backup-Datei und prüft, ob sie zum Planner gehört.
export async function leseBackupDatei(datei) {
  let umschlag;
  try {
    umschlag = JSON.parse(await datei.text());
  } catch (fehler) {
    throw fehlerMitArt('keine-backup-datei', 'Das ist keine Backup-Datei des Planners.');
  }
  if (!umschlag || umschlag.format !== FORMAT || !umschlag.kdf || !umschlag.verschluesselung || !umschlag.daten) {
    throw fehlerMitArt('keine-backup-datei', 'Das ist keine Backup-Datei des Planners.');
  }
  if (umschlag.formatVersion > FORMAT_VERSION || umschlag.schemaVersion > store.SCHEMA_VERSION) {
    throw fehlerMitArt('zu-neu', 'Dieses Backup stammt aus einer neueren Version der App. Aktualisiere zuerst die App.');
  }
  return umschlag;
}

// Entschlüsselt ein Backup mit dem eingegebenen Passwort.
export async function entschluesseleBackup(umschlag, passwort) {
  const salt = vonBase64(umschlag.kdf.salt);
  const schluessel = await leiteSchluesselAb(passwort, salt, umschlag.kdf.iterationen);
  let klar;
  try {
    klar = await entschluesseleBytes(schluessel, umschlag.verschluesselung.iv, umschlag.daten);
  } catch (fehler) {
    throw fehlerMitArt('falsches-passwort', 'Das Passwort passt nicht zu diesem Backup.');
  }
  const inhalt = JSON.parse(dekodierer.decode(klar));
  const datensaetze = store.migriere(inhalt.datensaetze || [], inhalt.schemaVersion);
  return {
    datensaetze,
    einstellungen: inhalt.einstellungen || {},
    erstelltAm: umschlag.erstelltAm,
    zaehler: store.zaehleNachTyp(datensaetze),
    schluessel,
    salt,
    iterationen: umschlag.kdf.iterationen,
  };
}

// Ersetzt alle Daten der App durch den Inhalt des Backups.
export async function stelleWiederHer(entschluesselt) {
  await store.ersetzeBestand(entschluesselt.datensaetze);
  for (const name of EINSTELLUNGEN_IM_BACKUP) {
    if (entschluesselt.einstellungen[name] !== undefined) {
      await store.setzeEinstellung(name, entschluesselt.einstellungen[name]);
    }
  }
  // Das Passwort dieses Backups gilt ab jetzt als Backup-Passwort.
  await speichereSchluessel(entschluesselt.schluessel, entschluesselt.salt, entschluesselt.iterationen);
  await store.setzeEinstellung('backup.letztesAm', entschluesselt.erstelltAm);
}
