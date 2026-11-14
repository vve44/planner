// Übersicht: Kacheln zu allen Bereichen der App.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import { TYP_EINZAHL } from '../typen.js';

const KACHELN = [
  { icon: 'bookmark', name: 'Merkliste', route: 'merkliste' },
  { icon: 'sun', name: 'Tagesroutinen', route: 'tagesroutinen' },
  { icon: 'clipboard-list', name: 'Routinen', route: 'routinen' },
  { icon: 'repeat', name: 'Aufgabenpools', route: 'pools' },
  { icon: 'tags', name: 'Kategorien', route: 'kategorien' },
  { icon: 'flame', name: 'Habits', etappe: 5 },
  { icon: 'notebook-pen', name: 'Notizen', etappe: 6 },
  { icon: 'target', name: 'Ziele', etappe: 7 },
  { icon: 'droplet', name: 'Zyklus', etappe: 7 },
  { icon: 'sprout', name: 'Garten', etappe: 9 },
  { icon: 'search', name: 'Suche', etappe: 6 },
  { icon: 'trash-2', name: 'Papierkorb', route: 'papierkorb' },
  { icon: 'settings', name: 'Einstellungen', route: 'einstellungen' },
];

function mehrzahl(anzahl, eins, viele) {
  return anzahl === 1 ? `1 ${eins}` : `${anzahl} ${viele}`;
}

export function Uebersicht() {
  useDaten();
  const merk = aufgaben.merkliste();
  const zusatz = {
    merkliste: mehrzahl(merk ? aufgaben.alleAufgaben().filter((a) => a.projektId === merk.id && !a.erledigtAm).length : 0, 'Eintrag', 'Einträge'),
    tagesroutinen: mehrzahl(store.liste('tagesroutine').length, 'Routine', 'Routinen'),
    routinen: mehrzahl(store.liste('routine').length, 'Vorlage', 'Vorlagen'),
    pools: mehrzahl(store.liste('pool').length, 'Pool', 'Pools'),
    kategorien: mehrzahl(store.liste('kategorie').length, 'Kategorie', 'Kategorien'),
    papierkorb: mehrzahl(store.papierkorb().filter((d) => TYP_EINZAHL[d.typ]).length, 'Eintrag', 'Einträge'),
  };

  return html`
    <div class="seite">
      <div class="kachel-raster">
        ${KACHELN.map((k) => {
          if (k.route) {
            return html`
              <button class="kachel" type="button" onClick=${() => geheZu(k.route)}>
                <span class="kachel-icon"><${Icon} name=${k.icon} groesse=${22} /></span>
                <strong>${k.name}</strong>
                ${zusatz[k.route] && html`<span class="kachel-zusatz">${zusatz[k.route]}</span>`}
              </button>
            `;
          }
          return html`
            <div class="kachel spaeter" aria-disabled="true">
              <span class="kachel-icon"><${Icon} name=${k.icon} groesse=${22} /></span>
              <strong>${k.name}</strong>
              <span class="kachel-zusatz">Etappe ${k.etappe}</span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
