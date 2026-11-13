// Offline-Betrieb und Updates: meldet den Service Worker an und merkt,
// wenn eine neue Version der App bereitliegt.

const hoerer = new Set();
let anmeldung = null;
let wartend = null;

function benachrichtige() {
  hoerer.forEach((fn) => fn());
}

export function abonniereUpdate(fn) {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

// Liegt eine neue Version bereit?
export function updateBereit() {
  return Boolean(wartend);
}

export function offlineUnterstuetzt() {
  return 'serviceWorker' in navigator;
}

function beobachte(arbeiter) {
  if (!arbeiter) return;
  arbeiter.addEventListener('statechange', () => {
    // "installed" mit bereits aktiver Version heißt: ein Update wartet.
    if (arbeiter.state === 'installed' && navigator.serviceWorker.controller) {
      wartend = arbeiter;
      benachrichtige();
    }
  });
}

export async function starteOfflineBetrieb() {
  if (!offlineUnterstuetzt()) return;
  try {
    anmeldung = await navigator.serviceWorker.register('sw.js');
    if (anmeldung.waiting && navigator.serviceWorker.controller) {
      wartend = anmeldung.waiting;
      benachrichtige();
    }
    beobachte(anmeldung.installing);
    anmeldung.addEventListener('updatefound', () => beobachte(anmeldung.installing));

    // Sobald die neue Version übernommen hat, einmal neu laden.
    let laedtNeu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (laedtNeu || !wartend) return;
      laedtNeu = true;
      window.location.reload();
    });

    // Beim Zurückkehren in die App nach einer neuen Version schauen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sucheUpdate();
    });
  } catch (fehler) {
    console.error('Offline-Betrieb konnte nicht gestartet werden:', fehler);
  }
}

// Fragt den Server, ob es neue Dateien gibt. Ergebnis: true, wenn die Suche lief.
export async function sucheUpdate() {
  if (!anmeldung) return false;
  try {
    await anmeldung.update();
    return true;
  } catch (fehler) {
    return false;
  }
}

// Übernimmt die neue Version. Danach lädt die App neu.
export function uebernimmUpdate() {
  if (wartend) wartend.postMessage('aktivieren');
}
