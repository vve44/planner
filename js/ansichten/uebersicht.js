// Übersicht: Kacheln zu allen Bereichen der App.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';

const KACHELN = [
  { icon: 'tags', name: 'Kategorien', route: 'kategorien' },
  { icon: 'bookmark', name: 'Merkliste', etappe: 2 },
  { icon: 'flame', name: 'Habits', etappe: 5 },
  { icon: 'notebook-pen', name: 'Notizen', etappe: 6 },
  { icon: 'target', name: 'Ziele', etappe: 7 },
  { icon: 'droplet', name: 'Zyklus', etappe: 7 },
  { icon: 'sprout', name: 'Garten', etappe: 9 },
  { icon: 'search', name: 'Suche', etappe: 6 },
  { icon: 'trash-2', name: 'Papierkorb', etappe: 2 },
  { icon: 'settings', name: 'Einstellungen', route: 'einstellungen' },
];

export function Uebersicht() {
  useDaten();
  const anzahlKategorien = store.liste('kategorie').length;

  return html`
    <div class="seite">
      <div class="kachel-raster">
        ${KACHELN.map((k) => {
          if (k.route) {
            return html`
              <button class="kachel" type="button" onClick=${() => geheZu(k.route)}>
                <span class="kachel-icon"><${Icon} name=${k.icon} groesse=${24} /></span>
                <strong>${k.name}</strong>
                ${k.route === 'kategorien' && html`
                  <span class="kachel-zusatz">${anzahlKategorien === 1 ? '1 Kategorie' : `${anzahlKategorien} Kategorien`}</span>
                `}
              </button>
            `;
          }
          return html`
            <div class="kachel spaeter" aria-disabled="true">
              <span class="kachel-icon"><${Icon} name=${k.icon} groesse=${24} /></span>
              <strong>${k.name}</strong>
              <span class="kachel-zusatz">Etappe ${k.etappe}</span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
