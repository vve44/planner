// Tagesbereich. In Etappe 1 zeigt er die Hinweise zu Installation und Backup
// und den geplanten Aufbau. Die Inhalte kommen mit den nächsten Etappen.

import { html } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { oeffneBackup } from '../bausteine/backup-dialoge.js';
import { useDaten } from '../haken.js';
import { backupStatus } from '../backup.js';
import { istInstalliert, vorTagen } from '../hilfen.js';

const BLOECKE = [
  { icon: 'sun', name: 'Tagesroutinen', text: 'Feste Punkte, die du täglich abhakst', etappe: 3 },
  { icon: 'droplet', name: 'Zyklusphase', text: 'Phase, Zyklustag und kurze Infos', etappe: 7 },
  { icon: 'flame', name: 'Habits für heute', text: 'Gewohnheiten mit Streak', etappe: 5 },
  { icon: 'list-checks', name: 'Aufgaben für heute', text: 'Geplantes und Überfälliges', etappe: 2 },
  { icon: 'sparkles', name: 'Vorschläge', text: 'Fälliges aus Putzplan und anderen Pools', etappe: 3 },
];

export function Heute() {
  useDaten();
  const status = backupStatus();
  const installiert = istInstalliert();

  return html`
    <div class="seite">
      ${!installiert && html`<${InstallHinweis} />`}
      <${BackupKarte} status=${status} />

      <section class="abschnitt">
        <h2>Dein Tag</h2>
        <p class="text-leise">
          Das Fundament steht: Design, Kategorien und Backup. Diese Blöcke füllen sich mit den nächsten Etappen.
        </p>
        <ul class="block-liste">
          ${BLOECKE.map((b) => html`
            <li class="block-zeile">
              <span class="block-icon"><${Icon} name=${b.icon} /></span>
              <span class="block-text">
                <strong>${b.name}</strong>
                <span>${b.text}</span>
              </span>
              <span class="etikett">Etappe ${b.etappe}</span>
            </li>
          `)}
        </ul>
      </section>
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
        <p class="text-leise">
          Trag deine Daten erst dort ein. Was du hier im Browser-Tab eingibst, landet nicht in der installierten App.
        </p>
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
