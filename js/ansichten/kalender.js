// Kalender: Tag, 7 Tage, Monat und Agenda. Termine anlegen, Aufgaben sehen und einplanen.
// Dieser Bereich nutzt die grün-blaue Farbwelt, alles andere die warmen Brauntöne.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { waehle } from '../bausteine/fenster.js';
import { Raster } from '../bausteine/kalender-raster.js';
import { TerminBlatt } from '../bausteine/termin-blatt.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as termine from '../termine.js';
import {
  heute, plusTage, plusMonate, montagVon, monatsErster, monatLesbar, tagAusfuehrlich, spanneLesbar,
  tagLesbar, wochentagKurz, datumAusText, minZuZeit, zeitZuMin,
} from '../hilfen.js';
import { WOCHENTAGE } from '../typen.js';

const ANSICHTEN = [
  { wert: 'tag', name: 'Tag' },
  { wert: 'woche', name: '7 Tage' },
  { wert: 'monat', name: 'Monat' },
  { wert: 'agenda', name: 'Agenda' },
];
const TERMIN_FARBE = '#7ba6a5';
const AUFGABEN_FARBE = '#4c6f72';

// Der zuletzt gezeigte Tag bleibt erhalten, solange die App offen ist.
let gemerkterTag = null;

function farbeVon(termin) {
  const kategorie = termin.kategorieId ? store.hole(termin.kategorieId) : null;
  return kategorie && !kategorie.geloeschtAm ? kategorie.farbe : TERMIN_FARBE;
}

export function Kalender() {
  useDaten();
  const [datum, setDatumRoh] = useState(gemerkterTag || heute());
  const [terminOffen, setTerminOffen] = useState(null);
  const [entwurf, setEntwurf] = useState('');
  const ansicht = store.einstellung('kalender.ansicht', 'tag');
  const tag0 = heute();

  const setDatum = (d) => { gemerkterTag = d; setDatumRoh(d); };
  const setAnsicht = (a) => store.setzeEinstellung('kalender.ansicht', a);

  const montag = montagVon(datum);
  const woche = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));

  const blaettere = (richtung) => {
    if (ansicht === 'tag') setDatum(plusTage(datum, richtung));
    else if (ansicht === 'woche') setDatum(plusTage(datum, richtung * 7));
    else if (ansicht === 'monat') setDatum(plusMonate(monatsErster(datum), richtung));
    else setDatum(plusTage(datum, richtung * 14));
  };

  let titel = tagAusfuehrlich(datum);
  let zeigtHeute = datum === tag0;
  if (ansicht === 'woche') { titel = spanneLesbar(woche[0], woche[6]); zeigtHeute = woche.includes(tag0); }
  if (ansicht === 'monat') { titel = monatLesbar(datum); zeigtHeute = datum.slice(0, 7) === tag0.slice(0, 7); }
  if (ansicht === 'agenda') titel = `Ab ${tagLesbar(datum)}`;

  const oeffneTermin = (v) => setTerminOffen({ id: v.termin.id, start: v.start });
  const neuerTermin = (tag, min) => {
    const vorgaben = { datum: tag, bisDatum: tag };
    if (min !== undefined) {
      vorgaben.von = minZuZeit(min);
      vorgaben.bis = minZuZeit(Math.min(23 * 60 + 59, min + 60));
    }
    setTerminOffen({ neu: vorgaben });
  };

  const plus = async () => {
    const wahl = await waehle({
      titel: 'Was möchtest du anlegen?',
      optionen: [
        { wert: 'termin', name: 'Termin' },
        { wert: 'aufgabe', name: 'Aufgabe', art: 'leise' },
      ],
    });
    if (wahl === 'termin') neuerTermin(datum);
    if (wahl === 'aufgabe') oeffneAufgabe({ vorgaben: { plandatum: datum } });
  };

  const schnellAufgabe = (e) => {
    e.preventDefault();
    const text = entwurf.trim();
    if (!text) return;
    aufgaben.neueAufgabe({ titel: text, plandatum: datum }, null);
    setEntwurf('');
  };

  return html`
    <div class="kalender">
      <div class="kal-kopf">
        <div class="wahl" role="group" aria-label="Ansicht">
          ${ANSICHTEN.map((a) => html`
            <button type="button" class=${ansicht === a.wert ? 'aktiv' : ''} aria-pressed=${ansicht === a.wert} onClick=${() => setAnsicht(a.wert)}>${a.name}</button>
          `)}
        </div>
        <div class="kal-nav">
          <button class="knopf-rund" type="button" aria-label="Zurück blättern" onClick=${() => blaettere(-1)}>
            <${Icon} name="chevron-left" />
          </button>
          <h2>${titel}</h2>
          ${!zeigtHeute && html`<button class="kal-heute" type="button" onClick=${() => setDatum(tag0)}>Heute</button>`}
          <button class="knopf-rund" type="button" aria-label="Vor blättern" onClick=${() => blaettere(1)}>
            <${Icon} name="chevron-right" />
          </button>
        </div>
        ${ansicht === 'tag' && html`
          <form class="schnell-eingabe" onSubmit=${schnellAufgabe}>
            <input class="feld" type="text" maxlength="200" enterkeyhint="done" aria-label="Neue Aufgabe für diesen Tag"
              placeholder="Aufgabe für diesen Tag" value=${entwurf} onInput=${(e) => setEntwurf(e.target.value)} />
            <button class="knopf" type="submit" aria-label="Aufgabe hinzufügen"><${Icon} name="plus" /></button>
          </form>
        `}
      </div>

      ${ansicht === 'tag' && html`<${Raster} key="tag" tage=${[datum]} onTermin=${oeffneTermin} onLeer=${neuerTermin} />`}
      ${ansicht === 'woche' && html`<${Raster} key="woche" tage=${woche} breit=${true} onTermin=${oeffneTermin} onLeer=${neuerTermin} />`}
      ${ansicht === 'monat' && html`
        <${Monat} datum=${datum} onTag=${setDatum} onTagOeffnen=${(tag) => { setDatum(tag); setAnsicht('tag'); }} onTermin=${oeffneTermin} />
      `}
      ${ansicht === 'agenda' && html`<${Agenda} datum=${datum} onTermin=${oeffneTermin} />`}

      <button class="kal-plus" type="button" aria-label="Termin oder Aufgabe anlegen" onClick=${plus}>
        <${Icon} name="plus" groesse=${26} />
      </button>

      ${terminOffen && html`<${TerminBlatt} key=${terminOffen.id || 'neu'} offen=${terminOffen} onSchliessen=${() => setTerminOffen(null)} />`}
    </div>
  `;
}

// ---------- Was an einem Tag ansteht, als Liste (für Monat und Agenda) ----------

function eintraegeAlsListe(tag, liste, alleAufgaben) {
  const { ganztags, zeitlich } = termine.eintraegeAm(tag, liste);
  const eigene = alleAufgaben.filter((a) => a.plandatum === tag);
  const zeilen = [];
  ganztags.forEach((v) => zeilen.push({ art: 'termin', v, zeit: 'Ganztägig', sortierung: -1, titel: v.termin.titel, farbe: farbeVon(v.termin) }));
  zeitlich.forEach((v) => zeilen.push({ art: 'termin', v, zeit: termine.zeitText(v, tag), sortierung: v.vonMin, titel: v.termin.titel, farbe: farbeVon(v.termin) }));
  eigene.filter((a) => a.startzeit).forEach((a) => zeilen.push({ art: 'aufgabe', a, zeit: a.startzeit, sortierung: zeitZuMin(a.startzeit), titel: a.titel, farbe: AUFGABEN_FARBE }));
  aufgaben.sortiere(eigene.filter((a) => !a.startzeit && !a.erledigtAm))
    .forEach((a) => zeilen.push({ art: 'aufgabe', a, zeit: 'Aufgabe', sortierung: 2000, titel: a.titel, farbe: AUFGABEN_FARBE }));
  return zeilen.sort((x, y) => x.sortierung - y.sortierung);
}

function TagesListe({ zeilen, onTermin }) {
  return html`
    <ul class="gruppe">
      ${zeilen.map((z) => {
        const fertig = z.art === 'aufgabe' && Boolean(z.a.erledigtAm);
        const kategorie = z.art === 'termin' && z.v.termin.kategorieId ? store.hole(z.v.termin.kategorieId) : null;
        return html`
          <li key=${z.art === 'termin' ? `${z.v.termin.id}-${z.v.start}` : z.a.id}>
            <button type="button" class=${`agenda-zeile ${fertig ? 'erledigt' : ''}`}
              onClick=${() => (z.art === 'termin' ? onTermin(z.v) : oeffneAufgabe({ id: z.a.id }))}>
              <span class="agenda-zeit">${z.zeit}</span>
              <i class="agenda-farbe" style=${`background:${z.farbe}`}></i>
              <span class="agenda-text">
                <strong>${z.titel}</strong>
                ${z.art === 'aufgabe' && z.zeit !== 'Aufgabe' && html`<span>Aufgabe</span>`}
                ${kategorie && !kategorie.geloeschtAm && html`<span>${kategorie.name}</span>`}
              </span>
              ${z.art === 'aufgabe' && html`<${Icon} name=${fertig ? 'circle-check' : 'list-checks'} groesse=${17} klasse="agenda-art" />`}
            </button>
          </li>
        `;
      })}
    </ul>
  `;
}

// ---------- Monat ----------

function Monat({ datum, onTag, onTagOeffnen, onTermin }) {
  const erster = monatsErster(datum);
  const start = montagVon(erster);
  const monat = erster.slice(0, 7);
  let tage = Array.from({ length: 42 }, (_, i) => plusTage(start, i));
  // Die sechste Woche nur zeigen, wenn sie noch Tage des Monats enthält.
  if (tage[35].slice(0, 7) !== monat) tage = tage.slice(0, 35);

  const liste = termine.vorkommenIm(tage[0], tage[tage.length - 1]);
  const alleAufgaben = aufgaben.alleAufgaben();
  const tag0 = heute();
  const zeilen = eintraegeAlsListe(datum, liste, alleAufgaben);

  return html`
    <div class="kal-scroll">
      <div class="monat">
        <div class="monat-wochentage" aria-hidden="true">
          ${WOCHENTAGE.map((w) => html`<span>${w.kurz}</span>`)}
        </div>
        <div class="monat-raster">
          ${tage.map((tag) => {
            const eintraege = eintraegeAlsListe(tag, liste, alleAufgaben).filter((z) => !(z.art === 'aufgabe' && z.a.erledigtAm));
            const klassen = ['monat-tag'];
            if (tag.slice(0, 7) !== monat) klassen.push('ausserhalb');
            if (tag === tag0) klassen.push('heute');
            if (tag === datum) klassen.push('gewaehlt');
            return html`
              <button type="button" class=${klassen.join(' ')} key=${tag}
                aria-label=${`${tagAusfuehrlich(tag)}, ${eintraege.length === 1 ? '1 Eintrag' : `${eintraege.length} Einträge`}`}
                aria-pressed=${tag === datum}
                onClick=${() => (tag === datum ? onTagOeffnen(tag) : onTag(tag))}>
                <span class="zahl">${datumAusText(tag).getDate()}</span>
                <span class="monat-punkte">
                  ${eintraege.slice(0, 4).map((z) => html`<i style=${`background:${z.farbe}`}></i>`)}
                </span>
              </button>
            `;
          })}
        </div>
      </div>

      <section class="abschnitt kal-abschnitt">
        <div class="abschnitt-kopf">
          <h2>${tagAusfuehrlich(datum)}</h2>
          <button class="knopf-text" type="button" onClick=${() => onTagOeffnen(datum)}>Tag öffnen</button>
        </div>
        ${zeilen.length
          ? html`<${TagesListe} zeilen=${zeilen} onTermin=${onTermin} />`
          : html`<div class="gruppe"><p class="leer-zeile">An diesem Tag steht nichts an.</p></div>`}
      </section>
    </div>
  `;
}

// ---------- Agenda: die kommenden sechs Wochen als Liste ----------

function Agenda({ datum, onTermin }) {
  const tage = Array.from({ length: 42 }, (_, i) => plusTage(datum, i));
  const liste = termine.vorkommenIm(tage[0], tage[41]);
  const alleAufgaben = aufgaben.alleAufgaben();
  const tageMitEintrag = tage
    .map((tag) => ({ tag, zeilen: eintraegeAlsListe(tag, liste, alleAufgaben) }))
    .filter((t) => t.zeilen.length);

  return html`
    <div class="kal-scroll">
      ${tageMitEintrag.length ? tageMitEintrag.map((t) => html`
        <section class="abschnitt kal-abschnitt" key=${t.tag}>
          <div class="abschnitt-kopf">
            <h2>${tagLesbar(t.tag)}${['Heute', 'Morgen', 'Gestern'].includes(tagLesbar(t.tag)) ? `, ${wochentagKurz(t.tag)}.` : ''}</h2>
          </div>
          <${TagesListe} zeilen=${t.zeilen} onTermin=${onTermin} />
        </section>
      `) : html`
        <section class="leer">
          <span class="leer-icon"><${Icon} name="calendar-days" groesse=${28} strich=${1.4} /></span>
          <h2>Nichts geplant</h2>
          <p class="text-leise">In den sechs Wochen ab ${tagLesbar(datum)} stehen keine Termine und keine Aufgaben an.</p>
        </section>
      `}
    </div>
  `;
}
