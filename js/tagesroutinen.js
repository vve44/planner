// Tagesroutinen: feste Punkte, die jeden Tag einzeln abgehakt werden. Ohne Streak
// und ohne Statistik. Pro Tag gibt es einen Datensatz mit den abgehakten Punkten.

import * as store from './store.js';
import { heute } from './hilfen.js';

export function alle() {
  return store.liste('tagesroutine').sort((a, b) => a.reihenfolge - b.reihenfolge);
}

export function neu(titel, icon = null) {
  const letzte = alle().pop();
  return store.anlegen('tagesroutine', { titel, icon, reihenfolge: letzte ? letzte.reihenfolge + 1 : 1 });
}

function hakenVon(tag) {
  return store.liste('tagesroutineHaken').find((h) => h.datum === tag) || null;
}

// Die IDs der Routinen, die an diesem Tag abgehakt sind.
export function erledigteAm(tag = heute()) {
  const haken = hakenVon(tag);
  return new Set(haken ? haken.erledigt : []);
}

export function schalte(id, tag = heute()) {
  const haken = hakenVon(tag);
  if (!haken) {
    store.anlegen('tagesroutineHaken', { datum: tag, erledigt: [id] });
    return;
  }
  const hat = haken.erledigt.includes(id);
  store.aendern(haken.id, { erledigt: hat ? haken.erledigt.filter((x) => x !== id) : [...haken.erledigt, id] });
}
