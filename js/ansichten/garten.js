// Garten: Level, Erfahrungspunkte (EP) und das Bild des Gartens.
// Dazu die kleine Level-Zeile für den Tagesbereich.

import { html, useMemo } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { useDaten, geheZu } from '../haken.js';
import * as punkte from '../punkte.js';
import { gartenSvg, VOLL_AB_LEVEL } from '../garten-bild.js';

const zahl = (n) => n.toLocaleString('de-DE');
const mehrzahl = (anzahl, eins, viele) => `${anzahl} ${anzahl === 1 ? eins : viele}`;

// Schmale Zeile ganz oben im Tab „Heute“. Antippen öffnet den Garten.
export function LevelZeile({ lang = null }) {
  const s = punkte.stand();
  return html`
    <button class="level-zeile" type="button" data-lang=${lang} onClick=${() => geheZu('garten')}
      aria-label=${`Level ${s.level}, ${s.imLevel} von ${s.noetig} EP bis Level ${s.level + 1}. Garten öffnen`}>
      <span class="level-icon"><${Icon} name="sprout" groesse=${19} /></span>
      <span class="level-mitte">
        <span class="level-kopf">
          <strong>Level ${s.level}</strong>
          <span>${zahl(s.imLevel)} / ${zahl(s.noetig)} EP</span>
        </span>
        <span class="ep-balken"><i style=${`width:${Math.round(s.anteil * 100)}%`}></i></span>
      </span>
      <${Icon} name="chevron-right" groesse=${18} />
    </button>
  `;
}

export function Garten() {
  useDaten();
  const s = punkte.stand();
  const tag = punkte.amTag();
  const bild = useMemo(() => gartenSvg(s.level), [s.level]);
  const voll = s.level >= VOLL_AB_LEVEL;

  const zeilen = [];
  if (tag.aufgaben.anzahl) zeilen.push([`${mehrzahl(tag.aufgaben.anzahl, 'Aufgabe', 'Aufgaben')} erledigt`, tag.aufgaben.punkte]);
  if (tag.habits.anzahl) zeilen.push([`${mehrzahl(tag.habits.anzahl, 'Habit', 'Habits')} erfüllt`, tag.habits.punkte]);
  if (tag.tagesroutinen.anzahl) zeilen.push([`${mehrzahl(tag.tagesroutinen.anzahl, 'Tagesroutine', 'Tagesroutinen')} abgehakt`, tag.tagesroutinen.punkte]);
  tag.streaks.forEach((st) => zeilen.push([`Streak ${st.schwelle} ${st.einheit}: ${st.name}`, st.punkte]));

  return html`
    <div class="seite">
      <section class="karte garten-karte">
        <div class="garten-bild" dangerouslySetInnerHTML=${{ __html: bild }}></div>
        <div class="garten-stand">
          <div class="garten-kopf">
            <strong>Level ${s.level}</strong>
            <span>${zahl(s.punkte)} EP insgesamt</span>
          </div>
          <p>${zahl(s.imLevel)} von ${zahl(s.noetig)} EP bis Level ${s.level + 1}</p>
          <div class="ep-balken"><i style=${`width:${Math.round(s.anteil * 100)}%`}></i></div>
        </div>
      </section>
      <p class="text-leise garten-hinweis">
        ${voll
          ? 'Dein Garten steht in voller Blüte. Die Level zählen weiter.'
          : `Mit jedem Level wächst etwas in deinem Garten. Ab Level ${VOLL_AB_LEVEL} steht er in voller Blüte.`}
      </p>

      <section class="abschnitt">
        <div class="abschnitt-kopf">
          <h2>Heute</h2>
          ${tag.gesamt > 0 && html`<span>+${tag.gesamt} EP</span>`}
        </div>
        ${zeilen.length ? html`
          <dl class="werte ep-liste">
            ${zeilen.map(([text, ep]) => html`<div><dt>${text}</dt><dd>+${ep}</dd></div>`)}
          </dl>
        ` : html`<div class="gruppe"><p class="leer-zeile">Heute hast du noch keine EP gesammelt.</p></div>`}
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>So sammelst du EP</h2></div>
        <dl class="werte">
          <div><dt>Aufgabe erledigt</dt><dd>${punkte.EP.aufgabe} EP</dd></div>
          <div><dt>Habit am Tag erfüllt</dt><dd>${punkte.EP.habit} EP</dd></div>
          <div><dt>Tagesroutine abgehakt</dt><dd>${punkte.EP.tagesroutine} EP</dd></div>
          ${punkte.MEILENSTEINE.map((m) => html`<div><dt>Streak eines Habits erreicht ${m.ab}</dt><dd>${m.ep} EP</dd></div>`)}
        </dl>
        <p class="text-leise garten-hinweis">
          Die Aufstiege werden immer langsamer: Der erste braucht ${punkte.aufstieg(1)} EP, dann ${punkte.aufstieg(2)}, ${punkte.aufstieg(3)}, ${punkte.aufstieg(4)} und so weiter.
          Nimmst du ein Häkchen zurück, werden die EP wieder abgezogen. Dein Level sinkt dabei nicht.
        </p>
      </section>
    </div>
  `;
}
