// Kleine Hilfen, mit denen Ansichten auf Änderungen reagieren.

import { useState, useEffect } from '../bibliothek/preact-htm.js';
import * as store from './store.js';

// Zeichnet die Ansicht neu, sobald sich Daten oder Einstellungen ändern.
export function useDaten() {
  const [, setZaehler] = useState(0);
  useEffect(() => store.abonniere(() => setZaehler((n) => n + 1)), []);
}

function leseRoute() {
  const roh = window.location.hash.replace(/^#\/?/, '');
  return roh || 'heute';
}

// Aktuelle Seite der App, gesteuert über den Teil hinter dem # in der Adresse.
export function useRoute() {
  const [route, setRoute] = useState(leseRoute());
  useEffect(() => {
    const beiWechsel = () => setRoute(leseRoute());
    window.addEventListener('hashchange', beiWechsel);
    return () => window.removeEventListener('hashchange', beiWechsel);
  }, []);
  return route;
}

export function geheZu(route) {
  window.location.hash = `#/${route}`;
}
