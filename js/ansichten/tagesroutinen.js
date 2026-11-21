// Tagesroutinen verwalten: anlegen, umbenennen, sortieren, löschen.
// Abgehakt werden sie im Tagesbereich.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { IconWahl } from '../bausteine/icon-wahl.js';
import { Blatt, melde, oeffneBlatt } from '../bausteine/fenster.js';
import { loescheEinfach } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import * as tagesroutinen from '../tagesroutinen.js';

export function Tagesroutinen() {
  useDaten();
  const [entwurf, setEntwurf] = useState('');
  const [offen, setOffen] = useState(null);
  const [sortieren, setSortieren] = useState(false);
  const liste = tagesroutinen.alle();

  const hinzu = (e) => {
    e.preventDefault();
    const titel = entwurf.trim();
    if (!titel) return;
    tagesroutinen.neu(titel);
    setEntwurf('');
  };

  const verschiebe = (index, richtung) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    const a = liste[index];
    const b = liste[ziel];
    store.aendern(a.id, { reihenfolge: b.reihenfolge });
    store.aendern(b.id, { reihenfolge: a.reihenfolge });
  };

  return html`
    <div class="seite">
      <p class="text-leise">
        Feste Punkte, die du jeden Tag im Tagesbereich einzeln abhakst. Sie starten jeden Tag neu und haben keine Streak.
      </p>

      <form class="schnell-eingabe" onSubmit=${hinzu}>
        <input class="feld" type="text" maxlength="80" enterkeyhint="done" aria-label="Neue Tagesroutine"
          placeholder="zum Beispiel Vitamine nehmen" value=${entwurf} onInput=${(e) => setEntwurf(e.target.value)} />
        <button class="knopf" type="submit" aria-label="Tagesroutine hinzufügen"><${Icon} name="plus" /></button>
      </form>

      ${liste.length > 0 && html`
        ${liste.length > 1 && html`
          <div class="leiste">
            <p class="text-leise">${liste.length} Tagesroutinen</p>
            <button class="knopf-text" type="button" onClick=${() => setSortieren(!sortieren)}>${sortieren ? 'Fertig' : 'Sortieren'}</button>
          </div>
        `}
        <ul class="gruppe">
          ${liste.map((r, index) => html`
            <li class="zeile" key=${r.id} data-lang=${sortieren ? null : `tagesroutine:${r.id}`}>
              <button class="zeile-haupt" type="button" disabled=${sortieren} onClick=${() => setOffen(r.id)}>
                <span class="listen-icon"><${Icon} name=${r.icon || 'sun'} groesse=${20} /></span>
                <span class="zeile-text"><strong>${r.titel}</strong></span>
                ${!sortieren && html`<${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />`}
              </button>
              ${sortieren && html`
                <span class="zeile-knoepfe">
                  <button class="knopf-rund" type="button" aria-label=${`${r.titel} nach oben`} disabled=${index === 0} onClick=${() => verschiebe(index, -1)}>
                    <${Icon} name="arrow-up" groesse=${18} />
                  </button>
                  <button class="knopf-rund" type="button" aria-label=${`${r.titel} nach unten`} disabled=${index === liste.length - 1} onClick=${() => verschiebe(index, 1)}>
                    <${Icon} name="arrow-down" groesse=${18} />
                  </button>
                </span>
              `}
            </li>
          `)}
        </ul>
      `}

      ${offen && html`<${RoutineBlatt} id=${offen} onSchliessen=${() => setOffen(null)} />`}
    </div>
  `;
}

registriere('tagesroutine', { bearbeiten: (r) => oeffneBlatt((zu) => html`<${RoutineBlatt} id=${r.id} onSchliessen=${zu} />`) });

function RoutineBlatt({ id, onSchliessen }) {
  const routine = store.hole(id);
  const [titel, setTitel] = useState(routine.titel);
  const [icon, setIcon] = useState(routine.icon);
  const [fehler, setFehler] = useState('');

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler('Gib der Tagesroutine einen Namen.');
      return;
    }
    store.aendern(id, { titel: sauber, icon });
    onSchliessen();
  };

  const loeschen = async () => {
    if (await loescheEinfach(routine)) onSchliessen();
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${speichern}>Änderungen speichern</button>`;

  return html`
    <${Blatt} titel="Tagesroutine" onSchliessen=${onSchliessen} fuss=${fuss}>
      <form class="formular" onSubmit=${speichern}>
        <label class="feld-gruppe">
          <span>Name</span>
          <input class="feld" type="text" maxlength="80" enterkeyhint="done" value=${titel}
            onInput=${(e) => { setTitel(e.target.value); setFehler(''); }} />
        </label>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
        <fieldset class="feld-gruppe">
          <legend>Icon</legend>
          <${IconWahl} wert=${icon} ohneErlaubt=${true} onWahl=${setIcon} />
        </fieldset>
        <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
          <${Icon} name="trash-2" groesse=${20} /> Tagesroutine löschen
        </button>
      </form>
    <//>
  `;
}
