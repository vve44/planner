// Bausteine für die PIN: Ziffernfeld, Sperrbildschirm einer Notiz und das Fenster
// zum Festlegen, Ändern und Zurücksetzen der PIN.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { Blatt, melde } from './fenster.js';
import * as pin from '../pin.js';
import * as backup from '../backup.js';

const TASTEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'weg'];

// Vier Punkte und ein eigenes Ziffernfeld (ohne die Tastatur des iPhones).
//   pruefe(pin) – wird mit den vier Ziffern aufgerufen. Gibt true zurück, wenn es weitergeht,
//                 sonst einen Text, der als Fehler erscheint.
export function PinEingabe({ titel, hinweis, pruefe }) {
  const [ziffern, setZiffern] = useState('');
  const [fehler, setFehler] = useState('');
  const [wartet, setWartet] = useState(false);

  const tippe = async (taste) => {
    if (wartet) return;
    if (taste === 'weg') {
      setZiffern(ziffern.slice(0, -1));
      return;
    }
    const neu = (ziffern + taste).slice(0, 4);
    setZiffern(neu);
    setFehler('');
    if (neu.length < 4) return;
    setWartet(true);
    const ergebnis = await pruefe(neu);
    setWartet(false);
    if (ergebnis !== true) {
      setFehler(ergebnis || 'Die PIN stimmt nicht.');
      setZiffern('');
    }
  };

  return html`
    <div class="pin-eingabe">
      <h2>${titel}</h2>
      ${hinweis && html`<p class="text-leise">${hinweis}</p>`}
      <div class=${`pin-punkte ${fehler ? 'falsch' : ''}`} role="status" aria-label=${`${ziffern.length} von 4 Ziffern eingegeben`}>
        ${[0, 1, 2, 3].map((i) => html`<i class=${i < ziffern.length ? 'voll' : ''}></i>`)}
      </div>
      <p class="fehlertext pin-fehler" role="alert">${fehler}</p>
      <div class="pin-tasten">
        ${TASTEN.map((t) => {
          if (!t) return html`<span></span>`;
          if (t === 'weg') {
            return html`
              <button type="button" class="pin-taste leise" aria-label="Letzte Ziffer löschen" disabled=${!ziffern.length} onClick=${() => tippe('weg')}>
                <${Icon} name="delete" groesse=${24} />
              </button>
            `;
          }
          return html`<button type="button" class="pin-taste" onClick=${() => tippe(t)}>${t}</button>`;
        })}
      </div>
    </div>
  `;
}

// Steht anstelle einer gesperrten Notiz, bis die PIN eingegeben ist.
export function PinSperre() {
  const [vergessen, setVergessen] = useState(false);
  return html`
    <div class="seite">
      <section class="pin-sperre">
        <span class="leer-icon"><${Icon} name="lock" groesse=${26} strich=${1.5} /></span>
        <${PinEingabe} titel="PIN eingeben" hinweis="Diese Notiz ist gesperrt."
          pruefe=${async (ziffern) => (await pin.entsperre(ziffern)) || 'Die PIN stimmt nicht.'} />
        <button class="knopf-text" type="button" onClick=${() => setVergessen(true)}>PIN vergessen?</button>
      </section>
      ${vergessen && html`<${PinBlatt} modus="vergessen" onSchliessen=${() => setVergessen(false)} />`}
    </div>
  `;
}

// Fenster für die PIN.
//   modus 'einrichten' – neue PIN festlegen (zweimal eingeben)
//   modus 'aendern'    – erst die bisherige PIN, dann die neue
//   modus 'vergessen'  – erst das Backup-Passwort, dann die neue PIN
//   onFertig           – wird aufgerufen, sobald die neue PIN gilt
export function PinBlatt({ modus, onSchliessen, onFertig }) {
  const [schritt, setSchritt] = useState(modus === 'einrichten' ? 'neu' : modus === 'aendern' ? 'alt' : 'passwort');
  const [erste, setErste] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const [wartet, setWartet] = useState(false);

  const pruefePasswort = async (e) => {
    e.preventDefault();
    if (!passwort || wartet) return;
    setWartet(true);
    const richtig = await backup.pruefePasswort(passwort);
    setWartet(false);
    if (!richtig) {
      setFehler('Das Backup-Passwort stimmt nicht.');
      return;
    }
    setFehler('');
    setSchritt('neu');
  };

  const speichere = async (ziffern) => {
    if (ziffern !== erste) {
      setErste('');
      setFehler('Die beiden Eingaben stimmten nicht überein. Bitte noch einmal.');
      setSchritt('neu');
      return true;
    }
    await pin.setze(ziffern);
    onSchliessen();
    if (onFertig) onFertig();
    else melde(modus === 'einrichten' ? 'PIN festgelegt' : 'Neue PIN gespeichert');
    return true;
  };

  const titel = { einrichten: 'PIN festlegen', aendern: 'PIN ändern', vergessen: 'PIN zurücksetzen' }[modus];

  return html`
    <${Blatt} titel=${titel} onSchliessen=${onSchliessen}>
      <div class="formular">
        ${schritt === 'passwort' && (backup.passwortGesetzt() ? html`
          <form class="formular" onSubmit=${pruefePasswort}>
            <p class="text-leise">Gib dein Backup-Passwort ein. Danach legst du eine neue PIN fest. Deine Notizen bleiben erhalten.</p>
            <label class="feld-gruppe">
              <span>Backup-Passwort</span>
              <input class="feld" type="password" autocomplete="current-password" value=${passwort}
                onInput=${(e) => { setPasswort(e.target.value); setFehler(''); }} />
            </label>
            ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
            <button class="knopf breit" type="submit" disabled=${!passwort || wartet}>${wartet ? 'Prüfe …' : 'Weiter'}</button>
          </form>
        ` : html`
          <p class="text-leise">
            Zum Zurücksetzen brauchst du das Backup-Passwort. Es ist noch keines eingerichtet
            (Übersicht, Einstellungen, Backup).
          </p>
        `)}

        ${schritt === 'alt' && html`
          <${PinEingabe} key="alt" titel="Bisherige PIN"
            pruefe=${async (ziffern) => {
              if (!(await pin.pruefe(ziffern))) return 'Die PIN stimmt nicht.';
              setSchritt('neu');
              return true;
            }} />
        `}

        ${schritt === 'neu' && html`
          ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
          <${PinEingabe} key="neu" titel="Neue PIN" hinweis="Vier Ziffern. Sie gilt für alle Notizen, die du sperrst."
            pruefe=${async (ziffern) => { setErste(ziffern); setFehler(''); setSchritt('wiederholen'); return true; }} />
        `}

        ${schritt === 'wiederholen' && html`
          <${PinEingabe} key="wiederholen" titel="PIN wiederholen" hinweis="Gib die neue PIN zur Sicherheit noch einmal ein." pruefe=${speichere} />
        `}

        ${modus === 'einrichten' && html`
          <p class="feld-hinweis">
            Die PIN ist ein Sichtschutz, keine Verschlüsselung. Vergisst du sie, setzt du sie mit dem
            Backup-Passwort zurück.
          </p>
        `}
      </div>
    <//>
  `;
}
