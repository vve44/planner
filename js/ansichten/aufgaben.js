// Aufgaben: die Übersicht nach Tagen ("Geplant"), alle Projekte und Listen ("Listen")
// und die Ansicht einer einzelnen Liste samt Merkliste.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { IconWahl } from '../bausteine/icon-wahl.js';
import { Blatt, melde, waehle } from '../bausteine/fenster.js';
import { AufgabeZeile, AufgabenGruppe } from '../bausteine/aufgabe-zeile.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import { heute, plusTage } from '../hilfen.js';

// Merkt sich, welche der beiden Ansichten zuletzt offen war.
let gemerkteAnsicht = 'geplant';

export function Aufgaben() {
  useDaten();
  const [ansicht, setAnsicht] = useState(gemerkteAnsicht);
  const wechsle = (neu) => { gemerkteAnsicht = neu; setAnsicht(neu); };

  return html`
    <div class="seite">
      <div class="wahl" role="group" aria-label="Ansicht">
        <button type="button" class=${ansicht === 'geplant' ? 'aktiv' : ''} aria-pressed=${ansicht === 'geplant'} onClick=${() => wechsle('geplant')}>Geplant</button>
        <button type="button" class=${ansicht === 'listen' ? 'aktiv' : ''} aria-pressed=${ansicht === 'listen'} onClick=${() => wechsle('listen')}>Listen</button>
      </div>
      ${ansicht === 'geplant' ? html`<${Geplant} />` : html`<${Listen} />`}
    </div>
  `;
}

// ---------- Geplant: nach Tagen ----------

function Geplant() {
  const [zeigeErledigte, setZeigeErledigte] = useState(false);
  const tag = heute();
  const morgen = plusTage(tag, 1);
  const merk = aufgaben.merkliste();
  const alle = aufgaben.alleAufgaben();
  const offene = alle.filter((a) => !a.erledigtAm);

  const ueberfaellig = aufgaben.sortiere(offene.filter((a) => a.plandatum && a.plandatum < tag));
  const fuerHeute = aufgaben.sortiere(offene.filter((a) => a.plandatum === tag));
  const heuteGeschafft = aufgaben.sortiereErledigte(alle.filter((a) => aufgaben.heuteErledigt(a)));
  const fuerMorgen = aufgaben.sortiere(offene.filter((a) => a.plandatum === morgen));
  const spaeter = aufgaben.sortiere(offene.filter((a) => a.plandatum && a.plandatum > morgen));
  // Was in der Merkliste steht, taucht hier nicht noch einmal auf.
  const ohneDatum = aufgaben.sortiere(offene.filter((a) => !a.plandatum && (!merk || a.projektId !== merk.id)));
  const frueherErledigt = aufgaben.sortiereErledigte(alle.filter((a) => a.erledigtAm && !aufgaben.heuteErledigt(a)));

  const leer = !alle.filter((a) => !merk || a.projektId !== merk.id).length;

  return html`
    ${leer ? html`
      <section class="leer">
        <span class="leer-icon"><${Icon} name="list-checks" groesse=${28} strich=${1.4} /></span>
        <h2>Noch keine Aufgaben</h2>
        <p class="text-leise">Leg deine erste Aufgabe an. Titel reicht, alles andere ist freiwillig.</p>
        <button class="knopf" type="button" onClick=${() => oeffneAufgabe({ vorgaben: { plandatum: tag } })}>
          <${Icon} name="plus" /> Aufgabe anlegen
        </button>
      </section>
    ` : html`
      <${AufgabenGruppe} titel="Überfällig" liste=${ueberfaellig} warnung=${true} zeigeDatum=${true} mitMorgen=${true} />
      <${AufgabenGruppe} titel="Heute" liste=${[...fuerHeute, ...heuteGeschafft]} mitMorgen=${true} leerText="Für heute ist nichts geplant." />
      <${AufgabenGruppe} titel="Morgen" liste=${fuerMorgen} />
      <${AufgabenGruppe} titel="Später" liste=${spaeter} zeigeDatum=${true} />
      <${AufgabenGruppe} titel="Ohne Datum" liste=${ohneDatum} />

      ${frueherErledigt.length > 0 && html`
        <section class="abschnitt">
          <button class="knopf-text" type="button" aria-expanded=${zeigeErledigte} onClick=${() => setZeigeErledigte(!zeigeErledigte)}>
            <${Icon} name=${zeigeErledigte ? 'chevron-up' : 'chevron-down'} groesse=${18} />
            ${zeigeErledigte ? 'Früher Erledigtes ausblenden' : `Früher Erledigtes zeigen (${frueherErledigt.length})`}
          </button>
          ${zeigeErledigte && html`
            <ul class="gruppe">
              ${frueherErledigt.slice(0, 100).map((a) => html`<${AufgabeZeile} key=${a.id} aufgabe=${a} zeigeDatum=${true} />`)}
            </ul>
          `}
        </section>
      `}

      <button class="knopf-plus" type="button" aria-label="Aufgabe anlegen"
        onClick=${() => oeffneAufgabe({ vorgaben: { plandatum: tag } })}>
        <${Icon} name="plus" groesse=${26} />
      </button>
    `}
  `;
}

// ---------- Listen: Merkliste, Projekte und Listen nach Kategorie ----------

function offeneIn(projektId) {
  return aufgaben.alleAufgaben().filter((a) => a.projektId === projektId && !a.erledigtAm).length;
}

function ListenZeile({ projekt }) {
  const anzahl = offeneIn(projekt.id);
  return html`
    <li class="zeile">
      <button class="zeile-haupt" type="button" onClick=${() => geheZu(projekt.istMerkliste ? 'merkliste' : `liste/${projekt.id}`)}>
        <span class="listen-icon"><${Icon} name=${projekt.icon || 'list'} groesse=${20} /></span>
        <span class="zeile-text"><strong>${projekt.name}</strong></span>
        <span class="zeile-zahl">${anzahl || ''}</span>
        <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
      </button>
    </li>
  `;
}

function Listen() {
  const [neu, setNeu] = useState(false);
  const merk = aufgaben.merkliste();
  const alle = aufgaben.projekte();
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);
  const bekannte = new Set(kategorien.map((k) => k.id));
  const ohneKategorie = alle.filter((p) => !p.kategorieId || !bekannte.has(p.kategorieId));

  return html`
    ${merk && html`<ul class="gruppe"><${ListenZeile} projekt=${merk} /></ul>`}

    ${kategorien.map((k) => {
      const eigene = alle.filter((p) => p.kategorieId === k.id);
      if (!eigene.length) return null;
      return html`
        <section class="abschnitt" key=${k.id}>
          <div class="abschnitt-kopf">
            <h2><i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${k.farbe}`}></i>${k.name}</h2>
          </div>
          <ul class="gruppe">${eigene.map((p) => html`<${ListenZeile} key=${p.id} projekt=${p} />`)}</ul>
        </section>
      `;
    })}

    ${ohneKategorie.length > 0 && html`
      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Ohne Kategorie</h2></div>
        <ul class="gruppe">${ohneKategorie.map((p) => html`<${ListenZeile} key=${p.id} projekt=${p} />`)}</ul>
      </section>
    `}

    ${!alle.length && html`
      <p class="text-leise">
        Projekte und Listen bündeln Aufgaben, zum Beispiel „Umzug“ oder „Einkauf“. Jede Liste kann zu einer Kategorie gehören.
      </p>
    `}

    <button class="knopf leise breit" type="button" onClick=${() => setNeu(true)}>
      <${Icon} name="plus" groesse=${20} /> Projekt oder Liste anlegen
    </button>

    ${neu && html`<${ProjektBlatt} onSchliessen=${() => setNeu(false)} />`}
  `;
}

// ---------- Eine einzelne Liste ----------

export function Liste({ teil }) {
  useDaten();
  const projekt = teil ? store.hole(teil) : null;
  if (!projekt || projekt.geloeschtAm || projekt.typ !== 'projekt') {
    return html`
      <div class="seite">
        <section class="leer">
          <h2>Diese Liste gibt es nicht mehr</h2>
          <button class="knopf" type="button" onClick=${() => geheZu('aufgaben')}>Zu den Aufgaben</button>
        </section>
      </div>
    `;
  }
  return html`<${ListenInhalt} projekt=${projekt} />`;
}

export function Merkliste() {
  useDaten();
  const projekt = aufgaben.merkliste();
  if (!projekt) return null;
  return html`<${ListenInhalt} projekt=${projekt} />`;
}

function ListenInhalt({ projekt }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [zeigeErledigte, setZeigeErledigte] = useState(false);
  const [entwurf, setEntwurf] = useState('');

  const eigene = aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id);
  const offene = aufgaben.sortiere(eigene.filter((a) => !a.erledigtAm));
  const erledigte = aufgaben.sortiereErledigte(eigene.filter((a) => a.erledigtAm));
  const kategorie = projekt.kategorieId ? store.hole(projekt.kategorieId) : null;
  const kategorieDa = kategorie && !kategorie.geloeschtAm;

  const schnellHinzu = (e) => {
    e.preventDefault();
    const titel = entwurf.trim();
    if (!titel) return;
    aufgaben.neueAufgabe({ titel, projektId: projekt.id }, null);
    setEntwurf('');
  };

  return html`
    <div class="seite">
      ${projekt.istMerkliste ? html`
        <form class="schnell-eingabe" onSubmit=${schnellHinzu}>
          <input class="feld" type="text" maxlength="200" enterkeyhint="done" aria-label="Neuer Eintrag"
            placeholder="Woran willst du denken?" value=${entwurf} onInput=${(e) => setEntwurf(e.target.value)} />
          <button class="knopf" type="submit" aria-label="Eintrag hinzufügen"><${Icon} name="plus" /></button>
        </form>
      ` : html`
        <div class="leiste">
          <p class="text-leise">
            ${kategorieDa
              ? html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${kategorie.farbe}`}></i>${kategorie.name}`
              : 'Ohne Kategorie'}
          </p>
          <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
        </div>
      `}

      ${offene.length ? html`
        <ul class="gruppe">
          ${offene.map((a) => html`<${AufgabeZeile} key=${a.id} aufgabe=${a} zeigeDatum=${true} zeigeListe=${false} />`)}
        </ul>
      ` : html`
        <div class="gruppe">
          <p class="leer-zeile">
            ${projekt.istMerkliste
              ? 'Die Merkliste ist leer. Hier sammelst du Dinge ohne Termin, an die du denken willst.'
              : erledigte.length ? 'Alles erledigt.' : 'Noch keine Aufgaben in dieser Liste.'}
          </p>
        </div>
      `}

      ${erledigte.length > 0 && html`
        <section class="abschnitt">
          <button class="knopf-text" type="button" aria-expanded=${zeigeErledigte} onClick=${() => setZeigeErledigte(!zeigeErledigte)}>
            <${Icon} name=${zeigeErledigte ? 'chevron-up' : 'chevron-down'} groesse=${18} />
            ${zeigeErledigte ? 'Erledigtes ausblenden' : `Erledigtes zeigen (${erledigte.length})`}
          </button>
          ${zeigeErledigte && html`
            <ul class="gruppe">
              ${erledigte.slice(0, 100).map((a) => html`<${AufgabeZeile} key=${a.id} aufgabe=${a} zeigeListe=${false} />`)}
            </ul>
          `}
        </section>
      `}

      <button class="knopf-plus" type="button" aria-label=${`Aufgabe in „${projekt.name}“ anlegen`}
        onClick=${() => oeffneAufgabe({ vorgaben: { projektId: projekt.id } })}>
        <${Icon} name="plus" groesse=${26} />
      </button>

      ${bearbeiten && html`<${ProjektBlatt} projekt=${projekt} onSchliessen=${() => setBearbeiten(false)} />`}
    </div>
  `;
}

// ---------- Projekt oder Liste anlegen und bearbeiten ----------

function ProjektBlatt({ projekt = null, onSchliessen }) {
  const [name, setName] = useState(projekt ? projekt.name : '');
  const [kategorieId, setKategorieId] = useState(projekt ? projekt.kategorieId : null);
  const [icon, setIcon] = useState(projekt ? projekt.icon : 'list');
  const [fehler, setFehler] = useState('');
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler('Gib der Liste einen Namen.');
      return;
    }
    if (projekt) {
      store.aendern(projekt.id, { name: sauber, kategorieId, icon });
      onSchliessen();
    } else {
      const neu = aufgaben.neuesProjekt({ name: sauber, kategorieId, icon });
      onSchliessen();
      geheZu(`liste/${neu.id}`);
    }
  };

  const loeschen = async () => {
    const anzahl = aufgaben.alleAufgaben().filter((a) => a.projektId === projekt.id).length;
    let mitAufgaben = false;
    if (anzahl) {
      const wahl = await waehle({
        titel: `„${projekt.name}“ löschen`,
        text: anzahl === 1 ? 'In dieser Liste steht 1 Aufgabe. Was soll mit ihr passieren?' : `In dieser Liste stehen ${anzahl} Aufgaben. Was soll mit ihnen passieren?`,
        optionen: [
          { wert: 'behalten', name: 'Aufgaben behalten, ohne Liste' },
          { wert: 'mit', name: 'Aufgaben mit löschen', art: 'gefahr' },
        ],
      });
      if (!wahl) return;
      mitAufgaben = wahl === 'mit';
    }
    const zurueck = aufgaben.loescheProjekt(projekt.id, { mitAufgaben });
    onSchliessen();
    geheZu('aufgaben');
    melde(`„${projekt.name}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${speichern}>${projekt ? 'Änderungen speichern' : 'Anlegen'}</button>
  `;

  return html`
    <${Blatt} titel=${projekt ? 'Liste bearbeiten' : 'Projekt oder Liste'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <form class="formular" onSubmit=${speichern}>
        <label class="feld-gruppe">
          <span>Name</span>
          <input class="feld" type="text" maxlength="60" enterkeyhint="done" value=${name}
            placeholder="zum Beispiel Umzug" onInput=${(e) => { setName(e.target.value); setFehler(''); }} />
        </label>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

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

        ${projekt && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Liste löschen
          </button>
        `}
      </form>
    <//>
  `;
}
