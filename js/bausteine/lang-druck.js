// Langes Drücken auf einen Eintrag öffnet ein kleines Menü, zum Beispiel mit „Bearbeiten“ und „Löschen“.
//
// Einträge tragen dafür das Merkmal data-lang="typ:id" (bei Terminen "termin:id:start",
// bei den Bereichen im Tab „Heute“ "bereich:name"). Eine einzige Stelle hört auf alle Finger:
// Ruht der Finger etwa eine halbe Sekunde auf so einem Eintrag, ohne zu scrollen, öffnet sich das Menü.
// Danach löst das Anheben des Fingers keinen Tipp mehr aus.
//
// Was „Bearbeiten“ öffnet, melden die Bereiche mit registriere(typ, { bearbeiten }) an.
// Bereiche mit eigenem Menü (zum Beispiel die Abschnitte im Tab „Heute“) geben { menue } an.

import { html } from '../../bibliothek/preact-htm.js';
import { waehle, oeffneBlatt } from './fenster.js';
import { oeffneAufgabe } from './aufgabe-blatt.js';
import { TerminBlatt } from './termin-blatt.js';
import { HabitBlatt } from './habit-blatt.js';
import * as loeschen from './loeschen.js';
import * as store from '../store.js';
import * as notizen from '../notizen.js';
import * as pin from '../pin.js';
import { geheZu } from '../haken.js';
import { tagLesbar, spanneLesbar } from '../hilfen.js';

const DAUER = 480;      // So lange muss der Finger ruhen
const TOLERANZ = 10;    // So weit darf er sich dabei bewegen (in Pixeln)
const MARKE_NACH = 150; // Ab hier wird der Eintrag leicht hervorgehoben

const menues = new Map();

// Wohin es nach dem Löschen geht, wenn man auf der Seite des Eintrags stand
const ZURUECK = { projekt: 'aufgaben', habit: 'habits', notiz: 'notizen', ziel: 'ziele', pool: 'pools' };

export function registriere(typ, angaben) {
  menues.set(typ, { ...(menues.get(typ) || {}), ...angaben });
}

// Was die Bausteine selbst öffnen können
registriere('aufgabe', { bearbeiten: (a) => oeffneAufgabe({ id: a.id }) });
registriere('termin', {
  bearbeiten: (t, [start]) => oeffneBlatt((zu) => html`<${TerminBlatt} offen=${{ id: t.id, start: start || null }} onSchliessen=${zu} />`),
});
registriere('habit', { bearbeiten: (h) => oeffneBlatt((zu) => html`<${HabitBlatt} habit=${h} onSchliessen=${zu} />`) });

function titelVon(typ, eintrag, rest) {
  if (typ === 'termin' && rest[0] && eintrag.wiederholung) return `${eintrag.titel} (${tagLesbar(rest[0])})`;
  if (typ === 'urlaub') return `Urlaub ${eintrag.von === eintrag.bis ? tagLesbar(eintrag.von) : spanneLesbar(eintrag.von, eintrag.bis)}`;
  if (typ === 'periode') return `Periode ab ${tagLesbar(eintrag.beginn)}`;
  if (typ === 'messwert') return `Eintrag vom ${tagLesbar(eintrag.datum)}`;
  return eintrag.titel || eintrag.name || 'Eintrag';
}

// Öffnet das Menü zu einem Eintrag.
export async function zeigeMenue(typ, id, rest = []) {
  const angaben = menues.get(typ) || {};
  if (angaben.menue) {
    await angaben.menue(id, rest);
    return;
  }
  const eintrag = store.hole(id);
  if (!eintrag || eintrag.geloeschtAm) return;
  const titel = titelVon(typ, eintrag, rest);

  // Gesperrte Notizen: erst nach der PIN, also über die Notiz selbst.
  if (typ === 'notiz' && notizen.istGesperrt(eintrag) && !pin.istEntsperrt()) {
    const wahl = await waehle({
      titel,
      text: 'Diese Notiz ist gesperrt. Öffne sie und gib die PIN ein, um sie zu bearbeiten oder zu löschen.',
      optionen: [{ wert: 'oeffnen', name: 'Öffnen' }],
    });
    if (wahl === 'oeffnen') geheZu(`notiz/${eintrag.id}`);
    return;
  }

  const optionen = [];
  if (angaben.bearbeiten) optionen.push({ wert: 'bearbeiten', name: 'Bearbeiten' });
  (angaben.weitere || []).forEach((w) => { if (!w.wenn || w.wenn(eintrag, rest)) optionen.push({ wert: w.wert, name: w.name }); });
  if (loeschen.NACH_TYP[typ]) optionen.push({ wert: 'loeschen', name: 'Löschen', art: 'gefahr' });
  if (!optionen.length) return;

  const wahl = await waehle({ titel, optionen });
  if (!wahl) return;
  if (wahl === 'bearbeiten') angaben.bearbeiten(eintrag, rest);
  else if (wahl === 'loeschen') {
    const geloescht = await loeschen.NACH_TYP[typ](eintrag, ...rest);
    // Steht man gerade auf der Seite des gelöschten Eintrags, geht es zur Übersicht dieses Bereichs.
    if (geloescht && window.location.hash.includes(eintrag.id) && ZURUECK[typ]) geheZu(ZURUECK[typ]);
  }
  else {
    const w = (angaben.weitere || []).find((x) => x.wert === wahl);
    if (w) w.tun(eintrag, rest);
  }
}

function ausloesen(element) {
  const [typ, id, ...rest] = element.dataset.lang.split(':');
  if (!typ) return;
  zeigeMenue(typ, id, rest);
}

// Wird einmal beim Start der App aufgerufen.
export function richteEin(wurzel = document) {
  let uhr = null;
  let markeUhr = null;
  let element = null;
  let start = null;
  let ausgeloest = false;   // Menü ist offen, das Anheben des Fingers darf nichts mehr antippen
  let sperreBis = 0;
  let zuletzt = 0;

  const abbrechen = () => {
    clearTimeout(uhr);
    clearTimeout(markeUhr);
    uhr = null;
    if (element) element.classList.remove('lang-druck');
    element = null;
  };

  wurzel.addEventListener('touchstart', (e) => {
    abbrechen();
    ausgeloest = false;
    if (e.touches.length !== 1) return;
    const ziel = e.target instanceof Element ? e.target : null;
    const el = ziel && ziel.closest('[data-lang]');
    if (!el || ziel.closest('input, textarea, select, [contenteditable="true"]')) return;
    element = el;
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    markeUhr = setTimeout(() => { if (element) element.classList.add('lang-druck'); }, MARKE_NACH);
    uhr = setTimeout(() => {
      const fuer = element;
      abbrechen();
      if (!fuer || !fuer.isConnected) return;
      ausgeloest = true;
      zuletzt = Date.now();
      ausloesen(fuer);
    }, DAUER);
  }, { passive: true });

  wurzel.addEventListener('touchmove', (e) => {
    if (!uhr || !start) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > TOLERANZ) abbrechen();
  }, { passive: true });

  const ende = (e) => {
    abbrechen();
    if (ausgeloest) {
      // Kein Tipp auf den Eintrag und nicht auf den Hintergrund des gerade geöffneten Menüs
      if (e.cancelable) e.preventDefault();
      ausgeloest = false;
      sperreBis = Date.now() + 450;
    }
  };
  wurzel.addEventListener('touchend', ende, { passive: false });
  wurzel.addEventListener('touchcancel', ende, { passive: false });
  // Scrollen bricht ab (der Finger bewegt dabei oft weniger als die Toleranz, bevor iOS übernimmt)
  window.addEventListener('scroll', abbrechen, { passive: true, capture: true });

  // Sicherheitsnetz: Ein Tipp kurz nach dem Anheben zählt nicht, außer er gilt dem gerade geöffneten Menü.
  wurzel.addEventListener('click', (e) => {
    if (Date.now() >= sperreBis) return;
    const ziel = e.target instanceof Element ? e.target : null;
    if (ziel && ziel.closest('.frage-hintergrund')) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Rechtsklick am Computer und langes Drücken auf Geräten, die dafür ein eigenes Ereignis schicken
  wurzel.addEventListener('contextmenu', (e) => {
    const ziel = e.target instanceof Element ? e.target : null;
    const el = ziel && ziel.closest('[data-lang]');
    if (!el) return;
    e.preventDefault();
    if (Date.now() - zuletzt < 1500) return;
    zuletzt = Date.now();
    abbrechen();
    ausloesen(el);
  });
}
