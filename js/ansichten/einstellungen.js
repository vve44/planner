// Einstellungen: Backup, Speicher und Version.

import { html, useState, useEffect } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { melde } from '../bausteine/fenster.js';
import { oeffneBackup } from '../bausteine/backup-dialoge.js';
import { useDaten } from '../haken.js';
import * as store from '../store.js';
import { backupStatus, ERINNERUNG_TAGE } from '../backup.js';
import { datumMitZeit, vorTagen, istInstalliert } from '../hilfen.js';
import { APP_VERSION, ETAPPE, ETAPPE_NAME } from '../version.js';
import { sucheUpdate, updateBereit, uebernimmUpdate, abonniereUpdate, offlineUnterstuetzt } from '../aktualisierung.js';

export const SCHRIFTEN = [
  { wert: 'outfit', name: 'Outfit', text: 'Modern und weich' },
  { wert: 'manrope', name: 'Manrope', text: 'Sachlich, gut lesbar' },
  { wert: 'figtree', name: 'Figtree', text: 'Schlicht und warm' },
  { wert: 'montserrat', name: 'Montserrat', text: 'Breit und markant' },
];

// Die gespeicherte Schrift, falls es sie noch gibt, sonst Outfit.
export function gewaehlteSchrift() {
  const wert = store.einstellung('schrift', 'outfit');
  return SCHRIFTEN.some((s) => s.wert === wert) ? wert : 'outfit';
}

export function Einstellungen() {
  useDaten();
  const [dauerhaft, setDauerhaft] = useState(null);
  const [, setUpdateZaehler] = useState(0);
  const [sucht, setSucht] = useState(false);

  useEffect(() => {
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(setDauerhaft).catch(() => setDauerhaft(null));
    }
    return abonniereUpdate(() => setUpdateZaehler((n) => n + 1));
  }, []);

  const schrift = gewaehlteSchrift();
  const status = backupStatus();
  const anzahl = store.alleDatensaetze().filter((d) => !d.geloeschtAm).length;

  const sucheNachUpdate = async () => {
    setSucht(true);
    const lief = await sucheUpdate();
    // Kurz warten: eine gefundene Version braucht einen Moment, bis sie bereitliegt.
    await new Promise((weiter) => setTimeout(weiter, 1500));
    setSucht(false);
    if (!lief) melde('Die Suche braucht eine Internetverbindung.');
    else if (!updateBereit()) melde('Der Planner ist auf dem neuesten Stand.');
  };

  return html`
    <div class="seite">
      <section class="abschnitt">
        <h2>Schrift</h2>
        <div class="schrift-wahl" role="radiogroup" aria-label="Schrift">
          ${SCHRIFTEN.map((s) => html`
            <button type="button" role="radio" aria-checked=${schrift === s.wert}
              class=${`schrift-karte ${schrift === s.wert ? 'aktiv' : ''}`}
              style=${`font-family:'${s.name}', var(--ersatz)`}
              onClick=${() => store.setzeEinstellung('schrift', s.wert)}>
              <span class="schrift-probe">${s.name}</span>
              <span class="schrift-name">${s.text}</span>
            </button>
          `)}
        </div>
        <p class="text-leise">Tippe eine Schrift an, sie gilt sofort in der ganzen App.</p>
      </section>

      <section class="abschnitt">
        <h2>Backup</h2>
        <dl class="werte">
          <div>
            <dt>Letztes Backup</dt>
            <dd>${status.letztesAm ? `${datumMitZeit(status.letztesAm)} (${vorTagen(status.tage)})` : 'Noch keines'}</dd>
          </div>
          <div>
            <dt>Erinnerung</dt>
            <dd>${status.eingerichtet ? `Alle ${ERINNERUNG_TAGE} Tage im Tagesbereich` : 'Nach dem Einrichten'}</dd>
          </div>
        </dl>
        <div class="knopf-stapel">
          ${status.eingerichtet ? html`
            <button class="knopf breit" type="button" onClick=${() => oeffneBackup('erstellen')}>
              <${Icon} name="shield-check" /> Backup erstellen
            </button>
            <button class="knopf breit leise" type="button" onClick=${() => oeffneBackup('passwort-aendern')}>
              <${Icon} name="key-round" /> Backup-Passwort ändern
            </button>
          ` : html`
            <button class="knopf breit" type="button" onClick=${() => oeffneBackup('einrichten')}>
              <${Icon} name="shield-check" /> Backup einrichten
            </button>
          `}
          <button class="knopf breit leise" type="button" onClick=${() => oeffneBackup('wiederherstellen')}>
            <${Icon} name="upload" /> Backup wiederherstellen
          </button>
        </div>
      </section>

      <section class="abschnitt">
        <h2>Speicher</h2>
        <dl class="werte">
          <div>
            <dt>Ort der Daten</dt>
            <dd>Nur auf diesem Gerät</dd>
          </div>
          <div>
            <dt>Gespeicherte Einträge</dt>
            <dd>${anzahl}</dd>
          </div>
          <div>
            <dt>Als App installiert</dt>
            <dd>${istInstalliert() ? 'Ja' : 'Nein, läuft im Browser-Tab'}</dd>
          </div>
          <div>
            <dt>Dauerhafter Speicher</dt>
            <dd>${dauerhaft === true ? 'Vom Browser zugesagt' : dauerhaft === false ? 'Nicht zugesagt' : 'Unbekannt'}</dd>
          </div>
          <div>
            <dt>Offline nutzbar</dt>
            <dd>${offlineUnterstuetzt() ? 'Ja' : 'Von diesem Browser nicht unterstützt'}</dd>
          </div>
        </dl>
        ${dauerhaft === false && html`
          <p class="text-leise">
            Ohne Zusage kann der Browser Daten bei sehr knappem Speicher entfernen. Das wöchentliche Backup schützt dich davor.
          </p>
        `}
      </section>

      <section class="abschnitt">
        <h2>Version</h2>
        <dl class="werte">
          <div>
            <dt>Stand</dt>
            <dd>Etappe ${ETAPPE} (${ETAPPE_NAME}), Version ${APP_VERSION}</dd>
          </div>
        </dl>
        <div class="knopf-stapel">
          ${updateBereit() ? html`
            <button class="knopf breit" type="button" onClick=${uebernimmUpdate}>
              <${Icon} name="rotate-ccw" /> Neue Version übernehmen
            </button>
          ` : html`
            <button class="knopf breit leise" type="button" disabled=${sucht} onClick=${sucheNachUpdate}>
              <${Icon} name="rotate-ccw" /> ${sucht ? 'Suche läuft …' : 'Nach neuer Version suchen'}
            </button>
          `}
        </div>
      </section>
    </div>
  `;
}
