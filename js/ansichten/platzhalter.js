// Platzhalter für Bereiche, die mit späteren Etappen kommen.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';

function Platzhalter({ icon, titel, etappe, punkte }) {
  return html`
    <div class="seite">
      <section class="leer">
        <span class="leer-icon"><${Icon} name=${icon} groesse=${28} strich=${1.4} /></span>
        <h2>${titel}</h2>
        <p class="etikett">Kommt mit Etappe ${etappe}</p>
        <ul class="punkt-liste">
          ${punkte.map((p) => html`<li>${p}</li>`)}
        </ul>
      </section>
    </div>
  `;
}

export function Kalender() {
  return html`<${Platzhalter}
    icon="calendar-days"
    titel="Hier entsteht dein Kalender"
    etappe=${4}
    punkte=${[
      'Termine mit Kategorie-Farben',
      'Tag, 7 Tage, Monat und Agenda',
      'Tagesansicht mit Stundenraster und Jetzt-Linie',
      'Aufgaben per Drag & Drop einplanen',
    ]}
  />`;
}
