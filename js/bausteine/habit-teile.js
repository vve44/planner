// Bausteine für Habits: die Zeile in Listen und das Fenster für einen einzelnen Tag
// (abhaken, Teilmengen eintragen, auslassen).

import { html, useState, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { Blatt, melde } from './fenster.js';
import { geheZu } from '../haken.js';
import * as habits from '../habits.js';
import { heute, tagAusfuehrlich, tagLesbar } from '../hilfen.js';

// Kreis mit Fortschritt für Habits mit Menge. Ist das Tagesziel erreicht, wird er golden.
function MengenKreis({ anteil }) {
  if (anteil >= 1) {
    return html`<span class="haken-kreis voll"><${Icon} name="check" groesse=${15} strich=${2.6} /></span>`;
  }
  const umfang = 2 * Math.PI * 10.5;
  return html`
    <svg class="mengen-kreis" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10.5" fill="none" stroke="var(--zart-2)" stroke-width="3" />
      ${anteil > 0 && html`
        <circle cx="13" cy="13" r="10.5" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linecap="round"
          stroke-dasharray=${`${umfang * anteil} ${umfang}`} transform="rotate(-90 13 13)" />
      `}
    </svg>
  `;
}

// Ein Habit als Zeile: Haken oder Mengenkreis, Name, Streak und Stand, rechts "Auslassen".
//   tag            – für welchen Tag die Zeile gilt (normalerweise heute)
//   zeigeFrequenz  – die Frequenz mit nennen (im Habit-Bereich)
//   ohneLink       – Name öffnet nicht die Statistikseite (auf der Seite selbst)
export function HabitZeile({ habit, tag = heute(), zeigeFrequenz = false, ohneLink = false }) {
  const [tagOffen, setTagOffen] = useState(false);
  const lage = habits.lageAm(habit, tag);
  const erledigt = lage === 'erledigt';
  const wert = habits.wertAm(habit, tag);
  const stand = habits.periodenStand(habit, tag);
  const s = habits.streak(habit, tag);
  const gedaempft = lage === 'ausgelassen' || lage === 'zielErreicht' || lage === 'ruht' || lage === 'frei';

  const haken = () => {
    if (habit.menge) setTagOffen(true);
    else habits.schalteErledigt(habit, tag);
  };

  const auslassen = () => {
    const an = lage !== 'ausgelassen';
    habits.setzeAusgelassen(habit, tag, an);
    if (an) {
      melde(`„${habit.name}“ für heute ausgelassen. Die Streak bleibt.`, {
        aktion: 'Rückgängig',
        beiAktion: () => habits.setzeAusgelassen(habit, tag, false),
      });
    }
  };

  let hinweis = null;
  if (lage === 'ausgelassen') hinweis = 'Heute ausgelassen';
  else if (lage === 'zielErreicht') hinweis = stand.wort === 'diese Woche' ? 'Wochenziel erreicht' : 'Monatsziel erreicht';
  else if (lage === 'ruht') hinweis = habits.istPausiert(habit) ? 'Pausiert' : 'Ruht im Urlaub';
  else if (lage === 'frei') {
    const dran = habits.naechstesMal(habit, tag);
    hinweis = dran ? `Wieder dran: ${tagLesbar(dran)}` : 'Heute nicht dran';
  }

  const inhalt = html`
    <span class="aufgabe-titel">
      ${habit.icon && html`<${Icon} name=${habit.icon} groesse=${18} />`}
      ${habit.name}
    </span>
    <span class="aufgabe-meta">
      ${s.aktuell > 0 && html`<span class="gold"><${Icon} name="flame" groesse=${14} /> ${s.text}</span>`}
      ${habit.menge && html`<span>${habits.mengeText(habit, wert)}</span>`}
      ${stand && html`<span>${stand.ist}/${stand.soll} ${stand.wort}</span>`}
      ${hinweis && html`<span>${hinweis}</span>`}
      ${zeigeFrequenz && html`<span><${Icon} name="repeat" groesse=${14} /> ${habits.frequenzText(habit)}</span>`}
    </span>
  `;

  return html`
    <li class=${`aufgabe habit ${erledigt ? 'erledigt' : ''} ${gedaempft ? 'gedaempft' : ''}`}>
      <div class="aufgabe-zeile">
        <button class="haken" type="button" aria-pressed=${erledigt}
          aria-label=${habit.menge
            ? `${habit.name}: Menge eintragen, bisher ${habits.mengeText(habit, wert)}`
            : erledigt ? `${habit.name}: Häkchen zurücknehmen` : `${habit.name} abhaken`}
          onClick=${haken}>
          ${habit.menge
            ? html`<${MengenKreis} anteil=${wert / habits.tagesziel(habit)} />`
            : html`<span class="haken-kreis">${erledigt && html`<${Icon} name="check" groesse=${15} strich=${2.6} />`}</span>`}
        </button>

        ${ohneLink
          ? html`<div class="aufgabe-haupt">${inhalt}</div>`
          : html`
            <button class="aufgabe-haupt" type="button" aria-label=${`${habit.name}: Statistik öffnen`} onClick=${() => geheZu(`habit/${habit.id}`)}>
              ${inhalt}
            </button>
          `}

        ${(lage === 'offen' || lage === 'ausgelassen') && html`
          <span class="aufgabe-neben">
            <button type="button" aria-label=${lage === 'ausgelassen' ? `${habit.name}: Auslassen zurücknehmen` : `${habit.name} heute auslassen`}
              onClick=${auslassen}>
              <${Icon} name=${lage === 'ausgelassen' ? 'undo-2' : 'skip-forward'} groesse=${19} />
            </button>
          </span>
        `}
      </div>
      ${tagOffen && html`<${HabitTagBlatt} habit=${habit} tag=${tag} onSchliessen=${() => setTagOffen(false)} />`}
    </li>
  `;
}

// Fenster für einen einzelnen Tag eines Habits: abhaken oder Menge eintragen, auslassen.
// Dient auch zum Nachtragen vergangener Tage (aus dem Verlauf heraus).
export function HabitTagBlatt({ habit, tag, onSchliessen }) {
  const [eingabe, setEingabe] = useState('');
  const [fehler, setFehler] = useState('');
  const feld = useRef(null);
  const wert = habits.wertAm(habit, tag);
  const ziel = habits.tagesziel(habit);
  const erfuellt = habits.erfuelltAm(habit, tag);
  const eintrag = habits.eintragAm(habit, tag);
  const ausgelassen = Boolean(eintrag && eintrag.ausgelassen);
  const ruht = habits.ruhtAm(habit, tag);
  const einheit = habit.menge && habit.menge.einheit ? ` ${habit.menge.einheit}` : '';

  const hinzu = (e) => {
    e.preventDefault();
    const zahl = Number(eingabe.trim().replace(',', '.'));
    if (!eingabe.trim() || !Number.isFinite(zahl) || zahl <= 0) {
      setFehler('Gib eine Zahl größer als 0 ein.');
      return;
    }
    habits.addiere(habit, tag, zahl);
    setEingabe('');
    setFehler('');
    if (feld.current) feld.current.focus();
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${onSchliessen}>Fertig</button>`;

  return html`
    <${Blatt} titel=${habit.name} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <p class="text-leise">${tagAusfuehrlich(tag)}${tag === heute() ? ' (heute)' : ''}</p>

        ${habit.menge ? html`
          <div class="menge-stand" aria-live="polite">
            <p><strong>${habits.zahlText(wert)}</strong> von ${habits.zahlText(ziel)}${einheit}</p>
            <div class="menge-balken"><i style=${`width:${Math.min(100, (wert / ziel) * 100)}%`}></i></div>
            ${erfuellt && html`<p class="menge-fertig"><${Icon} name="check" groesse=${16} strich=${2.6} /> Tagesziel erreicht</p>`}
          </div>

          <div class="feld-gruppe">
            <span id="menge-name">Menge hinzufügen</span>
            <form class="schnell-eingabe" onSubmit=${hinzu}>
              <input ref=${feld} class="feld" type="text" inputmode="decimal" enterkeyhint="done" aria-labelledby="menge-name"
                placeholder=${`zum Beispiel 1${einheit}`} value=${eingabe}
                onInput=${(e) => { setEingabe(e.target.value); setFehler(''); }} />
              <button class="knopf" type="submit" aria-label="Menge hinzufügen"><${Icon} name="plus" /></button>
            </form>
            ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
            <div class="chips">
              <button type="button" class="chip" onClick=${() => habits.addiere(habit, tag, 1)}>+ 1</button>
              ${!erfuellt && html`<button type="button" class="chip" onClick=${() => habits.setzeWert(habit, tag, ziel)}>Tagesziel erreicht</button>`}
              ${wert > 0 && html`<button type="button" class="chip" onClick=${() => habits.setzeWert(habit, tag, 0)}>Auf 0 setzen</button>`}
            </div>
          </div>
        ` : html`
          <button class=${`knopf breit ${erfuellt ? 'leise' : ''}`} type="button" onClick=${() => habits.schalteErledigt(habit, tag)}>
            <${Icon} name=${erfuellt ? 'undo-2' : 'check'} groesse=${20} />
            ${erfuellt ? 'Erledigt. Häkchen zurücknehmen' : 'Als erledigt eintragen'}
          </button>
        `}

        <div class="feld-gruppe">
          <div class="schalter-zeile">
            <span id="auslassen-name">Diesen Tag auslassen</span>
            <button type="button" class="schalter" role="switch" aria-checked=${ausgelassen && !erfuellt} aria-labelledby="auslassen-name"
              disabled=${erfuellt} onClick=${() => habits.setzeAusgelassen(habit, tag, !ausgelassen)}></button>
          </div>
          <p class="feld-hinweis">
            ${erfuellt
              ? 'Der Tag ist erledigt und zählt für die Streak.'
              : 'Ein ausgelassener Tag bricht die Streak nicht und zählt auch nicht mit.'}
          </p>
          ${ruht && html`<p class="feld-hinweis">An diesem Tag ruht das Habit ohnehin (Pause oder Urlaub).</p>`}
        </div>
      </div>
    <//>
  `;
}
