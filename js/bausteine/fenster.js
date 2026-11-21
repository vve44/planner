// Fenster und Hinweise: Blatt von unten, Rückfrage, kurze Meldung.

import { html, useState, useEffect, Fragment } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';

// ---------- Blatt: schiebt sich von unten ins Bild ----------
// "fuss" bleibt unten stehen (zum Beispiel der Speichern-Knopf), der Inhalt darüber scrollt.

export function Blatt({ titel, onSchliessen, fuss, children }) {
  useEffect(() => {
    const beiTaste = (e) => { if (e.key === 'Escape') onSchliessen(); };
    document.addEventListener('keydown', beiTaste);
    return () => document.removeEventListener('keydown', beiTaste);
  }, [onSchliessen]);

  return html`
    <div class="blatt-hintergrund" onClick=${(e) => { if (e.target === e.currentTarget) onSchliessen(); }}>
      <section class="blatt" role="dialog" aria-modal="true" aria-label=${titel}>
        <div class="blatt-griff" aria-hidden="true"></div>
        <header class="blatt-kopf">
          <h2>${titel}</h2>
          <button class="knopf-rund" type="button" aria-label="Schließen" onClick=${onSchliessen}>
            <${Icon} name="x" />
          </button>
        </header>
        <div class="blatt-inhalt">${children}</div>
        ${fuss && html`<footer class="blatt-fuss">${fuss}</footer>`}
      </section>
    </div>
  `;
}

// ---------- Rückfrage und Meldung (von überall aufrufbar) ----------

let setzeFrage = null;
let setzeMeldung = null;
let setzeBlatt = null;
let meldungUhr = null;

// Öffnet ein Blatt von überall aus, zum Beispiel aus dem Menü beim langen Drücken.
//   zeichne(onSchliessen) liefert das Blatt.
export function oeffneBlatt(zeichne) {
  if (setzeBlatt) setzeBlatt({ zeichne, schluessel: Date.now() });
}

// Lässt zwischen mehreren Möglichkeiten wählen. Antwort: der "wert" der gewählten
// Möglichkeit oder null bei "Abbrechen".
//   optionen: [{ wert, name, art }]   art: 'gefahr' oder 'leise' (optional)
export function waehle({ titel, text, optionen, abbrechen = 'Abbrechen' }) {
  return new Promise((antwort) => {
    if (!setzeFrage) { antwort(null); return; }
    setzeFrage({ titel, text, optionen, abbrechen, antwort });
  });
}

// Stellt eine Ja/Nein-Frage. Antwort: true oder false.
export async function frage({ titel, text, ja = 'Ja', nein = 'Abbrechen', gefahr = false }) {
  const wahl = await waehle({ titel, text, optionen: [{ wert: true, name: ja, art: gefahr ? 'gefahr' : '' }], abbrechen: nein });
  return wahl === true;
}

// Zeigt kurz eine Meldung am unteren Rand, optional mit einer Aktion (z. B. "Rückgängig").
export function melde(text, { aktion = null, beiAktion = null, dauer = 5000 } = {}) {
  if (!setzeMeldung) return;
  clearTimeout(meldungUhr);
  setzeMeldung({ text, aktion, beiAktion });
  meldungUhr = setTimeout(() => setzeMeldung && setzeMeldung(null), dauer);
}

// Wird einmal ganz oben in der App eingehängt.
export function Dienste() {
  const [offeneFrage, setOffeneFrage] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [blatt, setBlatt] = useState(null);

  useEffect(() => {
    setzeFrage = setOffeneFrage;
    setzeMeldung = setMeldung;
    setzeBlatt = setBlatt;
    return () => { setzeFrage = null; setzeMeldung = null; setzeBlatt = null; };
  }, []);

  const antworte = (wert) => {
    offeneFrage.antwort(wert);
    setOffeneFrage(null);
  };

  return html`
    ${blatt && html`<${Fragment} key=${blatt.schluessel}>${blatt.zeichne(() => setBlatt(null))}</${Fragment}>`}
    ${offeneFrage && html`
      <div class="frage-hintergrund">
        <section class="frage" role="alertdialog" aria-modal="true" aria-label=${offeneFrage.titel}>
          <h2>${offeneFrage.titel}</h2>
          ${offeneFrage.text && html`<p>${offeneFrage.text}</p>`}
          <div class="frage-knoepfe">
            ${offeneFrage.optionen.map((o) => html`
              <button class=${`knopf breit ${o.art || ''}`} type="button" onClick=${() => antworte(o.wert)}>${o.name}</button>
            `)}
            <button class="knopf breit leise" type="button" onClick=${() => antworte(null)}>${offeneFrage.abbrechen}</button>
          </div>
        </section>
      </div>
    `}
    ${meldung && html`
      <div class="meldung" role="status">
        <span>${meldung.text}</span>
        ${meldung.aktion && html`
          <button type="button" onClick=${() => { clearTimeout(meldungUhr); setMeldung(null); meldung.beiAktion && meldung.beiAktion(); }}>
            ${meldung.aktion}
          </button>
        `}
      </div>
    `}
  `;
}
