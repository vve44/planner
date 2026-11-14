// Wiederverwendbare Formularteile: Liste zum Bearbeiten, Dauer-Auswahl, Abstand.

import { html, useState, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { neuerPunkt } from '../aufgaben.js';
import { dauerLesbar } from '../hilfen.js';
import { DAUER_VORSCHLAEGE } from '../typen.js';

// ---------- Liste zum Bearbeiten (Unteraufgaben, Checkliste) ----------
// "entwurf" ist der Text im Eingabefeld, der noch nicht hinzugefügt wurde. Er liegt
// beim Fenster, damit er beim Speichern nicht verloren geht.
// Hinzugefügt wird mit dem Plus-Knopf oder der Eingabetaste der Tastatur. Das Feld
// ist dafür ein eigenes kleines Formular, weil das iPhone die Eingabetaste dann
// zuverlässig als "Abschicken" behandelt.

export function PunktListe({ punkte, onAendern, entwurf, onEntwurf, platzhalter, ohneHaken = false }) {
  const eingabe = useRef(null);
  const hinzu = (e) => {
    if (e) e.preventDefault();
    // Der Fokus bleibt im Feld, damit sich gleich der nächste Punkt eintippen lässt.
    if (eingabe.current) eingabe.current.focus();
    const text = entwurf.trim();
    if (!text) return;
    onAendern([...punkte, neuerPunkt(text)]);
    onEntwurf('');
  };

  return html`
    <ul class="bearbeit-liste">
      ${punkte.map((p) => html`
        <li key=${p.id} class=${p.erledigt ? 'erledigt' : ''}>
          ${!ohneHaken && html`
            <button class="haken klein" type="button" aria-pressed=${p.erledigt}
              aria-label=${p.erledigt ? 'Wieder öffnen' : 'Abhaken'}
              onClick=${() => onAendern(punkte.map((x) => (x.id === p.id ? { ...x, erledigt: !x.erledigt } : x)))}>
              <span class="haken-kreis">${p.erledigt && html`<${Icon} name="check" groesse=${13} strich=${2.6} />`}</span>
            </button>
          `}
          <input class="feld" type="text" value=${p.text} aria-label="Text"
            onInput=${(e) => onAendern(punkte.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))} />
          <button class="knopf-rund" type="button" aria-label=${`„${p.text}“ entfernen`}
            onClick=${() => onAendern(punkte.filter((x) => x.id !== p.id))}>
            <${Icon} name="x" groesse=${18} />
          </button>
        </li>
      `)}
      <li>
        ${!ohneHaken && html`<span class="platz" aria-hidden="true"></span>`}
        <form class="punkt-neu" onSubmit=${hinzu}>
          <input ref=${eingabe} class="feld" type="text" value=${entwurf} placeholder=${platzhalter} enterkeyhint="done"
            onInput=${(e) => onEntwurf(e.target.value)} />
          <button class="punkt-plus" type="submit" aria-label=${platzhalter}>
            <${Icon} name="plus" groesse=${20} />
          </button>
        </form>
      </li>
    </ul>
  `;
}

// ---------- Dauer in Minuten ----------

export function DauerWahl({ wert, onWahl }) {
  const [andere, setAndere] = useState(Boolean(wert) && !DAUER_VORSCHLAEGE.includes(wert));

  return html`
    <div class="chips">
      <button type="button" class=${`chip ${!wert && !andere ? 'aktiv' : ''}`}
        onClick=${() => { setAndere(false); onWahl(null); }}>Keine</button>
      ${DAUER_VORSCHLAEGE.map((m) => html`
        <button type="button" class=${`chip ${wert === m && !andere ? 'aktiv' : ''}`}
          onClick=${() => { setAndere(false); onWahl(m); }}>${dauerLesbar(m)}</button>
      `)}
      <button type="button" class=${`chip ${andere ? 'aktiv' : ''}`} onClick=${() => setAndere(true)}>Andere</button>
    </div>
    ${andere && html`
      <div class="zahl-zeile">
        <input class="feld" type="number" inputmode="numeric" min="1" max="1440" aria-label="Dauer in Minuten"
          value=${wert || ''}
          onInput=${(e) => onWahl(Math.min(1440, parseInt(e.target.value, 10) || 0) || null)} />
        <span>Minuten</span>
      </div>
    `}
  `;
}

// ---------- Abstand: "Alle 2 Wochen" ----------

export function AbstandWahl({ n, einheit, onAendern, mitJahren = false }) {
  return html`
    <div class="zahl-zeile">
      <span>Alle</span>
      <input class="feld" type="number" inputmode="numeric" min="1" max="365" aria-label="Abstand"
        value=${n || ''}
        onInput=${(e) => onAendern({ n: parseInt(e.target.value, 10) || 0, einheit })} />
      <select class="feld" aria-label="Einheit" value=${einheit}
        onChange=${(e) => onAendern({ n, einheit: e.target.value })}>
        <option value="tage">Tage</option>
        <option value="wochen">Wochen</option>
        <option value="monate">Monate</option>
        ${mitJahren && html`<option value="jahre">Jahre</option>`}
      </select>
    </div>
  `;
}
