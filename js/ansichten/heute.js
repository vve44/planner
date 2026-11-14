// Tagesbereich: der Stand des heutigen Tages.
// Von oben nach unten: Termine, Tagesroutinen, Habits, Überfälliges, Aufgaben für heute,
// Vorschläge aus den Pools. Die Zyklusphase kommt mit einer späteren Etappe dazu.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { melde } from '../bausteine/fenster.js';
import { AufgabenGruppe } from '../bausteine/aufgabe-zeile.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { oeffneBackup } from '../bausteine/backup-dialoge.js';
import { useDaten, geheZu } from '../haken.js';
import { backupStatus } from '../backup.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as tagesroutinen from '../tagesroutinen.js';
import * as pools from '../pools.js';
import * as termine from '../termine.js';
import * as habits from '../habits.js';
import { TerminBlatt } from '../bausteine/termin-blatt.js';
import { HabitZeile } from '../bausteine/habit-teile.js';
import { heute, istInstalliert, vorTagen, tagLesbar, dauerLesbar, jetztMin } from '../hilfen.js';

const SPAETER = [
  { icon: 'droplet', name: 'Zyklusphase', etappe: 7 },
];
const TERMIN_FARBE = '#7ba6a5';

export function Heute() {
  useDaten();
  const status = backupStatus();
  const tag = heute();
  const alle = aufgaben.alleAufgaben();
  const ueberfaellig = aufgaben.sortiere(alle.filter((a) => aufgaben.istUeberfaellig(a, tag)));
  const offen = aufgaben.sortiere(alle.filter((a) => !a.erledigtAm && a.plandatum === tag));
  const geschafft = aufgaben.sortiereErledigte(alle.filter((a) => aufgaben.heuteErledigt(a)));

  return html`
    <div class="seite">
      ${!istInstalliert() && html`<${InstallHinweis} />`}
      <${BackupKarte} status=${status} />

      <${TermineHeute} tag=${tag} />
      <${Tagesroutinen} tag=${tag} />
      <${HabitsHeute} tag=${tag} />

      <${AufgabenGruppe} titel="Überfällig" liste=${ueberfaellig} warnung=${true} zeigeDatum=${true} mitMorgen=${true} />
      <${AufgabenGruppe} titel="Aufgaben für heute" liste=${[...offen, ...geschafft]} mitMorgen=${true}
        leerText="Für heute ist nichts geplant. Mit dem Plus legst du eine Aufgabe an." />

      <${Vorschlaege} tag=${tag} />

      <section class="abschnitt">
        <h2>Kommt noch dazu</h2>
        <ul class="spaeter-liste">
          ${SPAETER.map((s) => html`
            <li><${Icon} name=${s.icon} groesse=${16} /> ${s.name}, Etappe ${s.etappe}</li>
          `)}
        </ul>
      </section>

      <button class="knopf-plus" type="button" aria-label="Aufgabe für heute anlegen"
        onClick=${() => oeffneAufgabe({ vorgaben: { plandatum: tag } })}>
        <${Icon} name="plus" groesse=${26} />
      </button>
    </div>
  `;
}

// ---------- Termine des Tages (nur wenn es welche gibt) ----------

function TermineHeute({ tag }) {
  const [offen, setOffen] = useState(null);
  const { ganztags, zeitlich } = termine.eintraegeAm(tag);
  const jetzt = jetztMin();
  const zeilen = [
    ...ganztags.map((v) => ({ v, zeit: 'Ganztägig', vorbei: false })),
    ...zeitlich.map((v) => ({ v, zeit: termine.zeitText(v, tag), vorbei: v.bisMin <= jetzt })),
  ];
  if (!zeilen.length && !offen) return null;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf">
        <h2>Termine</h2>
        <span class="kopf-rechts">
          <span>${zeilen.length}</span>
          <button class="knopf-text" type="button" onClick=${() => geheZu('kalender')}>Kalender</button>
        </span>
      </div>
      <ul class="gruppe">
        ${zeilen.map(({ v, zeit, vorbei }) => {
          const kategorie = v.termin.kategorieId ? store.hole(v.termin.kategorieId) : null;
          const kategorieDa = kategorie && !kategorie.geloeschtAm;
          return html`
            <li key=${`${v.termin.id}-${v.start}`}>
              <button type="button" class=${`agenda-zeile ${vorbei ? 'vorbei' : ''}`} onClick=${() => setOffen({ id: v.termin.id, start: v.start })}>
                <span class="agenda-zeit">${zeit}</span>
                <i class="agenda-farbe" style=${`background:${kategorieDa ? kategorie.farbe : TERMIN_FARBE}`}></i>
                <span class="agenda-text">
                  <strong>${v.termin.titel}</strong>
                  ${kategorieDa && html`<span>${kategorie.name}</span>`}
                </span>
              </button>
            </li>
          `;
        })}
      </ul>
      ${offen && html`<${TerminBlatt} key=${offen.id} offen=${offen} onSchliessen=${() => setOffen(null)} />`}
    </section>
  `;
}

// ---------- Habits, die heute anstehen ----------

function HabitsHeute({ tag }) {
  const alle = habits.alle();
  const urlaub = habits.urlaubAm(tag);
  // Was heute nicht dran ist oder ruht, erscheint hier nicht.
  const sichtbar = alle
    .map((habit) => ({ habit, lage: habits.lageAm(habit, tag) }))
    .filter(({ lage }) => lage !== 'frei' && lage !== 'ruht');
  const liste = [...sichtbar.filter((x) => x.lage === 'offen'), ...sichtbar.filter((x) => x.lage !== 'offen')];
  const erledigt = sichtbar.filter((x) => x.lage === 'erledigt').length;
  const zuTun = sichtbar.filter((x) => x.lage === 'offen' || x.lage === 'erledigt').length;

  let leerText = 'Heute steht kein Habit an.';
  if (!alle.length) leerText = 'Gewohnheiten mit Streak und Statistik, zum Beispiel täglich lesen oder dreimal pro Woche Sport.';
  else if (urlaub && !liste.length) leerText = `Urlaub bis ${tagLesbar(urlaub.bis)}: Alle Habits ruhen, die Streaks bleiben.`;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf">
        <h2>Habits</h2>
        <span class="kopf-rechts">
          ${zuTun > 0 && html`<span>${erledigt}/${zuTun}</span>`}
          <button class="knopf-text" type="button" onClick=${() => geheZu('habits')}>${alle.length ? 'Alle' : 'Einrichten'}</button>
        </span>
      </div>
      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map(({ habit }) => html`<${HabitZeile} key=${habit.id} habit=${habit} tag=${tag} />`)}
        </ul>
      ` : html`<div class="gruppe"><p class="leer-zeile">${leerText}</p></div>`}
    </section>
  `;
}

// ---------- Tagesroutinen: täglich einzeln abhaken, ohne Streak ----------

function Tagesroutinen({ tag }) {
  const liste = tagesroutinen.alle();
  const erledigt = tagesroutinen.erledigteAm(tag);
  const geschafft = liste.filter((r) => erledigt.has(r.id)).length;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf">
        <h2>Tagesroutinen</h2>
        <span class="kopf-rechts">
          ${liste.length > 0 && html`<span>${geschafft}/${liste.length}</span>`}
          <button class="knopf-text" type="button" onClick=${() => geheZu('tagesroutinen')}>
            ${liste.length ? 'Bearbeiten' : 'Einrichten'}
          </button>
        </span>
      </div>
      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map((r) => {
            const fertig = erledigt.has(r.id);
            return html`
              <li key=${r.id} class=${`routine-zeile ${fertig ? 'erledigt' : ''}`}>
                <button class="haken" type="button" aria-pressed=${fertig}
                  aria-label=${fertig ? `${r.titel} wieder öffnen` : `${r.titel} abhaken`}
                  onClick=${() => tagesroutinen.schalte(r.id, tag)}>
                  <span class="haken-kreis">${fertig && html`<${Icon} name="check" groesse=${15} strich=${2.6} />`}</span>
                </button>
                <span class="routine-name">
                  ${r.icon && html`<${Icon} name=${r.icon} groesse=${18} />`}
                  ${r.titel}
                </span>
              </li>
            `;
          })}
        </ul>
      ` : html`
        <div class="gruppe">
          <p class="leer-zeile">Feste Punkte, die du jeden Tag abhakst, zum Beispiel „Vitamine nehmen“. Ohne Streak.</p>
        </div>
      `}
    </section>
  `;
}

// ---------- Vorschläge: was laut Putzplan und anderen Pools ansteht ----------

function Vorschlaege({ tag }) {
  const liste = pools.vorschlaege(tag);
  const gibtPools = pools.pools().length > 0;

  const erledigt = (eintrag) => {
    const vorher = pools.markiereErledigt(eintrag.id, tag);
    const danach = store.hole(eintrag.id);
    melde(`„${eintrag.titel}“ erledigt, wieder dran: ${tagLesbar(danach.naechsteFaelligkeit)}`, {
      aktion: 'Rückgängig',
      beiAktion: () => pools.setzeZurueck(eintrag.id, vorher),
    });
  };

  const einplanen = (eintrag) => {
    const zurueck = aufgaben.ausPoolEintrag(eintrag.id);
    melde(`„${eintrag.titel}“ für heute eingeplant`, { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf">
        <h2>Vorschläge</h2>
        <span class="kopf-rechts">
          ${liste.length > 0 && html`<span>${liste.length}</span>`}
          <button class="knopf-text" type="button" onClick=${() => geheZu('pools')}>${gibtPools ? 'Pools' : 'Einrichten'}</button>
        </span>
      </div>
      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map((e) => {
            const pool = pools.poolVon(e);
            const zuSpaet = e.naechsteFaelligkeit < tag;
            return html`
              <li class="aufgabe" key=${e.id}>
                <div class="aufgabe-zeile">
                  <button class="haken" type="button" aria-pressed="false" aria-label=${`${e.titel} als erledigt abhaken`} onClick=${() => erledigt(e)}>
                    <span class="haken-kreis"></span>
                  </button>
                  <div class="aufgabe-haupt">
                    <span class="aufgabe-titel">${e.titel}</span>
                    <span class="aufgabe-meta">
                      <span><${Icon} name=${pool.icon || 'repeat'} groesse=${14} /> ${pool.name}</span>
                      <span class=${zuSpaet ? 'warnung' : ''}>
                        <${Icon} name="calendar" groesse=${14} /> ${zuSpaet ? 'War dran:' : 'Dran:'} ${tagLesbar(e.naechsteFaelligkeit)}
                      </span>
                      ${e.dauerMin && html`<span><${Icon} name="timer" groesse=${14} /> ${dauerLesbar(e.dauerMin)}</span>`}
                    </span>
                  </div>
                  <button class="zeilen-knopf" type="button" aria-label=${`${e.titel} für heute einplanen`} onClick=${() => einplanen(e)}>
                    Einplanen
                  </button>
                </div>
              </li>
            `;
          })}
        </ul>
      ` : html`
        <div class="gruppe">
          <p class="leer-zeile">
            ${gibtPools
              ? 'Gerade steht nichts an.'
              : 'Ein Aufgabenpool wie der Putzplan schlägt dir hier vor, was wieder dran ist.'}
          </p>
        </div>
      `}
    </section>
  `;
}

function InstallHinweis() {
  return html`
    <section class="karte hinweis-karte">
      <span class="karte-icon"><${Icon} name="smartphone" /></span>
      <div>
        <h2>Zum Home-Bildschirm hinzufügen</h2>
        <p>
          Tippe in Safari auf das Teilen-Symbol und wähle „Zum Home-Bildschirm“.
          Starte den Planner danach immer über das neue Icon.
        </p>
        <p>Trag deine Daten erst dort ein. Was du hier im Browser-Tab eingibst, landet nicht in der installierten App.</p>
      </div>
    </section>
  `;
}

function BackupKarte({ status }) {
  if (!status.eingerichtet) {
    return html`
      <section class="karte hinweis-karte">
        <span class="karte-icon"><${Icon} name="shield-check" /></span>
        <div>
          <h2>Backup einrichten</h2>
          <p>
            Deine Daten liegen nur auf diesem Handy. Lege ein Backup-Passwort fest,
            dann sicherst du sie als verschlüsselte Datei in iCloud.
          </p>
          <button class="knopf" type="button" onClick=${() => oeffneBackup('einrichten')}>Backup einrichten</button>
        </div>
      </section>
    `;
  }
  if (!status.faellig) return null;
  return html`
    <section class="karte hinweis-karte faellig">
      <span class="karte-icon"><${Icon} name="shield-check" /></span>
      <div>
        <h2>Zeit für dein Backup</h2>
        <p>
          ${status.tage === null
            ? 'Du hast noch kein Backup erstellt.'
            : `Dein letztes Backup ist ${vorTagen(status.tage)} entstanden.`}
        </p>
        <button class="knopf" type="button" onClick=${() => oeffneBackup('erstellen')}>Backup erstellen</button>
      </div>
    </section>
  `;
}
