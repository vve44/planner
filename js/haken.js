// Kleine Hilfen, mit denen Ansichten auf Änderungen reagieren.

import { useState, useEffect } from '../bibliothek/preact-htm.js';
import * as store from './store.js';

// Zeichnet die Ansicht neu, sobald sich Daten oder Einstellungen ändern.
export function useDaten() {
  const [, setZaehler] = useState(0);
  useEffect(() => store.abonniere(() => setZaehler((n) => n + 1)), []);
}

// Liest die aktuelle Seite aus dem Teil hinter dem # in der Adresse.
// "#/liste/abc" ergibt { name: 'liste', teil: 'abc' }.
function leseRoute() {
  const roh = window.location.hash.replace(/^#\/?/, '');
  const [name, teil] = roh.split('/');
  return { name: name || 'heute', teil: teil || null };
}

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
