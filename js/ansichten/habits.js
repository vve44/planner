// Habit-Bereich: alle Habits mit Stand und Streak, Urlaubszeiten,
// und je Habit eine Seite mit Auswertung und Verlauf (Heatmap).

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, frage, oeffneBlatt } from '../bausteine/fenster.js';
import { loescheHabit, loescheUrlaub as loescheUrlaubEintrag } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { HabitZeile, HabitTagBlatt } from '../bausteine/habit-teile.js';
import { HabitBlatt } from '../bausteine/habit-blatt.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as habits from '../habits.js';
import { heute, plusTage, montagVon, datumAusText, tagLesbar, tagAusfuehrlich, spanneLesbar, datumKurz } from '../hilfen.js';

// ---------- Alle Habits ----------

export function Habits() {
  useDaten();
  const [neu, setNeu] = useState(false);
  const [urlaubOffen, setUrlaubOffen] = useState(null); // null | { neu: true } | { id }
  const tag = heute();
  const liste = habits.alle();
  const aktive = liste.filter((h) => !habits.istPausiert(h));
  const pausierte = liste.filter((h) => habits.istPausiert(h));
  const urlaub = habits.urlaubAm(tag);
  const urlaube = [...habits.urlaube()].reverse();

  const loescheUrlaub = (u) => loescheUrlaubEintrag(u);

  if (!liste.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="flame" groesse=${28} strich=${1.4} /></span>
          <h2>Noch kein Habit</h2>
          <p class="text-leise">
            Ein Habit ist eine Gewohnheit, die du regelmäßig abhakst, zum Beispiel täglich lesen,
            dreimal pro Woche Sport oder acht Gläser Wasser am Tag. Die App zählt deine Streak
            und zeigt dir den Verlauf.
          </p>
          <button class="knopf" type="button" onClick=${() => setNeu(true)}>
            <${Icon} name="plus" /> Habit anlegen
          </button>
        </section>
        ${neu && html`<${HabitBlatt} onSchliessen=${() => setNeu(false)} />`}
      </div>
    `;
  }

  return html`
    <div class="seite">
      ${urlaub && html`
        <section class="karte hinweis-karte">
          <span class="karte-icon"><${Icon} name="tree-palm" /></span>
          <div>
            <h2>Urlaub bis ${tagLesbar(urlaub.bis)}</h2>
            <p>Alle Habits ruhen, die Streaks bleiben erhalten. Abhaken kannst du trotzdem.</p>
          </div>
        </section>
      `}

      ${aktive.length > 0 && html`
        <section class="abschnitt">
          <div class="abschnitt-kopf"><h2>Heute</h2></div>
          <ul class="gruppe">
            ${aktive.map((h) => html`<${HabitZeile} key=${h.id} habit=${h} tag=${tag} zeigeFrequenz=${true} />`)}
          </ul>
        </section>
      `}

      ${pausierte.length > 0 && html`
        <section class="abschnitt">
          <div class="abschnitt-kopf"><h2>Pausiert</h2></div>
          <ul class="gruppe">
            ${pausierte.map((h) => html`<${HabitZeile} key=${h.id} habit=${h} tag=${tag} zeigeFrequenz=${true} />`)}
          </ul>
        </section>
      `}

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Urlaub</h2></div>
        ${urlaube.length ? html`
          <ul class="gruppe">
            ${urlaube.map((u) => html`
              <li class=${`zeile ${u.bis < tag ? 'vorbei' : ''}`} key=${u.id} data-lang=${`urlaub:${u.id}`}>
                <button class="zeile-haupt" type="button" onClick=${() => setUrlaubOffen({ id: u.id })}>
                  <span class="listen-icon"><${Icon} name="tree-palm" groesse=${20} /></span>
                  <span class="zeile-text">
                    <strong>${u.von === u.bis ? datumKurz(datumAusText(u.von)) : spanneLesbar(u.von, u.bis)}</strong>
                    <span>${u.bis < tag ? 'Vorbei' : u.von <= tag ? 'Läuft gerade' : `Beginnt: ${tagLesbar(u.von)}`}</span>
                  </span>
                </button>
                <span class="zeile-knoepfe">
                  <button class="knopf-rund" type="button" aria-label="Urlaub löschen" onClick=${() => loescheUrlaub(u)}>
                    <${Icon} name="trash-2" groesse=${20} />
                  </button>
                </span>
              </li>
            `)}
          </ul>
        ` : html`
          <div class="gruppe"><p class="leer-zeile">Im Urlaub ruhen alle Habits. Die Streaks bleiben erhalten.</p></div>
        `}
        <button class="knopf leise breit" type="button" onClick=${() => setUrlaubOffen({ neu: true })}>
          <${Icon} name="plus" groesse=${20} /> Urlaub eintragen
        </button>
      </section>

      <button class="knopf-plus" type="button" aria-label="Habit anlegen" onClick=${() => setNeu(true)}>
        <${Icon} name="plus" groesse=${26} />
      </button>

      ${neu && html`<${HabitBlatt} onSchliessen=${() => setNeu(false)} />`}
      ${urlaubOffen && html`<${UrlaubBlatt} offen=${urlaubOffen} onSchliessen=${() => setUrlaubOffen(null)} />`}
    </div>
  `;
}

// ---------- Urlaub eintragen und ändern ----------

registriere('urlaub', { bearbeiten: (u) => oeffneBlatt((zu) => html`<${UrlaubBlatt} offen=${{ id: u.id }} onSchliessen=${zu} />`) });

function UrlaubBlatt({ offen, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const [von, setVon] = useState(vorhanden ? vorhanden.von : heute());
  const [bis, setBis] = useState(vorhanden ? vorhanden.bis : plusTage(heute(), 6));
  const [fehler, setFehler] = useState('');

  const speichern = () => {
    if (!von || !bis) return setFehler('Gib den ersten und den letzten Tag an.');
    if (bis < von) return setFehler('Der letzte Tag liegt vor dem ersten.');
    if (vorhanden) store.aendern(vorhanden.id, { von, bis });
    else habits.neuerUrlaub(von, bis);
    onSchliessen();
    return null;
  };

  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Urlaub eintragen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${vorhanden ? 'Urlaub ändern' : 'Urlaub eintragen'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <label class="feld-gruppe">
          <span>Erster Tag</span>
          <input class="feld" type="date" value=${von}
            onInput=${(e) => { setVon(e.target.value); if (e.target.value > bis) setBis(e.target.value); setFehler(''); }} />
        </label>
        <label class="feld-gruppe">
          <span>Letzter Tag</span>
          <input class="feld" type="date" value=${bis} min=${von} onInput=${(e) => { setBis(e.target.value); setFehler(''); }} />
        </label>
        <p class="feld-hinweis">
          In dieser Zeit ruhen alle Habits. Die Tage brechen keine Streak und zählen auch nicht mit.
          Was du trotzdem abhakst, zählt.
        </p>
      </div>
    <//>
  `;
}

// ---------- Ein einzelnes Habit: Auswertung und Verlauf ----------

export function Habit({ teil }) {
  useDaten();
  const [bearbeiten, setBearbeiten] = useState(false);
  const habit = teil ? store.hole(teil) : null;
  const tag = heute();

  if (!habit || habit.geloeschtAm || habit.typ !== 'habit') {
    return html`
      <div class="seite">
        <section class="leer">
          <h2>Dieses Habit gibt es nicht mehr</h2>
          <button class="knopf" type="button" onClick=${() => geheZu('habits')}>Zu den Habits</button>
        </section>
      </div>
    `;
  }

  const kategorie = habit.kategorieId ? store.hole(habit.kategorieId) : null;
  const kategorieDa = kategorie && !kategorie.geloeschtAm;
  const pausiert = habits.istPausiert(habit);
  const s = habits.streak(habit, tag);
  const q = habits.quote(habit, tag);
  const st = habits.statistik(habit, tag);
  const stand = habits.periodenStand(habit, tag);
  const angaben = [habits.frequenzText(habit)];
  if (habit.menge) angaben.push(`Tagesziel ${habits.mengeText(habit)}`);

  const loeschen = async () => {
    if (await loescheHabit(habit)) geheZu('habits');
  };

  const kacheln = [
    { name: 'Aktuelle Streak', wert: s.text, gold: s.aktuell > 0, icon: 'flame' },
    { name: 'Längste Streak', wert: s.textLaengste, icon: 'award' },
    { name: q ? `Quote, ${q.zeitraum}` : 'Quote', wert: q ? `${Math.round(q.anteil * 100)} %` : 'Noch offen', icon: 'percent' },
    { name: 'Erledigt insgesamt', wert: st.erfuellteTage === 1 ? '1 Tag' : `${st.erfuellteTage} Tage`, icon: 'circle-check' },
  ];
  if (stand) kacheln.push({ name: stand.wort === 'diese Woche' ? 'Diese Woche' : 'Dieser Monat', wert: `${stand.ist} von ${stand.soll}`, icon: 'target' });
  else kacheln.push({ name: 'Diesen Monat erledigt', wert: st.dieserMonat === 1 ? '1 Tag' : `${st.dieserMonat} Tage`, icon: 'calendar-check' });
  if (habit.menge) {
    const einheit = habit.menge.einheit ? ` ${habit.menge.einheit}` : '';
    kacheln.push({ name: 'Menge insgesamt', wert: `${habits.zahlText(st.summe)}${einheit}`, icon: 'hash' });
    kacheln.push({ name: 'Schnitt je Tag mit Eintrag', wert: `${habits.zahlText(st.schnitt)}${einheit}`, icon: 'trending-up' });
  }

  return html`
    <div class="seite">
      <div class="leiste">
        <p class="text-leise">
          ${kategorieDa && html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${kategorie.farbe}`}></i>`}
          ${kategorieDa ? `${kategorie.name}, ` : ''}${angaben.join(', ')}
        </p>
        <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
      </div>

      ${pausiert && html`
        <section class="karte hinweis-karte">
          <span class="karte-icon"><${Icon} name="pause" /></span>
          <div>
            <h2>Pausiert seit ${tagLesbar(habit.pausiertSeit).replace('Heute', 'heute').replace('Gestern', 'gestern')}</h2>
            <p>Das Habit ruht und erscheint nicht im Tagesbereich. Die Streak bleibt erhalten.</p>
            <button class="knopf" type="button" onClick=${() => habits.setzeFort(habit)}>
              <${Icon} name="play" groesse=${20} /> Fortsetzen
            </button>
          </div>
        </section>
      `}

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Heute</h2></div>
        <ul class="gruppe">
          <${HabitZeile} habit=${habit} tag=${tag} ohneLink=${true} />
        </ul>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Auswertung</h2><span>seit ${datumKurz(datumAusText(st.seit))}</span></div>
        <dl class="zahlen-raster">
          ${kacheln.map((k) => html`
            <div class=${k.gold ? 'gold' : ''}>
              <dt><${Icon} name=${k.icon} groesse=${15} /> ${k.name}</dt>
              <dd>${k.wert}</dd>
            </div>
          `)}
        </dl>
      </section>

      <${Verlauf} habit=${habit} tag=${tag} />

      <div class="knopf-stapel">
        ${!pausiert && html`
          <button class="knopf breit leise" type="button"
            onClick=${() => { habits.pausiere(habit); melde(`„${habit.name}“ pausiert. Die Streak bleibt.`); }}>
            <${Icon} name="pause" groesse=${20} /> Pausieren
          </button>
        `}
        <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
          <${Icon} name="trash-2" groesse=${20} /> Habit löschen
        </button>
      </div>

      ${bearbeiten && html`<${HabitBlatt} habit=${habit} onSchliessen=${() => setBearbeiten(false)} />`}
    </div>
  `;
}

// ---------- Verlauf: Kalender-Heatmap, eine Spalte je Woche ----------

const WOCHEN = 17;
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const STUFEN_TEXT = { 0: 'nicht erledigt', 1: 'teilweise', 2: 'teilweise', 3: 'fast geschafft', 4: 'erledigt', ruhe: 'Ruhetag', vor: '' };

function Verlauf({ habit, tag }) {
  const [seite, setSeite] = useState(0); // 0 = bis heute, 1 = der Abschnitt davor …
  const [offenerTag, setOffenerTag] = useState(null);
  const letzterMontag = plusTage(montagVon(tag), -seite * WOCHEN * 7);
  const ersterMontag = plusTage(letzterMontag, -(WOCHEN - 1) * 7);
  const wochen = Array.from({ length: WOCHEN }, (_, w) => plusTage(ersterMontag, w * 7));
  const letzterTag = plusTage(letzterMontag, 6) > tag ? tag : plusTage(letzterMontag, 6);

  // Der Monatsname steht über der Woche, in der ein Monat beginnt. Ganz links steht
  // der laufende Monat, wenn dort Platz ist.
  const monatsNamen = wochen.map((montag) => {
    const sonntag = plusTage(montag, 6);
    const beginnt = montag.slice(5, 7) !== sonntag.slice(5, 7) || montag.slice(8) === '01';
    return beginnt ? MONATE_KURZ[Number(sonntag.slice(5, 7)) - 1] : '';
  });
  if (!monatsNamen[0] && !monatsNamen[1] && !monatsNamen[2]) monatsNamen[0] = MONATE_KURZ[Number(wochen[0].slice(5, 7)) - 1];

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf">
        <h2>Verlauf</h2>
        <span>${spanneLesbar(ersterMontag, letzterTag)}</span>
      </div>
      <div class="karte verlauf">
        <div class="heat" style=${`--wochen:${WOCHEN}`}>
          <div class="heat-monate" aria-hidden="true">
            <span></span>
            ${monatsNamen.map((name) => html`<span>${name}</span>`)}
          </div>
          <div class="heat-raster">
            ${['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((name) => html`<span class="heat-tag" aria-hidden="true">${name}</span>`)}
            ${wochen.map((montag) => Array.from({ length: 7 }, (_, i) => plusTage(montag, i)).map((d) => {
              if (d > tag) return html`<i class="heat-zelle zukunft" key=${d}></i>`;
              const stufe = habits.stufeAm(habit, d, tag);
              return html`
                <button type="button" key=${d} class=${`heat-zelle s-${stufe} ${d === tag ? 'heute' : ''}`}
                  aria-label=${`${tagAusfuehrlich(d)}${STUFEN_TEXT[stufe] ? `: ${STUFEN_TEXT[stufe]}` : ''}`}
                  onClick=${() => setOffenerTag(d)}></button>
              `;
            }))}
          </div>
        </div>

        <div class="heat-fuss">
          <span class="heat-legende">
            <span><i class="heat-zelle s-0"></i> offen</span>
            ${habit.menge && html`<span><i class="heat-zelle s-2"></i> teilweise</span>`}
            <span><i class="heat-zelle s-4"></i> erledigt</span>
            <span><i class="heat-zelle s-ruhe"></i> Ruhetag</span>
          </span>
          <span class="heat-nav">
            <button class="knopf-rund" type="button" aria-label="Früher" onClick=${() => setSeite(seite + 1)}>
              <${Icon} name="chevron-left" />
            </button>
            <button class="knopf-rund" type="button" aria-label="Später" disabled=${seite === 0} onClick=${() => setSeite(Math.max(0, seite - 1))}>
              <${Icon} name="chevron-right" />
            </button>
          </span>
        </div>
        <p class="feld-hinweis">Tippe einen Tag an, um ihn nachzutragen oder zu ändern.</p>
      </div>

      ${offenerTag && html`<${HabitTagBlatt} habit=${habit} tag=${offenerTag} onSchliessen=${() => setOffenerTag(null)} />`}
    </section>
  `;
}
