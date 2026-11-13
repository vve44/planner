// Zugriff auf die Browser-Datenbank (IndexedDB) des Geräts.
// Es gibt zwei Ablagen:
//   "datensaetze"   – alle Einträge der App (Kategorien, später Aufgaben, Termine …),
//                     jeder mit eindeutiger "id" und einem "typ".
//   "einstellungen" – einzelne Werte unter einem Namen (z. B. gewählte Schrift).
// Neue Bereiche brauchen dadurch keine Änderung an der Datenbank selbst.

const DB_NAME = 'planner';
const DB_VERSION = 1;

let verbindung = null;

function oeffne() {
  if (verbindung) return verbindung;
  verbindung = new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains('datensaetze')) {
        const ablage = db.createObjectStore('datensaetze', { keyPath: 'id' });
        ablage.createIndex('typ', 'typ', { unique: false });
      }
      if (!db.objectStoreNames.contains('einstellungen')) {
        db.createObjectStore('einstellungen');
      }
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
    anfrage.onblocked = () => fehler(new Error('Die Datenbank ist in einem anderen Fenster geöffnet.'));
  });
  return verbindung;
}

// Führt mehrere Schritte als eine Einheit aus: entweder alle oder keiner.
async function vorgang(ablagen, modus, arbeit) {
  const db = await oeffne();
  return new Promise((ok, fehler) => {
    const t = db.transaction(ablagen, modus);
    let ergebnis;
    t.oncomplete = () => ok(ergebnis);
    t.onerror = () => fehler(t.error);
    t.onabort = () => fehler(t.error || new Error('Speichern abgebrochen.'));
    ergebnis = arbeit(t);
  });
}

function alsPromise(anfrage) {
  return new Promise((ok, fehler) => {
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

export async function ladeAlleDatensaetze() {
  const db = await oeffne();
  return alsPromise(db.transaction('datensaetze', 'readonly').objectStore('datensaetze').getAll());
}

export function schreibeDatensatz(datensatz) {
  return vorgang('datensaetze', 'readwrite', (t) => {
    t.objectStore('datensaetze').put(datensatz);
  });
}

export function entferneDatensaetze(ids) {
  return vorgang('datensaetze', 'readwrite', (t) => {
    const ablage = t.objectStore('datensaetze');
    ids.forEach((id) => ablage.delete(id));
  });
}

// Ersetzt den gesamten Bestand (beim Wiederherstellen eines Backups).
export function ersetzeAlleDatensaetze(datensaetze) {
  return vorgang('datensaetze', 'readwrite', (t) => {
    const ablage = t.objectStore('datensaetze');
    ablage.clear();
    datensaetze.forEach((d) => ablage.put(d));
  });
}

export async function ladeEinstellungen() {
  const db = await oeffne();
  const ablage = db.transaction('einstellungen', 'readonly').objectStore('einstellungen');
  const [namen, werte] = await Promise.all([alsPromise(ablage.getAllKeys()), alsPromise(ablage.getAll())]);
  const ergebnis = {};
  namen.forEach((name, i) => { ergebnis[name] = werte[i]; });
  return ergebnis;
}

export function schreibeEinstellung(name, wert) {
  return vorgang('einstellungen', 'readwrite', (t) => {
    t.objectStore('einstellungen').put(wert, name);
  });
}

export function entferneEinstellung(name) {
  return vorgang('einstellungen', 'readwrite', (t) => {
    t.objectStore('einstellungen').delete(name);
  });
}
