// Papierkorb: Gelöschtes 30 Tage lang wiederherstellen oder endgültig entfernen.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { frage, melde } from '../bausteine/fenster.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import { TYP_EINZAHL } from '../typen.js';
import { tageSeit, vorTagen } from '../hilfen.js';

function restTage(datensatz) {
  return Math.max(0, store.PAPIERKORB_TAGE - tageSeit(datensatz.geloeschtAm));
}

export function Papierkorb() {
  useDaten();
  // Nur Einträge, die man selbst gelöscht hat (keine internen Hilfsdatensätze).
  const liste = store.papierkorb().filter((d) => TYP_EINZAHL[d.typ]);

  const endgueltig = async (d) => {
    const name = d.titel || d.name;
    const ja = await frage({
      titel: `„${name}“ endgültig löschen?`,
      text: 'Das lässt sich nicht rückgängig machen.',
      ja: 'Endgültig löschen',
      gefahr: true,
    });
    if (ja) store.entfernen(d.id);
  };

  const leeren = async () => {
    const ja = await frage({
      titel: 'Papierkorb leeren?',
      text: liste.length === 1 ? '1 Eintrag wird endgültig gelöscht.' : `${liste.length} Einträge werden endgültig gelöscht.`,
      ja: 'Papierkorb leeren',
      gefahr: true,
    });
    if (ja) {
      store.entfernen(liste.map((d) => d.id));
      melde('Papierkorb geleert');
    }
  };

  if (!liste.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="trash-2" groesse=${28} strich=${1.4} /></span>
          <h2>Der Papierkorb ist leer</h2>
          <p class="text-leise">Gelöschtes bleibt ${store.PAPIERKORB_TAGE} Tage hier liegen und lässt sich so lange wiederherstellen.</p>
        </section>
      </div>
    `;
  }

  return html`
    <div class="seite">
      <p class="text-leise">Gelöschtes wird nach ${store.PAPIERKORB_TAGE} Tagen automatisch endgültig entfernt.</p>
      <ul class="gruppe">
        ${liste.map((d) => {
          const name = d.titel || d.name;
          const rest = restTage(d);
          return html`
            <li class="zeile" key=${d.id}>
              <div class="zeile-haupt">
                <span class="zeile-text">
                  <strong>${name}</strong>
                  <span>${TYP_EINZAHL[d.typ]}, ${vorTagen(tageSeit(d.geloeschtAm))} gelöscht, noch ${rest === 1 ? '1 Tag' : `${rest} Tage`}</span>
                </span>
              </div>
              <span class="zeile-knoepfe">
                <button class="knopf-rund" type="button" aria-label=${`„${name}“ wiederherstellen`}
                  onClick=${() => { store.wiederherstellen(d.id); melde(`„${name}“ wiederhergestellt`); }}>
                  <${Icon} name="undo-2" groesse=${20} />
                </button>
                <button class="knopf-rund" type="button" aria-label=${`„${name}“ endgültig löschen`} onClick=${() => endgueltig(d)}>
                  <${Icon} name="trash-2" groesse=${20} />
                </button>
              </span>
            </li>
          `;
        })}
      </ul>
      <button class="knopf leise breit gefahr-text" type="button" onClick=${leeren}>Papierkorb leeren</button>
    </div>
  `;
}
