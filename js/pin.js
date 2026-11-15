// Vierstellige PIN für einzelne Notizen.
// Die PIN ist ein Sichtschutz, keine Verschlüsselung: Gesperrte Notizen liegen wie alle
// anderen Daten in der Datenbank des Geräts, die App zeigt sie nur erst nach der PIN.
// Gespeichert wird nicht die PIN selbst, sondern ein daraus berechneter Prüfwert.
// Nach der Eingabe bleiben gesperrte Notizen offen, bis die App in den Hintergrund geht.

import * as store from './store.js';

const DURCHLAEUFE = 100000;
let entsperrt = false;

function zuBase64(bytes) {
  let text = '';
  new Uint8Array(bytes).forEach((b) => { text += String.fromCharCode(b); });
  return btoa(text);
}

function vonBase64(text) {
  return Uint8Array.from(atob(text), (z) => z.charCodeAt(0));
}

async function pruefwert(pin, salt, durchlaeufe) {
  const roh = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: durchlaeufe, hash: 'SHA-256' }, roh, 256);
  return zuBase64(bits);
}

export function gueltig(pin) {
  return /^\d{4}$/.test(pin);
}

export function istGesetzt() {
  return Boolean(store.einstellung('pin'));
}

// Legt die PIN fest (oder ersetzt sie). Danach sind gesperrte Notizen offen.
export async function setze(pin) {
  if (!gueltig(pin)) throw new Error('Die PIN braucht vier Ziffern.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wert = await pruefwert(pin, salt, DURCHLAEUFE);
  await store.setzeEinstellung('pin', { salt: zuBase64(salt), pruefwert: wert, durchlaeufe: DURCHLAEUFE });
  entsperrt = true;
  store.zeichneNeu();
}

export async function pruefe(pin) {
  const ablage = store.einstellung('pin');
  if (!ablage || !gueltig(pin)) return false;
  const wert = await pruefwert(pin, vonBase64(ablage.salt), ablage.durchlaeufe);
  return wert === ablage.pruefwert;
}

// Prüft die PIN und öffnet bei Erfolg die gesperrten Notizen.
export async function entsperre(pin) {
  const richtig = await pruefe(pin);
  if (richtig) {
    entsperrt = true;
    store.zeichneNeu();
  }
  return richtig;
}

export function istEntsperrt() {
  return entsperrt;
}

export function sperre() {
  if (!entsperrt) return;
  entsperrt = false;
  store.zeichneNeu();
}

// Sobald die App in den Hintergrund geht, sind gesperrte Notizen wieder zu.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sperre();
  });
}
