// Langfristige Ziele: Liste aller Ziele und je Ziel eine Seite mit Fortschritt
// und den verknüpften Listen, Aufgaben und Habits.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, frage, oeffneBlatt } from '../bausteine/fenster.js';
import { loescheZiel } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { AufgabeZeile } from '../bausteine/aufgabe-zeile.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as ziele from '../ziele.js';
import * as aufgaben from '../aufgaben.js';
import * as habits from '../habits.js';
import { tagLesbar } from '../hilfen.js';

function kategorieVon(ziel) {
  const k = ziel.kategorieId ? store.hole(ziel.kategorieId) : null;
  return k && !k.geloeschtAm ? k : null;
}

function Balken({ anteil }) {
  return html`<div class="ziel-balken" aria-hidden="true"><i style=${`width:${Math.round(anteil * 100)}%`}></i></div>`;
}

function standText(f) {
  if (!f.gesamt) return 'Noch keine Aufgaben verknüpft';
  return `${f.erledigt} von ${f.gesamt} ${f.gesamt === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt`;
}

// ---------- Alle Ziele ----------

function ZielKarte({ ziel }) {
  const f = ziele.fortschritt(ziel);
  const kategorie = kategorieVon(ziel);
  const frist = ziele.fristText(ziel);
  const anzahlHabits = ziele.habitsVon(ziel).length;
  return html`
    <li data-lang=${`ziel:${ziel.id}`}>
      <button class=${`ziel-karte ${ziel.erreichtAm ? 'erreicht' : ''}`} type="button" onClick=${() => geheZu(`ziel/${ziel.id}`)}>
        <span class="ziel-kopf">
          <strong>
            ${ziel.erreichtAm && html`<${Icon} name="circle-check" groesse=${18} />`}
            ${ziel.titel}
          </strong>
          <span class="ziel-prozent">${f.gesamt ? `${Math.round(f.anteil * 100)} %` : ''}</span>
        </span>
        <${Balken} anteil=${f.anteil} />
        <span class="ziel-meta">
          ${kategorie && html`<span><i class="farb-tupfer" style=${`background:${kategorie.farbe}`}></i>${kategorie.name}</span>`}
          <span>${standText(f)}</span>
          ${anzahlHabits > 0 && html`<span>${anzahlHabits} ${anzahlHabits === 1 ? 'Habit' : 'Habits'}</span>`}
          ${frist && html`<span class=${ziele.istUeberfaellig(ziel) ? 'warnung' : ''}>${frist}</span>`}
        </span>
      </button>
    </li>
  `;
}

export function Ziele() {
  useDaten();
  const [neu, setNeu] = useState(false);
  const liste = ziele.alle();
  const offene = liste.filter((z) => !z.erreichtAm);
  const erreichte = liste.filter((z) => z.erreichtAm);

  return html`
    <div class="seite">
      ${!liste.length && html`
        <section class="leer">
          <span class="leer-icon"><${Icon} name="target" groesse=${28} strich=${1.4} /></span>
          <h2>Noch kein Ziel</h2>
          <p class="text-leise">
            Ein Ziel bündelt, was dich langfristig dorthin bringt: Listen, einzelne Aufgaben und Habits.
            Der Fortschritt ergibt sich aus den erledigten Aufgaben.
          </p>
          <button class="knopf" type="button" onClick=${() => setNeu(true)}><${Icon} name="plus" /> Ziel anlegen</button>
        </section>
      `}

      ${offene.length > 0 && html`
        <ul class="ziel-liste">
          ${offene.map((z) => html`<${ZielKarte} key=${z.id} ziel=${z} />`)}
        </ul>
      `}

      ${erreichte.length > 0 && html`
        <section class="abschnitt">
          <div class="abschnitt-kopf"><h2>Erreicht</h2><span>${erreichte.length}</span></div>
          <ul class="ziel-liste">
            ${erreichte.map((z) => html`<${ZielKarte} key=${z.id} ziel=${z} />`)}
          </ul>
        </section>
      `}

      ${liste.length > 0 && html`
        <button class="knopf-plus" type="button" aria-label="Ziel anlegen" onClick=${() => setNeu(true)}>
          <${Icon} name="plus" groesse=${26} />
        </button>
      `}
      ${neu && html`<${ZielBlatt} onSchliessen=${() => setNeu(false)} />`}
    </div>
  `;
}

// ---------- Ziel anlegen und bearbeiten ----------

registriere('ziel', { bearbeiten: (z) => oeffneBlatt((zu) => html`<${ZielBlatt} ziel=${z} onSchliessen=${zu} />`) });

function ZielBlatt({ ziel = null, onSchliessen }) {
  const [titel, setTitel] = useState(ziel ? ziel.titel : '');
  const [kategorieId, setKategorieId] = useState(ziel ? ziel.kategorieId : null);
  const [zieldatum, setZieldatum] = useState(ziel ? ziel.zieldatum || '' : '');
  const [fehler, setFehler] = useState('');
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler('Gib dem Ziel einen Titel.');
      return;
    }
    const felder = { titel: sauber, kategorieId, zieldatum: zieldatum || null };
    if (ziel) {
      store.aendern(ziel.id, felder);
      onSchliessen();
    } else {
      const neu = ziele.neu(felder);
      onSchliessen();
      geheZu(`ziel/${neu.id}`);
    }
  };

  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${ziel ? 'Änderungen speichern' : 'Ziel anlegen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${ziel ? 'Ziel bearbeiten' : 'Neues Ziel'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input class="feld gross" type="text" maxlength="100" enterkeyhint="done" aria-label="Titel des Ziels"
            placeholder="zum Beispiel Hausarbeit abgeben" value=${titel} onInput=${(e) => { setTitel(e.target.value); setFehler(''); }} />
        </form>
        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
            <option value="">Keine Kategorie</option>
            ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
        </label>
        <label class="feld-gruppe">
          <span>Zieldatum (wenn du eines hast)</span>
          <input class="feld" type="date" value=${zieldatum} onInput=${(e) => setZieldatum(e.target.value)} />
        </label>
        ${zieldatum && html`<button class="knopf-text" type="button" onClick=${() => setZieldatum('')}>Ohne Zieldatum</button>`}
        ${!ziel && html`<p class="feld-hinweis">Listen, Aufgaben und Habits verknüpfst du im nächsten Schritt auf der Seite des Ziels.</p>`}
      </div>
    <//>
  `;
}

// ---------- Auswahl zum Verknüpfen ----------
//   eintraege – [{ id, name, text }]
//   gewaehlt  – Liste der verknüpften IDs
//   onFertig  – bekommt die neue Liste der IDs

function AuswahlBlatt({ titel, leerText, eintraege, gewaehlt, onFertig, onSchliessen }) {
  const [wahl, setWahl] = useState(gewaehlt.filter((id) => eintraege.some((e) => e.id === id)));
  const [suche, setSuche] = useState('');
  const woerter = suche.toLowerCase().split(/\s+/).filter(Boolean);
  const sichtbar = eintraege.filter((e) => woerter.every((w) => `${e.name} ${e.text || ''}`.toLowerCase().includes(w)));
  const schalte = (id) => setWahl(wahl.includes(id) ? wahl.filter((x) => x !== id) : [...wahl, id]);

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${() => { onFertig(wahl); onSchliessen(); }}>
      Übernehmen${wahl.length ? ` (${wahl.length})` : ''}
    </button>
  `;

  return html`
    <${Blatt} titel=${titel} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        ${eintraege.length > 7 && html`
          <input class="feld" type="search" autocomplete="off" aria-label="Liste durchsuchen" placeholder="Suchen" value=${suche}
            onInput=${(e) => setSuche(e.target.value)} />
        `}
        ${!eintraege.length && html`<p class="text-leise">${leerText}</p>`}
        ${eintraege.length > 0 && !sichtbar.length && html`<p class="text-leise">Nichts gefunden.</p>`}
        ${sichtbar.length > 0 && html`
          <ul class="gruppe auswahl">
            ${sichtbar.map((e) => html`
              <li key=${e.id}>
                <button type="button" class="auswahl-zeile" role="checkbox" aria-checked=${wahl.includes(e.id)} onClick=${() => schalte(e.id)}>
                  <span class="haken-kreis">${wahl.includes(e.id) && html`<${Icon} name="check" groesse=${15} strich=${2.6} />`}</span>
                  <span class="zeile-text">
                    <strong>${e.name}</strong>
                    ${e.text && html`<span>${e.text}</span>`}
                  </span>
                </button>
              </li>
            `)}
          </ul>
        `}
      </div>
    <//>
  `;
}

// ---------- Ein Ziel ----------

export function Ziel({ teil }) {
  useDaten();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [auswahl, setAuswahl] = useState(null); // null | 'projekte' | 'aufgaben' | 'habits'
  const ziel = teil ? store.hole(teil) : null;

  if (!ziel || ziel.geloeschtAm || ziel.typ !== 'ziel') {
    return html`
      <div class="seite">
        <section class="leer">
          <h2>Dieses Ziel gibt es nicht mehr</h2>
          <button class="knopf" type="button" onClick=${() => geheZu('ziele')}>Zu den Zielen</button>
        </section>
      </div>
    `;
  }

  const kategorie = kategorieVon(ziel);
  const f = ziele.fortschritt(ziel);
  const frist = ziele.fristText(ziel);
  const projekte = ziele.projekteVon(ziel);
  const einzelne = aufgaben.sortiere(ziele.einzelAufgaben(ziel).filter((a) => !a.erledigtAm));
  const einzelneFertig = ziele.einzelAufgaben(ziel).filter((a) => a.erledigtAm);
  const zielHabits = ziele.habitsVon(ziel);
  const angaben = [kategorie ? kategorie.name : null, frist || 'Ohne Zieldatum'].filter(Boolean);

  const loeschen = async () => {
    if (await loescheZiel(ziel)) geheZu('ziele');
  };

  // Was sich verknüpfen lässt
  const alleProjekte = store.liste('projekt')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((p) => {
      const liste = ziele.aufgabenImProjekt(p);
      return { id: p.id, name: p.name, text: liste.length ? `${liste.filter((a) => a.erledigtAm).length} von ${liste.length} erledigt` : 'Noch leer' };
    });
  const verknuepfteIds = new Set(ziel.aufgabenIds || []);
  const alleAufgaben = aufgaben.sortiere(aufgaben.alleAufgaben().filter((a) => !a.erledigtAm || verknuepfteIds.has(a.id)))
    .map((a) => {
      const liste = aufgaben.projektVon(a);
      return { id: a.id, name: a.titel, text: [a.erledigtAm ? 'Erledigt' : null, a.plandatum ? tagLesbar(a.plandatum) : 'Ohne Datum', liste ? liste.name : null].filter(Boolean).join(', ') };
    });
  const alleHabits = habits.alle().map((h) => ({ id: h.id, name: h.name, text: habits.frequenzText(h) }));

  return html`
    <div class="seite">
      <div class="leiste">
        <p class="text-leise">
          ${kategorie && html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${kategorie.farbe}`}></i>`}
          <span class=${ziele.istUeberfaellig(ziel) ? 'warnung' : ''}>${angaben.join(', ')}</span>
        </p>
        <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
      </div>

      <section class=${`karte ziel-stand ${ziel.erreichtAm ? 'erreicht' : ''}`}>
        <p class="ziel-gross">${f.gesamt ? `${Math.round(f.anteil * 100)} %` : '0 %'}</p>
        <${Balken} anteil=${f.anteil} />
        <p>${ziel.erreichtAm ? `Erreicht. ${standText(f)}.` : `${standText(f)}.`}</p>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf">
          <h2>Listen und Projekte</h2>
          <span class="kopf-rechts">
            ${projekte.length > 0 && html`<span>${projekte.length}</span>`}
            <button class="knopf-text" type="button" onClick=${() => setAuswahl('projekte')}>Wählen</button>
          </span>
        </div>
        ${projekte.length ? html`
          <ul class="gruppe">
            ${projekte.map((p) => {
              const liste = ziele.aufgabenImProjekt(p);
              const fertig = liste.filter((a) => a.erledigtAm).length;
              return html`
                <li class="zeile" key=${p.id}>
                  <button class="zeile-haupt" type="button" onClick=${() => geheZu(`liste/${p.id}`)}>
                    <span class="listen-icon"><${Icon} name=${p.icon || 'list-checks'} groesse=${20} /></span>
                    <span class="zeile-text">
                      <strong>${p.name}</strong>
                      <span>${liste.length ? `${fertig} von ${liste.length} erledigt` : 'Noch keine Aufgaben'}</span>
                    </span>
                    <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
                  </button>
                </li>
              `;
            })}
          </ul>
        ` : html`<div class="gruppe"><p class="leer-zeile">Alle Aufgaben einer verknüpften Liste zählen für den Fortschritt.</p></div>`}
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf">
          <h2>Einzelne Aufgaben</h2>
          <span class="kopf-rechts">
            ${einzelne.length + einzelneFertig.length > 0 && html`<span>${einzelneFertig.length}/${einzelne.length + einzelneFertig.length}</span>`}
            <button class="knopf-text" type="button" onClick=${() => setAuswahl('aufgaben')}>Wählen</button>
          </span>
        </div>
        ${einzelne.length + einzelneFertig.length > 0 && html`
          <ul class="gruppe">
            ${[...einzelne, ...einzelneFertig].map((a) => html`<${AufgabeZeile} key=${a.id} aufgabe=${a} zeigeDatum=${true} />`)}
          </ul>
        `}
        <button class="knopf leise breit" type="button"
          onClick=${() => oeffneAufgabe({
            vorgaben: { kategorieId: ziel.kategorieId },
            beiAngelegt: (neu) => store.aendern(ziel.id, { aufgabenIds: [...(store.hole(ziel.id).aufgabenIds || []), neu.id] }),
          })}>
          <${Icon} name="plus" groesse=${20} /> Neue Aufgabe für dieses Ziel
        </button>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf">
          <h2>Habits</h2>
          <span class="kopf-rechts">
            ${zielHabits.length > 0 && html`<span>${zielHabits.length}</span>`}
            <button class="knopf-text" type="button" onClick=${() => setAuswahl('habits')}>Wählen</button>
          </span>
        </div>
        ${zielHabits.length ? html`
          <ul class="gruppe">
            ${zielHabits.map((h) => {
              const q = habits.quote(h);
              const s = habits.streak(h);
              return html`
                <li class="zeile" key=${h.id}>
                  <button class="zeile-haupt" type="button" onClick=${() => geheZu(`habit/${h.id}`)}>
                    <span class="listen-icon"><${Icon} name=${h.icon || 'flame'} groesse=${20} /></span>
                    <span class="zeile-text">
                      <strong>${h.name}</strong>
                      <span>${q ? `Quote ${Math.round(q.anteil * 100)} % (${q.zeitraum})` : 'Quote noch offen'}, Streak ${s.text}</span>
                    </span>
                    <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
                  </button>
                </li>
              `;
            })}
          </ul>
        ` : html`<div class="gruppe"><p class="leer-zeile">Verknüpfte Habits zeigen hier ihre Erfüllungsquote. Sie zählen nicht in die Prozentzahl.</p></div>`}
      </section>

      <div class="knopf-stapel">
        ${ziel.erreichtAm ? html`
          <button class="knopf breit leise" type="button" onClick=${() => ziele.setzeErreicht(ziel, false)}>
            <${Icon} name="undo-2" groesse=${20} /> Wieder öffnen
          </button>
        ` : html`
          <button class="knopf breit" type="button" onClick=${() => { ziele.setzeErreicht(ziel, true); melde(`„${ziel.titel}“ erreicht`); }}>
            <${Icon} name="circle-check" groesse=${20} /> Als erreicht markieren
          </button>
        `}
        <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
          <${Icon} name="trash-2" groesse=${20} /> Ziel löschen
        </button>
      </div>

      ${bearbeiten && html`<${ZielBlatt} ziel=${ziel} onSchliessen=${() => setBearbeiten(false)} />`}
      ${auswahl === 'projekte' && html`
        <${AuswahlBlatt} titel="Listen und Projekte wählen" leerText="Es gibt noch keine Liste. Du legst sie unter Aufgaben, Listen an."
          eintraege=${alleProjekte} gewaehlt=${ziel.projektIds || []}
          onFertig=${(ids) => store.aendern(ziel.id, { projektIds: ids })} onSchliessen=${() => setAuswahl(null)} />
      `}
      ${auswahl === 'aufgaben' && html`
        <${AuswahlBlatt} titel="Aufgaben wählen" leerText="Es gibt noch keine offene Aufgabe."
          eintraege=${alleAufgaben} gewaehlt=${ziel.aufgabenIds || []}
          onFertig=${(ids) => store.aendern(ziel.id, { aufgabenIds: ids })} onSchliessen=${() => setAuswahl(null)} />
      `}
      ${auswahl === 'habits' && html`
        <${AuswahlBlatt} titel="Habits wählen" leerText="Es gibt noch kein Habit. Du legst es unter Übersicht, Habits an."
          eintraege=${alleHabits} gewaehlt=${ziel.habitIds || []}
          onFertig=${(ids) => store.aendern(ziel.id, { habitIds: ids })} onSchliessen=${() => setAuswahl(null)} />
      `}
    </div>
  `;
}
