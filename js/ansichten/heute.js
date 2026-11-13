// Tagesbereich: Hinweise zu Installation und Backup, Überfälliges und die Aufgaben für heute.
// Tagesroutinen, Vorschläge, Habits und Zyklusphase kommen mit späteren Etappen dazu.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { AufgabenGruppe } from '../bausteine/aufgabe-zeile.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { oeffneBackup } from '../bausteine/backup-dialoge.js';
import { useDaten } from '../haken.js';
import { backupStatus } from '../backup.js';
import * as aufgaben from '../aufgaben.js';
import { heute, istInstalliert, vorTagen } from '../hilfen.js';

const SPAETER = [
  { icon: 'sun', name: 'Tagesroutinen', etappe: 3 },
  { icon: 'sparkles', name: 'Vorschläge', etappe: 3 },
  { icon: 'flame', name: 'Habits', etappe: 5 },
  { icon: 'droplet', name: 'Zyklusphase', etappe: 7 },
];

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

      <${AufgabenGruppe} titel="Überfällig" liste=${ueberfaellig} warnung=${true} zeigeDatum=${true} mitMorgen=${true} />
      <${AufgabenGruppe} titel="Aufgaben für heute" liste=${[...offen, ...geschafft]} mitMorgen=${true}
        leerText="Für heute ist nichts geplant. Mit dem Plus legst du eine Aufgabe an." />

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
