// Das Fenster zum Anlegen und Bearbeiten eines Termins.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Blatt, melde, waehle } from './fenster.js';
import { Icon } from './icon.js';
import { loescheTermin } from './loeschen.js';
import { AbstandWahl } from './felder.js';
import * as store from '../store.js';
import * as termine from '../termine.js';
import { plusTage, tageZwischen, zeitZuMin, minZuZeit, tagLesbar } from '../hilfen.js';

// Gängige Wiederholungen zur schnellen Auswahl.
const WIEDERHOLUNGEN = [
  { wert: 'nie', name: 'Nie' },
  { wert: 'tage-1', name: 'Täglich', n: 1, einheit: 'tage' },
  { wert: 'wochen-1', name: 'Wöchentlich', n: 1, einheit: 'wochen' },
  { wert: 'wochen-2', name: 'Alle 2 Wochen', n: 2, einheit: 'wochen' },
  { wert: 'monate-1', name: 'Monatlich', n: 1, einheit: 'monate' },
  { wert: 'jahre-1', name: 'Jährlich', n: 1, einheit: 'jahre' },
  { wert: 'eigen', name: 'Eigener Abstand' },
];

function auswahlFuer(wiederholung) {
  if (!wiederholung) return 'nie';
  const schluessel = `${wiederholung.einheit}-${wiederholung.n}`;
  return WIEDERHOLUNGEN.some((w) => w.wert === schluessel) ? schluessel : 'eigen';
}

// offen: { neu: { datum, von, bis, … } }  oder  { id, start }  (start = Tag des angetippten Vorkommens)
export function TerminBlatt({ offen, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const start = vorhanden || termine.leererTermin(offen.neu || {});

  const [f, setF] = useState(() => ({
    titel: start.titel,
    datum: start.datum,
    bisDatum: start.bisDatum < start.datum ? start.datum : start.bisDatum,
    ganztaegig: start.ganztaegig,
    von: start.von,
    bis: start.bis,
    kategorieId: start.kategorieId,
    wiederholtBis: start.wiederholtBis,
  }));
  const [auswahl, setAuswahl] = useState(auswahlFuer(start.wiederholung));
  const [eigen, setEigen] = useState(start.wiederholung || { n: 3, einheit: 'wochen' });
  const [fehler, setFehler] = useState('');
  const titelFeld = useRef(null);
  const setze = (teil) => { setF((alt) => ({ ...alt, ...teil })); setFehler(''); };

  useEffect(() => {
    if (!vorhanden && titelFeld.current) titelFeld.current.focus();
  }, []);

  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);

  // Wird der Beginn verschoben, wandert das Ende mit, damit die Länge gleich bleibt.
  const setzeBeginnDatum = (datum) => {
    if (!datum) return;
    const laenge = Math.max(0, tageZwischen(f.datum, f.bisDatum));
    setze({ datum, bisDatum: plusTage(datum, laenge) });
  };
  const setzeBeginnZeit = (von) => {
    if (!von) return;
    const laenge = f.datum === f.bisDatum ? Math.max(15, zeitZuMin(f.bis) - zeitZuMin(f.von)) : null;
    if (laenge === null) { setze({ von }); return; }
    setze({ von, bis: minZuZeit(Math.min(23 * 60 + 59, zeitZuMin(von) + laenge)) });
  };

  const speichern = (e) => {
    if (e) e.preventDefault();
    const titel = f.titel.trim();
    if (!titel) {
      setFehler('Gib dem Termin einen Titel.');
      if (titelFeld.current) titelFeld.current.focus();
      return;
    }
    if (f.bisDatum < f.datum) {
      setFehler('Das Ende liegt vor dem Beginn.');
      return;
    }
    if (!f.ganztaegig && f.datum === f.bisDatum && zeitZuMin(f.bis) <= zeitZuMin(f.von)) {
      setFehler('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }
    let wiederholung = null;
    if (auswahl === 'eigen') {
      if (!Number.isInteger(eigen.n) || eigen.n < 1) {
        setFehler('Der Abstand der Wiederholung muss mindestens 1 sein.');
        return;
      }
      wiederholung = { n: eigen.n, einheit: eigen.einheit };
    } else if (auswahl !== 'nie') {
      const w = WIEDERHOLUNGEN.find((x) => x.wert === auswahl);
      wiederholung = { n: w.n, einheit: w.einheit };
    }
    if (wiederholung && f.wiederholtBis && f.wiederholtBis < f.datum) {
      setFehler('„Wiederholen bis“ liegt vor dem ersten Termin.');
      return;
    }
    const felder = { ...f, titel, wiederholung, wiederholtBis: wiederholung ? f.wiederholtBis : null };
    if (vorhanden) store.aendern(vorhanden.id, felder);
    else termine.neu(felder);
    onSchliessen();
  };

  const loeschen = async () => {
    if (await loescheTermin(vorhanden, offen.start || null)) onSchliessen();
  };

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Termin anlegen'}</button>
  `;

  return html`
    <${Blatt} titel=${vorhanden ? 'Termin' : 'Neuer Termin'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input ref=${titelFeld} class="feld gross" type="text" maxlength="200" enterkeyhint="done"
            aria-label="Titel" placeholder="Titel des Termins" value=${f.titel}
            onInput=${(e) => setze({ titel: e.target.value })} />
        </form>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <div class="schalter-zeile">
          <span id="ganztag-name">Ganztägig</span>
          <button type="button" class="schalter" role="switch" aria-checked=${f.ganztaegig} aria-labelledby="ganztag-name"
            onClick=${() => setze({ ganztaegig: !f.ganztaegig })}></button>
        </div>

        <fieldset class="feld-gruppe">
          <legend>Beginn</legend>
          <div class="datum-zeit">
            <input class="feld" type="date" aria-label="Beginn, Datum" value=${f.datum}
              onInput=${(e) => setzeBeginnDatum(e.target.value)} />
            ${!f.ganztaegig && html`
              <input class="feld zeit" type="time" aria-label="Beginn, Uhrzeit" value=${f.von}
                onInput=${(e) => setzeBeginnZeit(e.target.value)} />
            `}
          </div>
        </fieldset>

        <fieldset class="feld-gruppe">
          <legend>Ende</legend>
          <div class="datum-zeit">
            <input class="feld" type="date" aria-label="Ende, Datum" value=${f.bisDatum} min=${f.datum}
              onInput=${(e) => e.target.value && setze({ bisDatum: e.target.value })} />
            ${!f.ganztaegig && html`
              <input class="feld zeit" type="time" aria-label="Ende, Uhrzeit" value=${f.bis}
                onInput=${(e) => e.target.value && setze({ bis: e.target.value })} />
            `}
          </div>
        </fieldset>

        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${f.kategorieId || ''} onChange=${(e) => setze({ kategorieId: e.target.value || null })}>
            <option value="">Keine Kategorie</option>
            ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
          ${!kategorien.length && html`<span class="feld-hinweis">Kategorien geben Terminen ihre Farbe. Du legst sie in der Übersicht an.</span>`}
        </label>

        <div class="feld-gruppe">
          <span id="wdh-termin">Wiederholen</span>
          <select class="feld" aria-labelledby="wdh-termin" value=${auswahl} onChange=${(e) => { setAuswahl(e.target.value); setFehler(''); }}>
            ${WIEDERHOLUNGEN.map((w) => html`<option value=${w.wert}>${w.name}</option>`)}
          </select>
          ${auswahl === 'eigen' && html`
            <${AbstandWahl} n=${eigen.n} einheit=${eigen.einheit} mitJahren=${true}
              onAendern=${(a) => { setEigen(a); setFehler(''); }} />
          `}
          ${auswahl !== 'nie' && html`
            <div class="zahl-zeile">
              <span id="wdh-bis">Bis</span>
              <input class="feld" style="flex:1;width:auto;text-align:left" type="date" aria-labelledby="wdh-bis" value=${f.wiederholtBis || ''} min=${f.datum}
                onInput=${(e) => setze({ wiederholtBis: e.target.value || null })} />
            </div>
            <p class="feld-hinweis">${f.wiederholtBis ? 'Die Reihe endet an diesem Tag.' : 'Ohne Datum läuft die Reihe unbegrenzt weiter.'}</p>
          `}
        </div>

        ${vorhanden && vorhanden.wiederholung && html`
          <p class="feld-hinweis">Änderungen gelten für alle Termine dieser Reihe.</p>
        `}

        ${vorhanden && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Termin löschen
          </button>
        `}
      </div>
    <//>
  `;
}
