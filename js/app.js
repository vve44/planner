// Einstieg der App: lädt die Daten, baut Kopfleiste, Inhalt und untere Leiste auf.

import { html, render, useState, useEffect, useRef } from '../bibliothek/preact-htm.js';
import * as store from './store.js';
import * as aufgaben from './aufgaben.js';
import { useDaten, useRoute, geheZu } from './haken.js';
import { datumLang } from './hilfen.js';
import { Icon } from './bausteine/icon.js';
import { Dienste, melde } from './bausteine/fenster.js';
import { BackupDialoge } from './bausteine/backup-dialoge.js';
import { AufgabenFenster } from './bausteine/aufgabe-blatt.js';
import { starteOfflineBetrieb, abonniereUpdate, updateBereit, uebernimmUpdate } from './aktualisierung.js';
import { Heute } from './ansichten/heute.js';
import { Kalender } from './ansichten/platzhalter.js';
import { Aufgaben, Liste, Merkliste } from './ansichten/aufgaben.js';
import { Uebersicht } from './ansichten/uebersicht.js';
import { Tagesroutinen } from './ansichten/tagesroutinen.js';
import { Routinen } from './ansichten/routinen.js';
import { Pools, Pool } from './ansichten/pools.js';
import { Kategorien } from './ansichten/kategorien.js';
import { Papierkorb } from './ansichten/papierkorb.js';
import { Einstellungen } from './ansichten/einstellungen.js';

// Alle Seiten der App.
//   tab      – welcher Punkt der unteren Leiste leuchtet
//   zurueck  – wohin der Zurück-Pfeil führt. 'herkunft' heißt: zu dem Hauptbereich,
//              von dem aus die Seite geöffnet wurde (manche Seiten sind von mehreren aus erreichbar).
const SEITEN = {
  heute: { titel: 'Heute', ansicht: Heute, tab: 'heute' },
  kalender: { titel: 'Kalender', ansicht: Kalender, tab: 'kalender' },
  aufgaben: { titel: 'Aufgaben', ansicht: Aufgaben, tab: 'aufgaben' },
  uebersicht: { titel: 'Übersicht', ansicht: Uebersicht, tab: 'uebersicht' },
  liste: { titel: 'Liste', ansicht: Liste, tab: 'aufgaben', zurueck: 'aufgaben' },
  merkliste: { titel: 'Merkliste', ansicht: Merkliste, tab: 'uebersicht', zurueck: 'herkunft' },
  tagesroutinen: { titel: 'Tagesroutinen', ansicht: Tagesroutinen, tab: 'uebersicht', zurueck: 'herkunft' },
  routinen: { titel: 'Routinen', ansicht: Routinen, tab: 'uebersicht', zurueck: 'uebersicht' },
  pools: { titel: 'Aufgabenpools', ansicht: Pools, tab: 'uebersicht', zurueck: 'herkunft' },
  pool: { titel: 'Pool', ansicht: Pool, tab: 'uebersicht', zurueck: 'pools' },
  kategorien: { titel: 'Kategorien', ansicht: Kategorien, tab: 'uebersicht', zurueck: 'uebersicht' },
  papierkorb: { titel: 'Papierkorb', ansicht: Papierkorb, tab: 'uebersicht', zurueck: 'uebersicht' },
  einstellungen: { titel: 'Einstellungen', ansicht: Einstellungen, tab: 'uebersicht', zurueck: 'uebersicht' },
};

const TABS = [
  { route: 'heute', name: 'Heute', icon: 'sun' },
  { route: 'kalender', name: 'Kalender', icon: 'calendar-days' },
  { route: 'aufgaben', name: 'Aufgaben', icon: 'list-checks' },
  { route: 'uebersicht', name: 'Übersicht', icon: 'layout-grid' },
];

// Der Hauptbereich, der zuletzt offen war.
let letzterHauptbereich = 'heute';

function App() {
  useDaten();
  const route = useRoute();
  const seite = SEITEN[route.name] || SEITEN.heute;
  const inhalt = useRef(null);
  const [, setUpdateZaehler] = useState(0);

  if (TABS.some((t) => t.route === route.name)) letzterHauptbereich = route.name;

  let tab = seite.tab;
  let zurueck = seite.zurueck;
  if (zurueck === 'herkunft') {
    zurueck = letzterHauptbereich === 'kalender' ? 'uebersicht' : letzterHauptbereich;
    tab = zurueck;
  } else if (route.name === 'pool') {
    // Ein einzelner Pool leuchtet unter dem Bereich, aus dem die Pool-Liste geöffnet wurde.
    tab = letzterHauptbereich === 'kalender' ? 'uebersicht' : letzterHauptbereich;
  }

  let titel = seite.titel;
  if (route.name === 'liste' || route.name === 'pool') {
    const eintrag = route.teil ? store.hole(route.teil) : null;
    if (eintrag && eintrag.name) titel = eintrag.name;
  }

  // Beim Seitenwechsel nach oben springen.
  useEffect(() => {
    if (inhalt.current) inhalt.current.scrollTop = 0;
  }, [route.name, route.teil]);

  useEffect(() => abonniereUpdate(() => setUpdateZaehler((n) => n + 1)), []);

  const Ansicht = seite.ansicht;

  return html`
    <header class="kopf">
      <div class="kopf-zeile">
        ${zurueck && html`
          <button class="kopf-zurueck" type="button" aria-label="Zurück" onClick=${() => geheZu(zurueck)}>
            <${Icon} name="chevron-left" groesse=${26} />
          </button>
        `}
        <div class="kopf-text">
          <h1>${titel}</h1>
          ${route.name === 'heute' && html`<p>${datumLang()}</p>`}
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
      <${Ansicht} teil=${route.teil} />
    </main>

    <nav class="leiste-unten" aria-label="Bereiche">
      ${TABS.map((t) => html`
        <button type="button" class=${`tab ${tab === t.route ? 'aktiv' : ''}`}
          aria-current=${tab === t.route ? 'page' : null} onClick=${() => geheZu(t.route)}>
          <${Icon} name=${t.icon} groesse=${23} />
          <span>${t.name}</span>
        </button>
      `)}
    </nav>

    <${AufgabenFenster} />
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

  aufgaben.sicherstelleMerkliste();

  wurzel.innerHTML = '';
  render(html`<${App} />`, wurzel);

  // Den Browser bitten, die Daten dauerhaft aufzubewahren.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  starteOfflineBetrieb();

  // Wechselt der Tag, während die App offen ist, die Ansichten neu zeichnen.
  let tag = new Date().toDateString();
  const pruefeTag = () => {
    const jetzt = new Date().toDateString();
    if (jetzt !== tag) {
      tag = jetzt;
      store.zeichneNeu();
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefeTag(); });
  setInterval(pruefeTag, 60000);
}

starte();
