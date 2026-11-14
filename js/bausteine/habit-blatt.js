// Das Fenster zum Anlegen und Bearbeiten eines Habits.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Blatt } from './fenster.js';
import { IconWahl } from './icon-wahl.js';
import * as store from '../store.js';
import * as habits from '../habits.js';
import { WOCHENTAGE } from '../typen.js';

const ARTEN = [
  { wert: 'taeglich', name: 'Täglich' },
  { wert: 'wochentage', name: 'An bestimmten Wochentagen' },
  { wert: 'proWoche', name: 'x-mal pro Woche' },
  { wert: 'proMonat', name: 'x-mal pro Monat' },
  { wert: 'intervall', name: 'Alle n Tage' },
];

const HINWEISE = {
  taeglich: 'Die Streak zählt die Tage in Folge.',
  wochentage: 'Die Streak zählt die gewählten Tage in Folge. An den anderen Tagen ist nichts zu tun.',
  proWoche: 'An welchen Tagen, entscheidest du. Die Streak zählt die Wochen, in denen du das Ziel erreichst.',
  proMonat: 'An welchen Tagen, entscheidest du. Die Streak zählt die Monate, in denen du das Ziel erreichst.',
  intervall: 'Das Habit ist so viele Tage nach dem letzten Mal wieder dran. Die Streak zählt, wie oft du den Abstand in Folge einhältst.',
};

function ganzeZahl(text) {
  const zahl = parseInt(text, 10);
  return Number.isFinite(zahl) ? zahl : 0;
}

export function HabitBlatt({ habit = null, onSchliessen, onAngelegt }) {
  const start = habit || habits.leeresHabit();
  const [name, setName] = useState(start.name);
  const [art, setArt] = useState(start.frequenz.art);
  const [wochentage, setWochentage] = useState(start.frequenz.wochentage || [1, 2, 3, 4, 5]);
  const [proWoche, setProWoche] = useState(String(start.frequenz.art === 'proWoche' ? start.frequenz.anzahl : 3));
  const [proMonat, setProMonat] = useState(String(start.frequenz.art === 'proMonat' ? start.frequenz.anzahl : 10));
  const [abstand, setAbstand] = useState(String(start.frequenz.n || 2));
  const [mitMenge, setMitMenge] = useState(Boolean(start.menge));
  const [einheit, setEinheit] = useState(start.menge ? start.menge.einheit : '');
  const [ziel, setZiel] = useState(start.menge ? habits.zahlText(start.menge.ziel) : '');
  const [kategorieId, setKategorieId] = useState(start.kategorieId);
  const [icon, setIcon] = useState(start.icon);
  const [fehler, setFehler] = useState('');
  const namensFeld = useRef(null);

  useEffect(() => {
    if (!habit && namensFeld.current) namensFeld.current.focus();
  }, []);

  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);
  const ohneFehler = (setzer) => (wert) => { setzer(wert); setFehler(''); };

  const schalteTag = (nr) => {
    setWochentage(wochentage.includes(nr) ? wochentage.filter((x) => x !== nr) : [...wochentage, nr]);
    setFehler('');
  };

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = name.trim();
    if (!sauber) return setFehler('Gib dem Habit einen Namen.');

    const frequenz = { art, wochentage: [...wochentage].sort((a, b) => a - b), anzahl: 3, n: 2 };
    if (art === 'wochentage' && !wochentage.length) return setFehler('Wähle mindestens einen Wochentag.');
    if (art === 'proWoche') {
      frequenz.anzahl = ganzeZahl(proWoche);
      if (frequenz.anzahl < 1 || frequenz.anzahl > 7) return setFehler('Pro Woche sind 1 bis 7 Mal möglich.');
    }
    if (art === 'proMonat') {
      frequenz.anzahl = ganzeZahl(proMonat);
      if (frequenz.anzahl < 1 || frequenz.anzahl > 31) return setFehler('Pro Monat sind 1 bis 31 Mal möglich.');
    }
    if (art === 'intervall') {
      frequenz.n = ganzeZahl(abstand);
      if (frequenz.n < 2 || frequenz.n > 365) return setFehler('Der Abstand muss zwischen 2 und 365 Tagen liegen. Für jeden Tag wähle „Täglich“.');
    }

    let menge = null;
    if (mitMenge) {
      const zahl = Number(ziel.trim().replace(',', '.'));
      if (!ziel.trim() || !Number.isFinite(zahl) || zahl <= 0) return setFehler('Gib ein Tagesziel größer als 0 ein.');
      menge = { einheit: einheit.trim(), ziel: Math.round(zahl * 100) / 100 };
    }

    const felder = { name: sauber, frequenz, menge, kategorieId, icon };
    if (habit) {
      store.aendern(habit.id, felder);
      onSchliessen();
    } else {
      const neu = habits.neu(felder);
      onSchliessen();
      if (onAngelegt) onAngelegt(neu);
    }
    return null;
  };

  // Die Fehlermeldung steht im festen Fuß, damit sie immer zu sehen ist.
  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${habit ? 'Änderungen speichern' : 'Habit anlegen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${habit ? 'Habit bearbeiten' : 'Neues Habit'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input ref=${namensFeld} class="feld gross" type="text" maxlength="80" enterkeyhint="done" aria-label="Name des Habits"
            placeholder="zum Beispiel Wasser trinken" value=${name} onInput=${(e) => ohneFehler(setName)(e.target.value)} />
        </form>

        <fieldset class="feld-gruppe">
          <legend>Wie oft</legend>
          <select class="feld" aria-label="Frequenz" value=${art} onChange=${(e) => ohneFehler(setArt)(e.target.value)}>
            ${ARTEN.map((a) => html`<option value=${a.wert}>${a.name}</option>`)}
          </select>

          ${art === 'wochentage' && html`
            <div class="chips woche" role="group" aria-label="Wochentage">
              ${WOCHENTAGE.map((w) => html`
                <button type="button" class=${`chip tag ${wochentage.includes(w.nr) ? 'aktiv' : ''}`}
                  aria-pressed=${wochentage.includes(w.nr)} aria-label=${w.lang} onClick=${() => schalteTag(w.nr)}>
                  ${w.kurz}
                </button>
              `)}
            </div>
          `}
          ${art === 'proWoche' && html`
            <div class="zahl-zeile">
              <input class="feld" type="number" inputmode="numeric" min="1" max="7" aria-label="Wie oft pro Woche"
                value=${proWoche} onInput=${(e) => ohneFehler(setProWoche)(e.target.value)} />
              <span>-mal pro Woche</span>
            </div>
          `}
          ${art === 'proMonat' && html`
            <div class="zahl-zeile">
              <input class="feld" type="number" inputmode="numeric" min="1" max="31" aria-label="Wie oft pro Monat"
                value=${proMonat} onInput=${(e) => ohneFehler(setProMonat)(e.target.value)} />
              <span>-mal pro Monat</span>
            </div>
          `}
          ${art === 'intervall' && html`
            <div class="zahl-zeile">
              <span>Alle</span>
              <input class="feld" type="number" inputmode="numeric" min="2" max="365" aria-label="Abstand in Tagen"
                value=${abstand} onInput=${(e) => ohneFehler(setAbstand)(e.target.value)} />
              <span>Tage</span>
            </div>
          `}
          <p class="feld-hinweis">${HINWEISE[art]}</p>
        </fieldset>

        <div class="feld-gruppe">
          <div class="schalter-zeile">
            <span id="menge-schalter">Menge zählen</span>
            <button type="button" class="schalter" role="switch" aria-checked=${mitMenge} aria-labelledby="menge-schalter"
              onClick=${() => ohneFehler(setMitMenge)(!mitMenge)}></button>
          </div>
          ${mitMenge ? html`
            <div class="menge-felder">
              <label>
                <span>Tagesziel</span>
                <input class="feld" type="text" inputmode="decimal" placeholder="8" value=${ziel}
                  onInput=${(e) => ohneFehler(setZiel)(e.target.value)} />
              </label>
              <label>
                <span>Einheit</span>
                <input class="feld" type="text" maxlength="20" placeholder="Gläser" value=${einheit}
                  onInput=${(e) => ohneFehler(setEinheit)(e.target.value)} />
              </label>
            </div>
            <p class="feld-hinweis">Du trägst Teilmengen ein. Der Tag zählt, sobald das Tagesziel erreicht ist.</p>
          ` : html`
            <p class="feld-hinweis">Ohne Menge hakst du das Habit einfach ab.</p>
          `}
        </div>

        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
            <option value="">Keine Kategorie</option>
            ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
        </label>

        <fieldset class="feld-gruppe">
          <legend>Icon</legend>
          <${IconWahl} wert=${icon} onWahl=${setIcon} />
        </fieldset>
      </div>
    <//>
  `;
}
