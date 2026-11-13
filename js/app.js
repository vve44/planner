// Einstieg der App: lädt die Daten, baut Kopfleiste, Inhalt und untere Leiste auf.

import { html, render, useState, useEffect, useRef } from '../bibliothek/preact-htm.js';
import * as store from './store.js';
import { useDaten, useRoute, geheZu } from './haken.js';
import { datumLang } from './hilfen.js';
import { Icon } from './bausteine/icon.js';
import { Dienste, melde } from './bausteine/fenster.js';
import { BackupDialoge } from './bausteine/backup-dialoge.js';
import { starteOfflineBetrieb, abonniereUpdate, updateBereit, uebernimmUpdate } from './aktualisierung.js';
import { Heute } from './ansichten/heute.js';
import { Kalender, Aufgaben } from './ansichten/platzhalter.js';
import { Uebersicht } from './ansichten/uebersicht.js';
import { Kategorien } from './ansichten/kategorien.js';
import { Einstellungen } from './ansichten/einstellungen.js';

// Alle Seiten der App. "tab" sagt, welcher Punkt der unteren Leiste leuchtet,
// "zurueck" gibt Unterseiten einen Zurück-Pfeil.
const SEITEN = {
  heute: { titel: 'Heute', ansicht: Heute, tab: 'heute' },
  kalender: { titel: 'Kalender', ansicht: Kalender, tab: 'kalender' },
  aufgaben: { titel: 'Aufgaben', ansicht: Aufgaben, tab: 'aufgaben' },
  uebersicht: { titel: 'Übersicht', ansicht: Uebersicht, tab: 'uebersicht' },
  kategorien: { titel: 'Kategorien', ansicht: Kategorien, tab: 'uebersicht', zurueck: 'uebersicht' },
  einstellungen: { titel: 'Einstellungen', ansicht: Einstellungen, tab: 'uebersicht', zurueck: 'uebersicht' },
};

const TABS = [
  { route: 'heute', name: 'Heute', icon: 'sun' },
  { route: 'kalender', name: 'Kalender', icon: 'calendar-days' },
  { route: 'aufgaben', name: 'Aufgaben', icon: 'list-checks' },
  { route: 'uebersicht', name: 'Übersicht', icon: 'layout-grid' },
];

function App() {
  useDaten();
  const route = useRoute();
  const seite = SEITEN[route] || SEITEN.heute;
  const inhalt = useRef(null);
  const [, setUpdateZaehler] = useState(0);

  // Gewählte Schrift auf die ganze App anwenden.
  const schrift = store.einstellung('schrift', 'jost');
  useEffect(() => {
    document.documentElement.dataset.schrift = schrift;
  }, [schrift]);

  // Beim Seitenwechsel nach oben springen.
  useEffect(() => {
    if (inhalt.current) inhalt.current.scrollTop = 0;
  }, [route]);

  useEffect(() => abonniereUpdate(() => setUpdateZaehler((n) => n + 1)), []);

  const Ansicht = seite.ansicht;

  return html`
    <header class="kopf">
      <div class="kopf-zeile">
        ${seite.zurueck && html`
          <button class="kopf-zurueck" type="button" aria-label="Zurück" onClick=${() => geheZu(seite.zurueck)}>
            <${Icon} name="chevron-left" groesse=${26} />
          </button>
        `}
        <div class="kopf-text">
          <h1>${seite.titel}</h1>
          ${route === 'heute' && html`<p>${datumLang()}</p>`}
        </div>
      </div>
    </header>

    <main class="inhalt" ref=${inhalt}>
      ${updateBereit() && html`
        <div class="update-band">
          <span>Eine neue Version liegt bereit.</span>
          <button type="button" onClick=${uebernimmUpdate}>Jetzt aktualisieren</button>
        </div>
      `}
      <${Ansicht} />
    </main>

    <nav class="leiste-unten" aria-label="Bereiche">
      ${TABS.map((t) => html`
        <button type="button" class=${`tab ${seite.tab === t.route ? 'aktiv' : ''}`}
          aria-current=${seite.tab === t.route ? 'page' : null} onClick=${() => geheZu(t.route)}>
          <${Icon} name=${t.icon} groesse=${24} />
          <span>${t.name}</span>
        </button>
      `)}
    </nav>

    <${BackupDialoge} />
    <${Dienste} />
  `;
}

async function starte() {
  const wurzel = document.getElementById('app');
  try {
    await store.initialisiere();
  } catch (fehler) {
    console.error(fehler);
    wurzel.innerHTML = `
      <div class="start-hinweis">
        <strong>Der Planner konnte seine Daten nicht öffnen.</strong><br>
        Schließe die App und öffne sie erneut. Im privaten Modus des Browsers kann der Planner keine Daten speichern.
      </div>`;
    return;
  }

  store.beiSpeicherfehler((fehler) => {
    console.error(fehler);
    melde('Die letzte Änderung konnte nicht gespeichert werden.', { dauer: 8000 });
  });

  document.documentElement.dataset.schrift = store.einstellung('schrift', 'jost');
  wurzel.innerHTML = '';
  render(html`<${App} />`, wurzel);

  // Den Browser bitten, die Daten dauerhaft aufzubewahren.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  starteOfflineBetrieb();
}

starte();
