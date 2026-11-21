// Suche über Aufgaben, Termine, Notizen, Habits und Ziele.
// Von gesperrten Notizen wird nur der Titel durchsucht und gezeigt.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { TerminBlatt } from '../bausteine/termin-blatt.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as termine from '../termine.js';
import * as notizen from '../notizen.js';
import * as habits from '../habits.js';
import * as ziele from '../ziele.js';
import { tagLesbar } from '../hilfen.js';

// Der zuletzt gesuchte Text bleibt stehen, wenn man aus einem Treffer zurückkommt.
let letzteSuche = '';

function enthaelt(texte, woerter) {
  const alles = texte.filter(Boolean).join('\n').toLowerCase();
  return woerter.every((w) => alles.includes(w));
}

function suche(text) {
  const woerter = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!woerter.length) return null;

  const gefundeneAufgaben = aufgaben.alleAufgaben()
    .filter((a) => enthaelt([a.titel, a.notiz, ...(a.unteraufgaben || []).map((p) => p.text), ...(a.checkliste || []).map((p) => p.text)], woerter))
    .sort((a, b) => Number(Boolean(a.erledigtAm)) - Number(Boolean(b.erledigtAm)) || (a.geaendertAm < b.geaendertAm ? 1 : -1));

  const gefundeneTermine = termine.alle()
    .filter((t) => enthaelt([t.titel], woerter))
    .sort((a, b) => (a.datum < b.datum ? 1 : -1));

  const gefundeneNotizen = notizen.alle()
    .filter((n) => enthaelt(notizen.istGesperrt(n) ? [n.titel] : [n.titel, notizen.textVon(n), n.einheit], woerter))
    .sort((a, b) => (a.geaendertAm < b.geaendertAm ? 1 : -1));

  const gefundeneHabits = habits.alle().filter((h) => enthaelt([h.name, h.menge ? h.menge.einheit : ''], woerter));

  const gefundeneZiele = ziele.alle().filter((z) => enthaelt([z.titel], woerter));

  return { aufgaben: gefundeneAufgaben, termine: gefundeneTermine, notizen: gefundeneNotizen, habits: gefundeneHabits, ziele: gefundeneZiele };
}

function Treffer({ icon, titel, text, blass = false, lang = null, onClick }) {
  return html`
    <li class="zeile" data-lang=${lang}>
      <button class=${`zeile-haupt ${blass ? 'blass' : ''}`} type="button" onClick=${onClick}>
        <span class="listen-icon"><${Icon} name=${icon} groesse=${20} /></span>
        <span class="zeile-text">
          <strong>${titel}</strong>
          ${text && html`<span class="einzeilig">${text}</span>`}
        </span>
        <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
      </button>
    </li>
  `;
}

export function Suche() {
  useDaten();
  const [text, setText] = useState(letzteSuche);
  const [termin, setTermin] = useState(null);
  const feld = useRef(null);

  useEffect(() => {
    if (!letzteSuche && feld.current) feld.current.focus();
  }, []);

  const aendere = (wert) => {
    letzteSuche = wert;
    setText(wert);
  };

  const ergebnis = text.trim().length >= 2 ? suche(text) : null;
  const anzahl = ergebnis ? ergebnis.aufgaben.length + ergebnis.termine.length + ergebnis.notizen.length + ergebnis.habits.length + ergebnis.ziele.length : 0;

  const aufgabeText = (a) => {
    const teile = [];
    if (a.erledigtAm) teile.push('Erledigt');
    if (a.plandatum) teile.push(tagLesbar(a.plandatum));
    const liste = aufgaben.projektVon(a);
    if (liste) teile.push(liste.name);
    return teile.join(', ');
  };

  const terminText = (t) => {
    const teile = [tagLesbar(t.datum)];
    if (!t.ganztaegig && t.von) teile.push(`${t.von} Uhr`);
    const wiederholung = termine.wiederholungText(t.wiederholung);
    if (wiederholung) teile.push(wiederholung);
    return teile.join(', ');
  };

  const notizText = (n) => {
    if (notizen.istGesperrt(n)) return 'Gesperrt';
    if (n.art === 'tracker') return 'Messwert-Tracker';
    return notizen.auszug(n);
  };

  const gruppen = ergebnis ? [
    { name: 'Aufgaben', liste: ergebnis.aufgaben.map((a) => html`
      <${Treffer} key=${a.id} lang=${`aufgabe:${a.id}`} icon=${a.erledigtAm ? 'circle-check' : 'circle'} titel=${a.titel} text=${aufgabeText(a)} blass=${Boolean(a.erledigtAm)}
        onClick=${() => oeffneAufgabe({ id: a.id })} />`) },
    { name: 'Termine', liste: ergebnis.termine.map((t) => html`
      <${Treffer} key=${t.id} lang=${`termin:${t.id}:${t.datum}`} icon="calendar" titel=${t.titel} text=${terminText(t)} onClick=${() => setTermin({ id: t.id, start: t.datum })} />`) },
    { name: 'Notizen', liste: ergebnis.notizen.map((n) => html`
      <${Treffer} key=${n.id} lang=${`notiz:${n.id}`} icon=${notizen.istGesperrt(n) ? 'lock' : n.art === 'tracker' ? 'chart-line' : 'file-text'} titel=${n.titel} text=${notizText(n)}
        onClick=${() => geheZu(`notiz/${n.id}`)} />`) },
    { name: 'Habits', liste: ergebnis.habits.map((h) => html`
      <${Treffer} key=${h.id} lang=${`habit:${h.id}`} icon=${h.icon || 'flame'} titel=${h.name} text=${habits.frequenzText(h)} onClick=${() => geheZu(`habit/${h.id}`)} />`) },
    { name: 'Ziele', liste: ergebnis.ziele.map((z) => {
      const f = ziele.fortschritt(z);
      const text = [z.erreichtAm ? 'Erreicht' : null, f.gesamt ? `${f.erledigt} von ${f.gesamt} Aufgaben erledigt` : null, ziele.fristText(z) || null].filter(Boolean).join(', ');
      return html`<${Treffer} key=${z.id} lang=${`ziel:${z.id}`} icon="target" titel=${z.titel} text=${text} blass=${Boolean(z.erreichtAm)} onClick=${() => geheZu(`ziel/${z.id}`)} />`;
    }) },
  ].filter((g) => g.liste.length) : [];

  return html`
    <div class="seite">
      <form class="such-feld" role="search" onSubmit=${(e) => { e.preventDefault(); if (feld.current) feld.current.blur(); }}>
        <${Icon} name="search" groesse=${20} />
        <input ref=${feld} class="feld" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off"
          aria-label="Suchbegriff" placeholder="Aufgaben, Termine, Notizen, Habits, Ziele" value=${text}
          onInput=${(e) => aendere(e.target.value)} />
        ${text && html`
          <button class="knopf-rund" type="button" aria-label="Suchbegriff löschen" onClick=${() => { aendere(''); if (feld.current) feld.current.focus(); }}>
            <${Icon} name="x" groesse=${18} />
          </button>
        `}
      </form>

      ${!ergebnis && html`
        <p class="text-leise such-hinweis">
          Gib mindestens zwei Zeichen ein. Durchsucht werden Titel und Inhalte. Von gesperrten Notizen nur der Titel.
        </p>
      `}
      ${ergebnis && !anzahl && html`<p class="text-leise such-hinweis" role="status">Nichts gefunden für „${text.trim()}“.</p>`}
      ${ergebnis && anzahl > 0 && html`<p class="text-leise such-hinweis" role="status">${anzahl} Treffer</p>`}

      ${gruppen.map((g) => html`
        <section class="abschnitt" key=${g.name}>
          <div class="abschnitt-kopf"><h2>${g.name}</h2><span>${g.liste.length}</span></div>
          <ul class="gruppe">${g.liste}</ul>
        </section>
      `)}

      ${termin && html`<${TerminBlatt} key=${termin.id} offen=${termin} onSchliessen=${() => setTermin(null)} />`}
    </div>
  `;
}
