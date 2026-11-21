// Das Board (Kanban) eines Projekts: Spalten nebeneinander, Karten zum Verschieben.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, waehle } from '../bausteine/fenster.js';
import { loescheAufgabe } from '../bausteine/loeschen.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { richteKartenZiehenEin } from '../bausteine/kanban-ziehen.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as kanban from '../kanban.js';
import { tagLesbar } from '../hilfen.js';

const ERLEDIGT_ZEIGEN = 20; // so viele erledigte Karten zeigt die Erledigt-Spalte zunächst

function Karte({ aufgabe, projekt, spalte }) {
  const erledigt = Boolean(aufgabe.erledigtAm);
  const unter = aufgaben.fortschritt(aufgabe);
  const ueberfaellig = aufgaben.istUeberfaellig(aufgabe);

  // Menü der Karte: in eine andere Spalte verschieben, bearbeiten oder löschen.
  // (Langes Drücken zieht im Board die Karte, deshalb stehen diese Wege hier.)
  const menue = async () => {
    const andere = kanban.spalten(projekt).filter((s) => s.id !== spalte.id);
    const wahl = await waehle({
      titel: aufgabe.titel,
      optionen: [
        ...andere.map((s) => ({ wert: `spalte:${s.id}`, name: `Nach „${s.name}“ verschieben` })),
        { wert: 'bearbeiten', name: 'Bearbeiten' },
        { wert: 'loeschen', name: 'Löschen', art: 'gefahr' },
      ],
    });
    if (!wahl) return;
    if (wahl === 'bearbeiten') oeffneAufgabe({ id: aufgabe.id });
    else if (wahl === 'loeschen') await loescheAufgabe(aufgabe);
    else kanban.verschiebe(aufgabe.id, store.hole(projekt.id), wahl.slice(7));
  };

  return html`
    <li class=${`k-karte ${erledigt ? 'erledigt' : ''}`} data-karte=${aufgabe.id} data-titel=${aufgabe.titel}>
      <button class="haken klein" type="button" aria-pressed=${erledigt}
        aria-label=${erledigt ? `${aufgabe.titel} wieder öffnen` : `${aufgabe.titel} abhaken`}
        onClick=${() => aufgaben.schalteErledigt(aufgabe.id)}>
        <span class="haken-kreis">${erledigt && html`<${Icon} name="check" groesse=${13} strich=${2.6} />`}</span>
      </button>
      <button class="k-text" type="button" aria-label=${`${aufgabe.titel} öffnen`} onClick=${() => oeffneAufgabe({ id: aufgabe.id })}>
        <strong>${aufgabe.titel}</strong>
        ${(aufgabe.plandatum || unter.gesamt > 0 || aufgabe.prioritaet > 1) && html`
          <span class="k-meta">
            ${aufgabe.prioritaet > 1 && html`<span class=${aufgabe.prioritaet === 3 ? 'warnung' : 'gold'}><${Icon} name="flag" groesse=${13} /></span>`}
            ${aufgabe.plandatum && html`<span class=${ueberfaellig ? 'warnung' : ''}><${Icon} name="calendar" groesse=${13} /> ${tagLesbar(aufgabe.plandatum)}</span>`}
            ${unter.gesamt > 0 && html`<span><${Icon} name="list-checks" groesse=${13} /> ${unter.erledigt}/${unter.gesamt}</span>`}
          </span>
        `}
      </button>
      <button class="k-mehr" type="button" aria-label=${`Menü zu ${aufgabe.titel}: verschieben, bearbeiten, löschen`} onClick=${menue}>
        <${Icon} name="ellipsis" groesse=${18} />
      </button>
    </li>
  `;
}

export function Board({ projekt }) {
  const wurzel = useRef(null);
  const ablegen = useRef(null);
  const [spalteOffen, setSpalteOffen] = useState(null); // null | { neu: true } | { id }
  const [alleErledigten, setAlleErledigten] = useState(false);
  const spalten = kanban.spalten(projekt);
  const karten = kanban.karten(projekt);

  ablegen.current = (aufgabeId, spalteId, index) => {
    const frisch = store.hole(projekt.id);
    const aufgabe = store.hole(aufgabeId);
    if (!frisch || !aufgabe) return;
    const ziel = kanban.spalten(frisch).find((s) => s.id === spalteId);
    if (!ziel) return;
    const vorher = { spalteId: kanban.spalteVon(aufgabe, frisch), index: karten.get(kanban.spalteVon(aufgabe, frisch)).findIndex((a) => a.id === aufgabeId) };
    if (vorher.spalteId === spalteId && (ziel.erledigt || vorher.index === index)) return;
    kanban.verschiebe(aufgabeId, frisch, spalteId, index);
    if (vorher.spalteId !== spalteId) {
      melde(`„${aufgabe.titel}“ steht jetzt in „${ziel.name}“`, {
        aktion: 'Rückgängig',
        beiAktion: () => kanban.verschiebe(aufgabeId, store.hole(projekt.id), vorher.spalteId, vorher.index),
      });
    }
  };

  useEffect(() => richteKartenZiehenEin(wurzel.current, (id, spalteId, index) => ablegen.current(id, spalteId, index)), []);

  const neueAufgabe = (spalte) => {
    oeffneAufgabe({
      vorgaben: { projektId: projekt.id, kategorieId: projekt.kategorieId },
      // Die neue Karte landet am Ende der Spalte, in der sie angelegt wurde.
      beiAngelegt: (neu) => {
        if (neu.projektId === projekt.id) kanban.verschiebe(neu.id, store.hole(projekt.id), spalte.id);
      },
    });
  };

  return html`
    <div class="board" ref=${wurzel}>
      <div class="board-spalten">
        ${spalten.map((s) => {
          const liste = karten.get(s.id);
          const sichtbar = s.erledigt && !alleErledigten ? liste.slice(0, ERLEDIGT_ZEIGEN) : liste;
          return html`
            <section class=${`board-spalte ${s.erledigt ? 'erledigt' : ''}`} data-spalte=${s.id} key=${s.id} aria-label=${`Spalte ${s.name}`}>
              <header class="board-spalte-kopf">
                <h2>${s.erledigt && html`<${Icon} name="circle-check" groesse=${16} />`}${s.name}</h2>
                <span>${liste.length}</span>
                <button class="knopf-rund" type="button" aria-label=${`Spalte ${s.name} bearbeiten`} onClick=${() => setSpalteOffen({ id: s.id })}>
                  <${Icon} name="ellipsis" groesse=${20} />
                </button>
              </header>
              <ul class="board-karten">
                ${sichtbar.map((a) => html`<${Karte} key=${a.id} aufgabe=${a} projekt=${projekt} spalte=${s} />`)}
                ${!liste.length && html`<li class="board-leer">${s.erledigt ? 'Abgehakte Aufgaben landen hier.' : 'Keine Karten'}</li>`}
                ${sichtbar.length < liste.length && html`
                  <li class="board-leer">
                    <button class="knopf-text" type="button" onClick=${() => setAlleErledigten(true)}>Alle ${liste.length} zeigen</button>
                  </li>
                `}
              </ul>
              ${!s.erledigt && html`
                <button class="board-neu" type="button" onClick=${() => neueAufgabe(s)}>
                  <${Icon} name="plus" groesse=${18} /> Aufgabe
                </button>
              `}
            </section>
          `;
        })}
        <button class="board-spalte-neu" type="button" onClick=${() => setSpalteOffen({ neu: true })}>
          <${Icon} name="plus" groesse=${20} /> Spalte
        </button>
      </div>
      ${spalteOffen && html`<${SpalteBlatt} projekt=${projekt} offen=${spalteOffen} onSchliessen=${() => setSpalteOffen(null)} />`}
    </div>
  `;
}

// ---------- Spalte anlegen und bearbeiten ----------

function SpalteBlatt({ projekt, offen, onSchliessen }) {
  const spalten = kanban.spalten(projekt);
  const spalte = offen.id ? spalten.find((s) => s.id === offen.id) : null;
  const [name, setName] = useState(spalte ? spalte.name : '');
  const [fehler, setFehler] = useState('');
  const feld = useRef(null);
  const index = spalte ? spalten.indexOf(spalte) : -1;

  useEffect(() => {
    if (!spalte && feld.current) feld.current.focus();
  }, []);

  // Die Spalte wurde inzwischen gelöscht.
  if (offen.id && !spalte) {
    onSchliessen();
    return null;
  }

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler('Gib der Spalte einen Namen.');
      return;
    }
    if (spalte) kanban.benenneUm(projekt, spalte.id, sauber);
    else kanban.neueSpalte(projekt, sauber);
    onSchliessen();
  };

  const loeschen = () => {
    const ziel = kanban.offeneSpalten(projekt).find((s) => s.id !== spalte.id);
    const zurueck = kanban.loescheSpalte(projekt, spalte.id);
    onSchliessen();
    if (zurueck) melde(`Spalte „${spalte.name}“ gelöscht. Ihre Karten stehen jetzt in „${ziel.name}“.`, { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${spalte ? 'Namen speichern' : 'Spalte anlegen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${spalte ? 'Spalte bearbeiten' : 'Neue Spalte'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input ref=${feld} class="feld gross" type="text" maxlength="40" enterkeyhint="done" aria-label="Name der Spalte"
            placeholder="zum Beispiel Warten auf Antwort" value=${name} onInput=${(e) => { setName(e.target.value); setFehler(''); }} />
        </form>

        ${spalte && html`
          <div class="feld-gruppe">
            <span>Platz im Board</span>
            <div class="chips">
              <button class="chip" type="button" disabled=${index === 0} onClick=${() => kanban.verschiebeSpalte(projekt, spalte.id, -1)}>
                <${Icon} name="arrow-left" groesse=${16} /> Nach links
              </button>
              <button class="chip" type="button" disabled=${index === spalten.length - 1} onClick=${() => kanban.verschiebeSpalte(projekt, spalte.id, 1)}>
                Nach rechts <${Icon} name="arrow-right" groesse=${16} />
              </button>
            </div>
            <p class="feld-hinweis">Steht an Stelle ${index + 1} von ${spalten.length}.</p>
          </div>

          <div class="feld-gruppe">
            <div class="schalter-zeile">
              <span id="erledigt-spalte">Erledigt-Spalte</span>
              <button type="button" class="schalter" role="switch" aria-checked=${spalte.erledigt} aria-labelledby="erledigt-spalte"
                disabled=${spalte.erledigt || kanban.offeneSpalten(projekt).length < 2}
                onClick=${() => kanban.setzeErledigtSpalte(projekt, spalte.id)}></button>
            </div>
            <p class="feld-hinweis">
              ${spalte.erledigt
                ? 'Abgehakte Aufgaben stehen in dieser Spalte. Um das zu ändern, mach eine andere Spalte zur Erledigt-Spalte.'
                : 'Jedes Board hat genau eine Erledigt-Spalte. Schaltest du sie hier ein, wandern die abgehakten Aufgaben in diese Spalte. Offene Karten, die hier stehen, rücken in die erste offene Spalte.'}
            </p>
          </div>

          ${kanban.loeschbar(projekt, spalte.id) ? html`
            <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
              <${Icon} name="trash-2" groesse=${20} /> Spalte löschen
            </button>
          ` : html`
            <p class="feld-hinweis">
              ${spalte.erledigt ? 'Die Erledigt-Spalte lässt sich nicht löschen.' : 'Die letzte offene Spalte lässt sich nicht löschen.'}
            </p>
          `}
        `}
      </div>
    <//>
  `;
}
