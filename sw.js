// Service Worker: speichert alle App-Dateien auf dem Gerät, damit der Planner
// ohne Netz startet. Deine Daten liegen NICHT hier, sondern in der
// Browser-Datenbank (IndexedDB) und bleiben bei Updates erhalten.

// Bei jeder neuen Etappe wird diese Versionsnummer erhöht. Daran erkennt das
// Handy, dass es neue Dateien gibt.
const VERSION = 'planner-3.0.0';

// Alle Dateien der App. Die Liste wird beim Zusammenstellen automatisch gefüllt.
/* DATEIEN-ANFANG */
const DATEIEN = [
  './',
  'bibliothek/preact-htm.js',
  'css/app.css',
  'fonts/outfit.woff2',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'js/aktualisierung.js',
  'js/ansichten/aufgaben.js',
  'js/ansichten/einstellungen.js',
  'js/ansichten/heute.js',
  'js/ansichten/kategorien.js',
  'js/ansichten/papierkorb.js',
  'js/ansichten/platzhalter.js',
  'js/ansichten/pools.js',
  'js/ansichten/routinen.js',
  'js/ansichten/tagesroutinen.js',
  'js/ansichten/uebersicht.js',
  'js/app.js',
  'js/aufgaben.js',
  'js/backup.js',
  'js/bausteine/aufgabe-blatt.js',
  'js/bausteine/aufgabe-zeile.js',
  'js/bausteine/backup-dialoge.js',
  'js/bausteine/felder.js',
  'js/bausteine/fenster.js',
  'js/bausteine/icon-wahl.js',
  'js/bausteine/icon.js',
  'js/db.js',
  'js/haken.js',
  'js/hilfen.js',
  'js/icon-daten.js',
  'js/pools.js',
  'js/regeln.js',
  'js/routinen.js',
  'js/store.js',
  'js/tagesroutinen.js',
  'js/typen.js',
  'js/version.js',
  'manifest.webmanifest',
];
/* DATEIEN-ENDE */

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(VERSION).then((speicher) =>
      // 'reload' umgeht den Zwischenspeicher des Browsers, damit wirklich die neuen Dateien geladen werden.
      speicher.addAll(DATEIEN.map((pfad) => new Request(pfad, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((name) => name.startsWith('planner-') && name !== VERSION)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Die App meldet sich, wenn die Nutzerin auf "Jetzt aktualisieren" tippt.
self.addEventListener('message', (ereignis) => {
  if (ereignis.data === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;
  const adresse = new URL(anfrage.url);
  if (adresse.origin !== self.location.origin) return;

  ereignis.respondWith(
    caches.open(VERSION).then(async (speicher) => {
      const treffer = await speicher.match(anfrage, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        return await fetch(anfrage);
      } catch (fehler) {
        // Ohne Netz: Seitenaufrufe landen auf der Startseite der App.
        if (anfrage.mode === 'navigate') {
          const start = await speicher.match('./');
          if (start) return start;
        }
        throw fehler;
      }
    })
  );
});
