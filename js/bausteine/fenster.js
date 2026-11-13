// Fenster und Hinweise: Blatt von unten, Rückfrage, kurze Meldung.

import { html, useState, useEffect } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';

// ---------- Blatt: schiebt sich von unten ins Bild ----------

export function Blatt({ titel, onSchliessen, children }) {
  useEffect(() => {
    const beiTaste = (e) => { if (e.key === 'Escape') onSchliessen(); };
    document.addEventListener('keydown', beiTaste);
    return () => document.removeEventListener('keydown', beiTaste);
  }, [onSchliessen]);

  return html`
    <div class="blatt-hintergrund" onClick=${(e) => { if (e.target === e.currentTarget) onSchliessen(); }}>
      <section class="blatt" role="dialog" aria-modal="true" aria-label=${titel}>
        <header class="blatt-kopf">
          <h2>${titel}</h2>
          <button class="knopf-rund" type="button" aria-label="Schließen" onClick=${onSchliessen}>
            <${Icon} name="x" />
          </button>
        </header>
        <div class="blatt-inhalt">${children}</div>
      </section>
    </div>
  `;
}

// ---------- Rückfrage und Meldung (von überall aufrufbar) ----------

let setzeFrage = null;
let setzeMeldung = null;
let meldungUhr = null;

// Stellt eine Ja/Nein-Frage. Antwort: true oder false.
export function frage({ titel, text, ja = 'Ja', nein = 'Abbrechen', gefahr = false }) {
  return new Promise((antwort) => {
    if (!setzeFrage) { antwort(false); return; }
    setzeFrage({ titel, text, ja, nein, gefahr, antwort });
  });
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

  useEffect(() => {
    setzeFrage = setOffeneFrage;
    setzeMeldung = setMeldung;
    return () => { setzeFrage = null; setzeMeldung = null; };
  }, []);

  const antworte = (wert) => {
    offeneFrage.antwort(wert);
    setOffeneFrage(null);
  };

  return html`
    ${offeneFrage && html`
      <div class="frage-hintergrund">
        <section class="frage" role="alertdialog" aria-modal="true" aria-label=${offeneFrage.titel}>
          <h2>${offeneFrage.titel}</h2>
          ${offeneFrage.text && html`<p>${offeneFrage.text}</p>`}
          <div class="frage-knoepfe">
            <button class="knopf leise" type="button" onClick=${() => antworte(false)}>${offeneFrage.nein}</button>
            <button class=${`knopf ${offeneFrage.gefahr ? 'gefahr' : ''}`} type="button" onClick=${() => antworte(true)}>${offeneFrage.ja}</button>
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
