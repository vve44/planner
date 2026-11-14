// Routinen: Vorlagen für Aufgaben mit festem Paket an Unteraufgaben
// (zum Beispiel "Selfcare-Routine"). Beim Einplanen entsteht daraus eine normale
// Aufgabe mit frischen Häkchen, einmalig oder wiederkehrend.

import * as store from './store.js';
import { neuerPunkt } from './aufgaben.js';

export function alle() {
  return store.liste('routine').sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel, 'de'));
}

export function neu(felder) {
  const letzte = alle().pop();
  return store.anlegen('routine', { ...felder, reihenfolge: letzte ? letzte.reihenfolge + 1 : 1 });
}

// Angaben, mit denen eine neue Aufgabe aus der Routine vorbelegt wird.
export function vorgabenAus(routine) {
  return {
    titel: routine.titel,
    dauerMin: routine.dauerMin || null,
    icon: routine.icon || null,
    kategorieId: routine.kategorieId || null,
    unteraufgaben: routine.unteraufgaben.map((u) => neuerPunkt(u.text)),
    routineId: routine.id,
  };
}
