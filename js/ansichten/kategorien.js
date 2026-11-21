// Kategorien: anlegen, ändern, sortieren, löschen.
// Eine Kategorie gilt einheitlich für Aufgaben und Listen, später auch für Termine, Habits, Notizen und Ziele.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { IconWahl } from '../bausteine/icon-wahl.js';
import { Blatt, melde, oeffneBlatt } from '../bausteine/fenster.js';
import { loescheEinfach } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import { KATEGORIE_FARBEN } from '../typen.js';
import { farbeDarauf } from '../hilfen.js';

function sortiert() {
  return store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);
}

export function Kategorien() {
  useDaten();
  const [offen, setOffen] = useState(null); // null | { neu: true } | { id }
  const [sortieren, setSortieren] = useState(false);
  const liste = sortiert();

  const verschiebe = (index, richtung) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    const a = liste[index];
    const b = liste[ziel];
    store.aendern(a.id, { reihenfolge: b.reihenfolge });
    store.aendern(b.id, { reihenfolge: a.reihenfolge });
  };

  if (!liste.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="tags" groesse=${28} strich=${1.4} /></span>
          <h2>Noch keine Kategorien</h2>
          <p class="text-leise">
            Kategorien wie „Gesundheit“ oder „Universität“ geben Aufgaben, Terminen, Habits,
            Notizen und Zielen eine gemeinsame Farbe und ein Icon.
          </p>
          <button class="knopf" type="button" onClick=${() => setOffen({ neu: true })}>
            <${Icon} name="plus" /> Kategorie anlegen
          </button>
        </section>
        ${offen && html`<${KategorieBlatt} offen=${offen} anzahl=${0} onSchliessen=${() => setOffen(null)} />`}
      </div>
    `;
  }

  return html`
    <div class="seite">
      <div class="leiste">
        <p class="text-leise">${liste.length === 1 ? '1 Kategorie' : `${liste.length} Kategorien`}</p>
        ${liste.length > 1 && html`
          <button class="knopf-text" type="button" onClick=${() => setSortieren(!sortieren)}>
            ${sortieren ? 'Fertig' : 'Sortieren'}
          </button>
        `}
      </div>

      <ul class="gruppe">
        ${liste.map((k, index) => html`
          <li class="zeile" key=${k.id} data-lang=${sortieren ? null : `kategorie:${k.id}`}>
            <button class="zeile-haupt" type="button" disabled=${sortieren} onClick=${() => setOffen({ id: k.id })}>
              <span class="farb-marke" style=${`background:${k.farbe};color:${farbeDarauf(k.farbe)}`}>
                <${Icon} name=${k.icon} groesse=${19} />
              </span>
              <span class="zeile-text"><strong>${k.name}</strong></span>
              ${!sortieren && html`<${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />`}
            </button>
            ${sortieren && html`
              <span class="zeile-knoepfe">
                <button class="knopf-rund" type="button" aria-label=${`${k.name} nach oben`}
                  disabled=${index === 0} onClick=${() => verschiebe(index, -1)}>
                  <${Icon} name="arrow-up" groesse=${18} />
                </button>
                <button class="knopf-rund" type="button" aria-label=${`${k.name} nach unten`}
                  disabled=${index === liste.length - 1} onClick=${() => verschiebe(index, 1)}>
                  <${Icon} name="arrow-down" groesse=${18} />
                </button>
              </span>
            `}
          </li>
        `)}
      </ul>

      ${!sortieren && html`
        <button class="knopf-plus" type="button" aria-label="Kategorie anlegen" onClick=${() => setOffen({ neu: true })}>
          <${Icon} name="plus" groesse=${26} />
        </button>
      `}

      ${offen && html`<${KategorieBlatt} offen=${offen} anzahl=${liste.length} onSchliessen=${() => setOffen(null)} />`}
    </div>
  `;
}

registriere('kategorie', { bearbeiten: (k) => oeffneBlatt((zu) => html`<${KategorieBlatt} offen=${{ id: k.id }} anzahl=${0} onSchliessen=${zu} />`) });

function KategorieBlatt({ offen, anzahl, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const [name, setName] = useState(vorhanden ? vorhanden.name : '');
  const [farbe, setFarbe] = useState(vorhanden ? vorhanden.farbe : KATEGORIE_FARBEN[anzahl % KATEGORIE_FARBEN.length].wert);
  const [icon, setIcon] = useState(vorhanden ? vorhanden.icon : 'tag');
  const [fehler, setFehler] = useState('');

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler('Gib der Kategorie einen Namen.');
      return;
    }
    if (vorhanden) {
      store.aendern(vorhanden.id, { name: sauber, farbe, icon });
    } else {
      const letzte = sortiert().pop();
      store.anlegen('kategorie', { name: sauber, farbe, icon, reihenfolge: letzte ? letzte.reihenfolge + 1 : 1 });
    }
    onSchliessen();
  };

  const loeschen = async () => {
    if (await loescheEinfach(vorhanden)) onSchliessen();
  };

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Kategorie anlegen'}</button>
  `;

  return html`
    <${Blatt} titel=${vorhanden ? 'Kategorie bearbeiten' : 'Neue Kategorie'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <form class="formular" onSubmit=${speichern}>
        <div class="vorschau-kategorie">
          <span class="farb-marke gross" style=${`background:${farbe};color:${farbeDarauf(farbe)}`}><${Icon} name=${icon} groesse=${26} /></span>
          <span>${name.trim() || 'Name der Kategorie'}</span>
        </div>

        <label class="feld-gruppe">
          <span>Name</span>
          <input class="feld" type="text" maxlength="40" enterkeyhint="done" value=${name}
            placeholder="zum Beispiel Gesundheit"
            onInput=${(e) => { setName(e.target.value); setFehler(''); }} />
        </label>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <fieldset class="feld-gruppe">
          <legend>Farbe</legend>
          <div class="farb-wahl">
            ${KATEGORIE_FARBEN.map((f) => html`
              <button type="button" class=${`farb-punkt ${farbe === f.wert ? 'aktiv' : ''}`}
                style=${`background:${f.wert};color:${farbeDarauf(f.wert)}`} aria-label=${f.name} aria-pressed=${farbe === f.wert}
                onClick=${() => setFarbe(f.wert)}>
                ${farbe === f.wert && html`<${Icon} name="check" groesse=${18} strich=${2.4} />`}
              </button>
            `)}
          </div>
        </fieldset>

        <fieldset class="feld-gruppe">
          <legend>Icon</legend>
          <${IconWahl} wert=${icon} onWahl=${setIcon} />
        </fieldset>

        ${vorhanden && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Kategorie löschen
          </button>
        `}
      </form>
    <//>
  `;
}
