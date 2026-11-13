// Icon-Auswahl: zeigt zuerst wenige Icons und auf Wunsch alle.
// Bewusst ohne eigenen Scrollbereich, damit das Fenster als Ganzes ruhig scrollt.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { AUSWAHL_ICONS } from '../typen.js';

const ANZAHL_KURZ = 12;

export function IconWahl({ wert, onWahl, ohneErlaubt = false }) {
  const [alle, setAlle] = useState(false);

  // Kurze Liste: die ersten Icons, das gewählte ist immer dabei.
  let sichtbar = AUSWAHL_ICONS;
  if (!alle) {
    sichtbar = AUSWAHL_ICONS.slice(0, ANZAHL_KURZ);
    if (wert && !sichtbar.includes(wert) && AUSWAHL_ICONS.includes(wert)) {
      sichtbar = [wert, ...sichtbar.slice(0, ANZAHL_KURZ - 1)];
    }
  }

  return html`
    <div class="icon-wahl">
      ${sichtbar.map((name) => html`
        <button type="button" key=${name} class=${`icon-punkt ${wert === name ? 'aktiv' : ''}`}
          aria-label=${name} aria-pressed=${wert === name}
          onClick=${() => onWahl(ohneErlaubt && wert === name ? null : name)}>
          <${Icon} name=${name} groesse=${22} />
        </button>
      `)}
    </div>
    <button class="knopf-text" type="button" onClick=${() => setAlle(!alle)}>
      <${Icon} name=${alle ? 'chevron-up' : 'chevron-down'} groesse=${18} />
      ${alle ? 'Weniger Icons zeigen' : 'Alle Icons zeigen'}
    </button>
  `;
}
