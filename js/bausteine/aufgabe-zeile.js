// Eine Aufgabe als Zeile in einer Liste: Haken, Titel, Angaben, Unteraufgaben.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { melde } from './fenster.js';
import { oeffneAufgabe } from './aufgabe-blatt.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import { beschreibeRegel } from '../regeln.js';
import { tagLesbar, dauerLesbar } from '../hilfen.js';
import { PRIORITAETEN } from '../typen.js';

// zeigeDatum:  Plandatum in der Zeile nennen (in Listen, die nicht nach Tagen gruppiert sind)
// zeigeListe:  Liste oder Kategorie nennen
// mitMorgen:   Knopf "auf morgen verschieben" zeigen
export function AufgabeZeile({ aufgabe, zeigeDatum = false, zeigeListe = true, mitMorgen = false }) {
  const [offen, setOffen] = useState(false);
  const erledigt = Boolean(aufgabe.erledigtAm);
  const { gesamt, erledigt: teilErledigt } = aufgaben.fortschritt(aufgabe);
  const serie = aufgaben.serieVon(aufgabe);
  const projekt = aufgaben.projektVon(aufgabe);
  const kategorie = aufgaben.kategorieVon(aufgabe);
  const ueberfaellig = aufgaben.istUeberfaellig(aufgabe);
  const lage = aufgaben.deadlineLage(aufgabe);
  const hatNotiz = Boolean(aufgabe.notiz) || aufgabe.checkliste.length > 0;
  const eintrag = aufgabe.poolEintragId ? store.hole(aufgabe.poolEintragId) : null;
  const pool = eintrag ? store.hole(eintrag.poolId) : null;
  const herkunft = projekt && !projekt.istMerkliste ? projekt.name : pool && !pool.geloeschtAm ? pool.name : kategorie ? kategorie.name : null;

  const aufMorgen = () => {
    const zurueck = aufgaben.verschiebeAufMorgen(aufgabe.id);
    melde('Auf morgen verschoben', { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  return html`
    <li class=${`aufgabe ${erledigt ? 'erledigt' : ''}`} data-lang=${`aufgabe:${aufgabe.id}`}>
      <div class="aufgabe-zeile">
        <button class="haken" type="button" aria-pressed=${erledigt}
          aria-label=${erledigt ? `${aufgabe.titel} wieder öffnen` : `${aufgabe.titel} abhaken`}
          onClick=${() => aufgaben.schalteErledigt(aufgabe.id)}>
          <span class="haken-kreis">${erledigt && html`<${Icon} name="check" groesse=${15} strich=${2.6} />`}</span>
        </button>

        <button class="aufgabe-haupt" type="button" onClick=${() => oeffneAufgabe({ id: aufgabe.id })}>
          <span class="aufgabe-titel">
            ${aufgabe.icon && html`<${Icon} name=${aufgabe.icon} groesse=${18} />`}
            ${aufgabe.titel}
          </span>
          <span class="aufgabe-meta">
            ${aufgabe.prioritaet > 0 && html`
              <span class=${aufgabe.prioritaet === 3 ? 'warnung' : aufgabe.prioritaet === 2 ? 'gold' : ''}>
                <${Icon} name="flag" groesse=${14} /> ${PRIORITAETEN[aufgabe.prioritaet].name}
              </span>
            `}
            ${zeigeDatum && aufgabe.plandatum && html`
              <span class=${ueberfaellig ? 'warnung' : ''}><${Icon} name="calendar" groesse=${14} /> ${tagLesbar(aufgabe.plandatum)}</span>
            `}
            ${aufgabe.startzeit && aufgabe.plandatum && html`<span><${Icon} name="clock" groesse=${14} /> ${aufgabe.startzeit} Uhr</span>`}
            ${aufgabe.dauerMin && html`<span><${Icon} name="timer" groesse=${14} /> ${dauerLesbar(aufgabe.dauerMin)}</span>`}
            ${serie && html`<span><${Icon} name="repeat" groesse=${14} /> ${beschreibeRegel(serie.regel, serie.modus)}</span>`}
            ${aufgabe.deadline && html`
              <span class=${lage ? 'warnung' : ''}>
                <${Icon} name="calendar-clock" groesse=${14} />
                ${lage === 'vorbei' ? 'Deadline war' : 'Deadline'} ${tagLesbar(aufgabe.deadline)}
              </span>
            `}
            ${hatNotiz && html`<span aria-label="Mit Notiz"><${Icon} name="text" groesse=${14} /></span>`}
            ${zeigeListe && herkunft && html`
              <span>
                ${kategorie && html`<i class="farb-tupfer" style=${`background:${kategorie.farbe}`}></i>`}
                ${herkunft}
              </span>
            `}
          </span>
        </button>

        <span class="aufgabe-neben">
          ${gesamt > 0 && html`
            <button type="button" aria-expanded=${offen}
              aria-label=${`Unteraufgaben ${offen ? 'einklappen' : 'zeigen'}: ${teilErledigt} von ${gesamt} erledigt`}
              onClick=${() => setOffen(!offen)}>
              ${teilErledigt}/${gesamt}
              <${Icon} name=${offen ? 'chevron-up' : 'chevron-down'} groesse=${16} />
            </button>
          `}
          ${mitMorgen && !erledigt && html`
            <button type="button" aria-label=${`${aufgabe.titel} auf morgen verschieben`} onClick=${aufMorgen}>
              <${Icon} name="sunrise" groesse=${20} />
            </button>
          `}
        </span>
      </div>

      ${offen && gesamt > 0 && html`
        <ul class="unterliste">
          ${aufgabe.unteraufgaben.map((u) => html`
            <li key=${u.id} class=${u.erledigt ? 'erledigt' : ''}>
              <button class="haken klein" type="button" aria-pressed=${u.erledigt}
                aria-label=${u.erledigt ? `${u.text} wieder öffnen` : `${u.text} abhaken`}
                onClick=${() => aufgaben.schalteUnteraufgabe(aufgabe.id, u.id)}>
                <span class="haken-kreis">${u.erledigt && html`<${Icon} name="check" groesse=${13} strich=${2.6} />`}</span>
              </button>
              <span>${u.text}</span>
            </li>
          `)}
        </ul>
      `}
    </li>
  `;
}

// Mehrere Aufgaben als Gruppe mit Überschrift.
//   kopfLang – Merkmal für langes Drücken auf die Überschrift (Bereiche im Tab „Heute“)
export function AufgabenGruppe({ titel, liste, warnung = false, leerText = null, kopfLang = null, ...optionen }) {
  if (!liste.length && !leerText) return null;
  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
        <h2 class=${warnung ? 'warnung' : ''}>${titel}</h2>
        ${liste.length > 0 && html`<span>${liste.length}</span>`}
      </div>
      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map((a) => html`<${AufgabeZeile} key=${a.id} aufgabe=${a} ...${optionen} />`)}
        </ul>
      ` : html`<div class="gruppe"><p class="leer-zeile">${leerText}</p></div>`}
    </section>
  `;
}
