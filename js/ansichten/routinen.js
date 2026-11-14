// Routinen: Vorlagen für Aufgaben mit festem Paket an Unteraufgaben.
// "Einplanen" öffnet das Aufgaben-Fenster mit allem vorbelegt.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { IconWahl } from '../bausteine/icon-wahl.js';
import { PunktListe, DauerWahl } from '../bausteine/felder.js';
import { Blatt, melde } from '../bausteine/fenster.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import * as routinen from '../routinen.js';
import { neuerPunkt } from '../aufgaben.js';
import { heute, dauerLesbar } from '../hilfen.js';

export function Routinen() {
  useDaten();
  const [offen, setOffen] = useState(null); // null | { neu: true } | { id }
  const liste = routinen.alle();

  const einplanen = (routine) => {
    oeffneAufgabe({ vorgaben: { ...routinen.vorgabenAus(routine), plandatum: heute() } });
  };

  if (!liste.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="clipboard-list" groesse=${28} strich=${1.4} /></span>
          <h2>Noch keine Routinen</h2>
          <p class="text-leise">
            Eine Routine ist eine Aufgabe mit immer demselben Paket an Unteraufgaben, zum Beispiel „Selfcare-Routine“.
            Du planst sie mit einem Tipp ein, einmalig oder wiederkehrend.
          </p>
          <button class="knopf" type="button" onClick=${() => setOffen({ neu: true })}>
            <${Icon} name="plus" /> Routine anlegen
          </button>
        </section>
        ${offen && html`<${RoutineBlatt} offen=${offen} onSchliessen=${() => setOffen(null)} />`}
      </div>
    `;
  }

  return html`
    <div class="seite">
      <ul class="gruppe">
        ${liste.map((r) => {
          const teile = [];
          if (r.unteraufgaben.length) teile.push(r.unteraufgaben.length === 1 ? '1 Unteraufgabe' : `${r.unteraufgaben.length} Unteraufgaben`);
          if (r.dauerMin) teile.push(dauerLesbar(r.dauerMin));
          return html`
            <li class="zeile" key=${r.id}>
              <button class="zeile-haupt" type="button" onClick=${() => setOffen({ id: r.id })}>
                <span class="listen-icon"><${Icon} name=${r.icon || 'clipboard-list'} groesse=${20} /></span>
                <span class="zeile-text">
                  <strong>${r.titel}</strong>
                  ${teile.length > 0 && html`<span>${teile.join(', ')}</span>`}
                </span>
              </button>
              <button class="zeilen-knopf" type="button" aria-label=${`${r.titel} einplanen`} onClick=${() => einplanen(r)}>Einplanen</button>
            </li>
          `;
        })}
      </ul>

      <button class="knopf-plus" type="button" aria-label="Routine anlegen" onClick=${() => setOffen({ neu: true })}>
        <${Icon} name="plus" groesse=${26} />
      </button>

      ${offen && html`<${RoutineBlatt} offen=${offen} onSchliessen=${() => setOffen(null)} />`}
    </div>
  `;
}

function RoutineBlatt({ offen, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const [titel, setTitel] = useState(vorhanden ? vorhanden.titel : '');
  const [dauerMin, setDauerMin] = useState(vorhanden ? vorhanden.dauerMin : null);
  const [kategorieId, setKategorieId] = useState(vorhanden ? vorhanden.kategorieId : null);
  const [icon, setIcon] = useState(vorhanden ? vorhanden.icon : null);
  const [punkte, setPunkte] = useState(vorhanden ? vorhanden.unteraufgaben : []);
  const [entwurf, setEntwurf] = useState('');
  const [fehler, setFehler] = useState('');
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler('Gib der Routine einen Namen.');
      return;
    }
    const unteraufgaben = [...punkte, neuerPunkt(entwurf)]
      .map((p) => ({ id: p.id, text: p.text.trim(), erledigt: false }))
      .filter((p) => p.text);
    const felder = { titel: sauber, dauerMin, kategorieId, icon, unteraufgaben };
    if (vorhanden) store.aendern(vorhanden.id, felder);
    else routinen.neu(felder);
    onSchliessen();
  };

  const loeschen = () => {
    const id = vorhanden.id;
    store.loeschen(id);
    onSchliessen();
    melde(`„${vorhanden.titel}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: () => store.wiederherstellen(id) });
  };

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Routine anlegen'}</button>
  `;

  return html`
    <${Blatt} titel=${vorhanden ? 'Routine bearbeiten' : 'Neue Routine'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input class="feld gross" type="text" maxlength="200" enterkeyhint="done" aria-label="Name der Routine"
            placeholder="zum Beispiel Selfcare-Routine" value=${titel}
            onInput=${(e) => { setTitel(e.target.value); setFehler(''); }} />
        </form>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <fieldset class="feld-gruppe">
          <legend>Unteraufgaben</legend>
          <${PunktListe} punkte=${punkte} onAendern=${setPunkte} entwurf=${entwurf} onEntwurf=${setEntwurf}
            platzhalter="Unteraufgabe hinzufügen" ohneHaken=${true} />
        </fieldset>

        <fieldset class="feld-gruppe">
          <legend>Dauer</legend>
          <${DauerWahl} wert=${dauerMin} onWahl=${setDauerMin} />
        </fieldset>

        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
            <option value="">Keine Kategorie</option>
            ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
        </label>

        <fieldset class="feld-gruppe">
          <legend>Icon</legend>
          <${IconWahl} wert=${icon} ohneErlaubt=${true} onWahl=${setIcon} />
        </fieldset>

        ${vorhanden && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Routine löschen
          </button>
        `}
      </div>
    <//>
  `;
}
