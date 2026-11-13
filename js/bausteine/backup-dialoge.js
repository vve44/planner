// Die Fenster rund ums Backup: Passwort festlegen, Backup erstellen, wiederherstellen.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Blatt, melde } from './fenster.js';
import { Icon } from './icon.js';
import * as backup from '../backup.js';
import { sicherstelleMerkliste } from '../aufgaben.js';
import { TYP_NAMEN } from '../typen.js';
import { datumMitZeit, groesseLesbar } from '../hilfen.js';

let setzeAktion = null;

// Öffnet eines der Backup-Fenster: 'einrichten', 'passwort-aendern', 'erstellen', 'wiederherstellen'.
export function oeffneBackup(art) {
  if (setzeAktion) setzeAktion({ art });
}

// Wird einmal ganz oben in der App eingehängt.
export function BackupDialoge() {
  const [aktion, setAktion] = useState(null);
  useEffect(() => {
    setzeAktion = setAktion;
    return () => { setzeAktion = null; };
  }, []);

  if (!aktion) return null;
  const schliessen = () => setAktion(null);

  if (aktion.art === 'einrichten' || aktion.art === 'passwort-aendern') {
    return html`<${PasswortBlatt}
      aendern=${aktion.art === 'passwort-aendern'}
      onSchliessen=${schliessen}
      onFertig=${() => (aktion.art === 'einrichten' ? setAktion({ art: 'erstellen' }) : schliessen())}
    />`;
  }
  if (aktion.art === 'erstellen') {
    if (!backup.passwortGesetzt()) {
      return html`<${PasswortBlatt} onSchliessen=${schliessen} onFertig=${() => setAktion({ art: 'erstellen', neu: true })} />`;
    }
    return html`<${ErstellenBlatt} onSchliessen=${schliessen} />`;
  }
  if (aktion.art === 'wiederherstellen') {
    return html`<${WiederherstellenBlatt} onSchliessen=${schliessen} />`;
  }
  return null;
}

// ---------- Passwort festlegen oder ändern ----------

function PasswortBlatt({ aendern = false, onSchliessen, onFertig }) {
  const [eins, setEins] = useState('');
  const [zwei, setZwei] = useState('');
  const [fehler, setFehler] = useState('');
  const [arbeitet, setArbeitet] = useState(false);

  const speichern = async (e) => {
    e.preventDefault();
    if (eins.length < backup.PASSWORT_MINDESTLAENGE) {
      setFehler(`Das Passwort braucht mindestens ${backup.PASSWORT_MINDESTLAENGE} Zeichen.`);
      return;
    }
    if (eins !== zwei) {
      setFehler('Die beiden Eingaben stimmen nicht überein.');
      return;
    }
    setArbeitet(true);
    try {
      await backup.setzePasswort(eins);
      if (aendern) melde('Backup-Passwort geändert');
      onFertig();
    } catch (problem) {
      setFehler(problem.message || 'Das Passwort konnte nicht gespeichert werden.');
      setArbeitet(false);
    }
  };

  return html`
    <${Blatt} titel=${aendern ? 'Backup-Passwort ändern' : 'Backup einrichten'} onSchliessen=${onSchliessen}>
      <form class="formular" onSubmit=${speichern}>
        <p class="text-leise">
          Mit diesem Passwort wird jede Backup-Datei verschlüsselt. Du brauchst es nur,
          wenn du ein Backup wiederherstellst.
        </p>
        <div class="hinweis wichtig">
          <${Icon} name="key-round" />
          <p>Schreib dir das Passwort auf. Ohne Passwort lässt sich kein Backup öffnen, und niemand kann es zurücksetzen.</p>
        </div>
        ${aendern && html`<p class="text-leise">Ältere Backup-Dateien brauchen weiterhin das alte Passwort.</p>`}
        <label class="feld-gruppe">
          <span>Neues Passwort</span>
          <input class="feld" type="password" autocomplete="new-password" value=${eins}
            onInput=${(e) => { setEins(e.target.value); setFehler(''); }} />
        </label>
        <label class="feld-gruppe">
          <span>Passwort wiederholen</span>
          <input class="feld" type="password" autocomplete="new-password" value=${zwei}
            onInput=${(e) => { setZwei(e.target.value); setFehler(''); }} />
        </label>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
        <button class="knopf breit" type="submit" disabled=${arbeitet}>
          ${arbeitet ? 'Schlüssel wird berechnet …' : 'Passwort speichern'}
        </button>
      </form>
    <//>
  `;
}

// ---------- Backup erstellen ----------

function ErstellenBlatt({ onSchliessen }) {
  const brauchtPasswort = backup.brauchtPasswortFuerExport();
  const [datei, setDatei] = useState(null);
  const [fehler, setFehler] = useState('');
  const [passwort, setPasswort] = useState('');
  const [arbeitet, setArbeitet] = useState(false);

  const erstelle = async (pw) => {
    setArbeitet(true);
    setFehler('');
    try {
      setDatei(await backup.erstelleBackup(pw));
    } catch (problem) {
      setFehler(problem.message || 'Das Backup konnte nicht erstellt werden.');
    }
    setArbeitet(false);
  };

  useEffect(() => {
    if (!brauchtPasswort) erstelle();
  }, []);

  const fertig = async () => {
    await backup.markiereGesichert();
    melde('Backup gesichert');
    onSchliessen();
  };

  const teilen = async () => {
    try {
      const ergebnis = await backup.teileBackup(datei);
      if (ergebnis === 'geteilt') await fertig();
    } catch (problem) {
      setFehler('Das Teilen-Menü ließ sich nicht öffnen. Nutze „Herunterladen“.');
    }
  };

  const herunterladen = async () => {
    backup.ladeBackupHerunter(datei);
    await fertig();
  };

  if (!datei) {
    return html`
      <${Blatt} titel="Backup erstellen" onSchliessen=${onSchliessen}>
        ${brauchtPasswort ? html`
          <form class="formular" onSubmit=${(e) => { e.preventDefault(); erstelle(passwort); }}>
            <p class="text-leise">Gib dein Backup-Passwort ein, um die Datei zu verschlüsseln.</p>
            <label class="feld-gruppe">
              <span>Backup-Passwort</span>
              <input class="feld" type="password" autocomplete="current-password" value=${passwort}
                onInput=${(e) => { setPasswort(e.target.value); setFehler(''); }} />
            </label>
            ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
            <button class="knopf breit" type="submit" disabled=${arbeitet}>
              ${arbeitet ? 'Wird verschlüsselt …' : 'Backup erstellen'}
            </button>
          </form>
        ` : html`
          <div class="formular">
            ${fehler
              ? html`<p class="fehlertext" role="alert">${fehler}</p>`
              : html`<p class="text-leise">Deine Daten werden verschlüsselt …</p>`}
          </div>
        `}
      <//>
    `;
  }

  const teilbar = backup.kannTeilen(datei);
  return html`
    <${Blatt} titel="Backup ist bereit" onSchliessen=${onSchliessen}>
      <div class="formular">
        <div class="datei-karte">
          <${Icon} name="file-check" groesse=${28} />
          <div>
            <strong>${datei.name}</strong>
            <span>${groesseLesbar(datei.groesse)}, ${datei.anzahl === 1 ? '1 Eintrag' : `${datei.anzahl} Einträge`}, verschlüsselt</span>
          </div>
        </div>
        ${teilbar && html`
          <p class="text-leise">
            Tippe auf „Datei sichern“ und wähle im Teilen-Menü „In Dateien sichern“. Dort legst du sie in iCloud Drive ab.
          </p>
          <button class="knopf breit" type="button" onClick=${teilen}>
            <${Icon} name="share" /> Datei sichern
          </button>
        `}
        <button class=${`knopf breit ${teilbar ? 'leise' : ''}`} type="button" onClick=${herunterladen}>
          <${Icon} name="download" /> Herunterladen
        </button>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      </div>
    <//>
  `;
}

// ---------- Backup wiederherstellen ----------

function WiederherstellenBlatt({ onSchliessen }) {
  const [umschlag, setUmschlag] = useState(null);
  const [dateiname, setDateiname] = useState('');
  const [passwort, setPasswort] = useState('');
  const [inhalt, setInhalt] = useState(null);
  const [fehler, setFehler] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const eingabe = useRef(null);

  const waehleDatei = async (e) => {
    const datei = e.target.files && e.target.files[0];
    if (!datei) return;
    setFehler('');
    try {
      setUmschlag(await backup.leseBackupDatei(datei));
      setDateiname(datei.name);
    } catch (problem) {
      setFehler(problem.message);
    }
    e.target.value = '';
  };

  const entschluesseln = async (e) => {
    e.preventDefault();
    setArbeitet(true);
    setFehler('');
    try {
      setInhalt(await backup.entschluesseleBackup(umschlag, passwort));
    } catch (problem) {
      setFehler(problem.message || 'Das Backup ließ sich nicht öffnen.');
    }
    setArbeitet(false);
  };

  const ersetzen = async () => {
    setArbeitet(true);
    try {
      await backup.stelleWiederHer(inhalt);
      sicherstelleMerkliste();
      melde('Backup wiederhergestellt');
      onSchliessen();
    } catch (problem) {
      setFehler('Die Daten konnten nicht ersetzt werden. Es wurde nichts verändert.');
      setArbeitet(false);
    }
  };

  // Schritt 1: Datei wählen
  if (!umschlag) {
    return html`
      <${Blatt} titel="Backup wiederherstellen" onSchliessen=${onSchliessen}>
        <div class="formular">
          <p class="text-leise">Wähle eine Backup-Datei des Planners, zum Beispiel aus iCloud Drive.</p>
          <input ref=${eingabe} class="versteckt" type="file" onChange=${waehleDatei} />
          <button class="knopf breit" type="button" onClick=${() => eingabe.current && eingabe.current.click()}>
            <${Icon} name="upload" /> Backup-Datei wählen
          </button>
          ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
        </div>
      <//>
    `;
  }

  // Schritt 2: Passwort eingeben
  if (!inhalt) {
    return html`
      <${Blatt} titel="Backup wiederherstellen" onSchliessen=${onSchliessen}>
        <form class="formular" onSubmit=${entschluesseln}>
          <div class="datei-karte">
            <${Icon} name="file-check" groesse=${28} />
            <div>
              <strong>${dateiname}</strong>
              <span>Erstellt am ${datumMitZeit(umschlag.erstelltAm)}</span>
            </div>
          </div>
          <label class="feld-gruppe">
            <span>Backup-Passwort</span>
            <input class="feld" type="password" autocomplete="current-password" value=${passwort}
              onInput=${(e) => { setPasswort(e.target.value); setFehler(''); }} />
          </label>
          ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
          <button class="knopf breit" type="submit" disabled=${arbeitet || !passwort}>
            ${arbeitet ? 'Wird entschlüsselt …' : 'Backup öffnen'}
          </button>
        </form>
      <//>
    `;
  }

  // Schritt 3: Vorschau und Bestätigung
  const zeilen = Object.entries(inhalt.zaehler);
  return html`
    <${Blatt} titel="Vorschau" onSchliessen=${onSchliessen}>
      <div class="formular">
        <p>Backup vom <strong>${datumMitZeit(inhalt.erstelltAm)}</strong></p>
        ${zeilen.length ? html`
          <ul class="vorschau-liste">
            ${zeilen.map(([typ, anzahl]) => html`
              <li><span>${TYP_NAMEN[typ] || typ}</span><strong>${anzahl}</strong></li>
            `)}
          </ul>
        ` : html`<p class="text-leise">Dieses Backup enthält keine Einträge.</p>`}
        <div class="hinweis wichtig">
          <${Icon} name="triangle-alert" />
          <p>Das Wiederherstellen ersetzt alle Daten, die jetzt in der App sind.</p>
        </div>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
        <button class="knopf breit gefahr" type="button" disabled=${arbeitet} onClick=${ersetzen}>
          ${arbeitet ? 'Daten werden ersetzt …' : 'Daten ersetzen'}
        </button>
        <button class="knopf breit leise" type="button" onClick=${onSchliessen}>Abbrechen</button>
      </div>
    <//>
  `;
}
