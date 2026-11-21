// Zyklus: Periodenbeginn und -ende eintragen, geschätzte Phase und Zyklustag sehen.
// Dazu die Karte für den Tagesbereich.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, oeffneBlatt } from '../bausteine/fenster.js';
import { loeschePeriode } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as zyklus from '../zyklus.js';
import { heute, tageZwischen, spanneLesbar, datumKurz, datumAusText, tagLesbar } from '../hilfen.js';

const HINWEIS = 'Die Phase ist eine grobe Schätzung aus deinen Einträgen. Sie eignet sich nicht zur Verhütung und nicht für medizinische Entscheidungen. Deine Angaben bleiben auf diesem Gerät.';

function leseLaenge(text) {
  const zahl = parseInt(text, 10);
  return Number.isFinite(zahl) && zahl >= zyklus.LAENGE_MIN && zahl <= zyklus.LAENGE_MAX ? zahl : null;
}

// Balken mit den vier Phasen und einer Marke für heute.
function PhasenBalken({ st }) {
  const tage = zyklus.phasenTage(st);
  if (!tage) return null;
  const stelle = Math.min(100, ((st.zyklustag - 0.5) / tage.laenge) * 100);
  return html`
    <div class="phasen" aria-hidden="true">
      <div class="phasen-balken">
        ${zyklus.PHASEN.map((p) => tage[p.wert] > 0 && html`<i class=${`phase-${p.wert}`} style=${`flex:${tage[p.wert]}`}></i>`)}
        <b style=${`left:${stelle}%`}></b>
      </div>
      <div class="phasen-namen">
        ${zyklus.PHASEN.map((p) => html`<span class=${st.phase === p.wert ? 'aktiv' : ''}><i class=${`phase-${p.wert}`}></i>${p.name}</span>`)}
      </div>
    </div>
  `;
}

// Überschrift und Text zum heutigen Stand.
function standText(st) {
  if (st.veraltet) {
    return {
      titel: 'Keine aktuelle Schätzung',
      text: `Der letzte eingetragene Periodenbeginn liegt ${st.zyklustag - 1} Tage zurück. Trag deine letzte Periode ein, dann schätzt die App wieder.`,
    };
  }
  if (st.brauchtLaenge) {
    return { titel: `Zyklustag ${st.zyklustag}`, text: 'Für die Phase fehlt noch deine übliche Zykluslänge.' };
  }
  return { titel: zyklus.phaseName(st.phase), text: zyklus.phasenText(st.phase) };
}

// ---------- Karte im Tagesbereich ----------

export function ZyklusHeute({ tag, kopfLang = null }) {
  if (!zyklus.imTagesbereich()) return null;
  const st = zyklus.stand(tag);
  if (!st || st.veraltet) return null;
  const { titel, text } = standText(st);
  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
        <h2>Zyklus</h2>
        <span class="kopf-rechts">
          ${!st.brauchtLaenge && html`<span>Tag ${st.zyklustag}</span>`}
          <button class="knopf-text" type="button" onClick=${() => geheZu('zyklus')}>Öffnen</button>
        </span>
      </div>
      <div class="karte hinweis-karte">
        <span class="karte-icon"><${Icon} name="droplet" /></span>
        <div>
          <h2>${titel}</h2>
          <p>${text}</p>
        </div>
      </div>
    </section>
  `;
}

// ---------- Seite ----------

export function Zyklus() {
  useDaten();
  const [fenster, setFenster] = useState(null); // null | { neu: true } | { id, beenden }
  const [texteOffen, setTexteOffen] = useState(false);
  const [laengeText, setLaengeText] = useState(String(store.einstellung('zyklus.laenge', '') || ''));
  const [laengeFehler, setLaengeFehler] = useState('');
  const tag = heute();
  const alle = zyklus.perioden();
  const st = zyklus.stand(tag);
  const laufende = zyklus.laufende();
  const laenge = zyklus.zykluslaenge();
  const dauer = zyklus.periodenDauer();

  const speichereLaenge = (e) => {
    if (e) e.preventDefault();
    if (!laengeText.trim()) {
      store.setzeEinstellung('zyklus.laenge', null);
      setLaengeFehler('');
      return true;
    }
    const zahl = leseLaenge(laengeText);
    if (!zahl) {
      setLaengeFehler(`Gib eine Zahl zwischen ${zyklus.LAENGE_MIN} und ${zyklus.LAENGE_MAX} ein.`);
      return false;
    }
    store.setzeEinstellung('zyklus.laenge', zahl);
    setLaengeFehler('');
    melde('Übliche Zykluslänge gespeichert');
    return true;
  };

  const laengenFeld = html`
    <form class="feld-gruppe" onSubmit=${speichereLaenge}>
      <label for="zyklus-laenge">Übliche Zykluslänge in Tagen</label>
      <div class="schnell-eingabe">
        <input id="zyklus-laenge" class="feld" type="text" inputmode="numeric" enterkeyhint="done" placeholder="zum Beispiel 28"
          value=${laengeText} onInput=${(e) => { setLaengeText(e.target.value); setLaengeFehler(''); }} />
        <button class="knopf" type="submit" aria-label="Zykluslänge speichern"><${Icon} name="check" /></button>
      </div>
      ${laengeFehler && html`<p class="fehlertext" role="alert">${laengeFehler}</p>`}
      <p class="feld-hinweis">
        Vom ersten Tag einer Periode bis zum Tag vor der nächsten. Die App rechnet damit, bis sie
        aus zwei eingetragenen Perioden deinen eigenen Durchschnitt kennt.
      </p>
    </form>
  `;

  if (!alle.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="droplet" groesse=${28} strich=${1.4} /></span>
          <h2>Zyklus</h2>
          <p class="text-leise">
            Du trägst nur ein, wann deine Periode beginnt und endet. Daraus schätzt die App den Zyklustag
            und die Phase und zeigt beides im Tagesbereich, mit einem kurzen Hinweis zur Phase.
          </p>
          <button class="knopf" type="button" onClick=${() => setFenster({ neu: true })}>
            <${Icon} name="plus" /> Periodenbeginn eintragen
          </button>
        </section>
        <section class="abschnitt">${laengenFeld}</section>
        <p class="text-leise zyklus-hinweis">${HINWEIS}</p>
        ${fenster && html`<${PeriodeBlatt} offen=${fenster} onSchliessen=${() => setFenster(null)} />`}
      </div>
    `;
  }

  const { titel, text } = standText(st);

  return html`
    <div class="seite">
      <section class="karte zyklus-stand">
        ${!st.veraltet && !st.brauchtLaenge && html`<p class="zyklus-tag">Zyklustag ${st.zyklustag}${st.laenge ? ` von etwa ${st.laenge.tage}` : ''}</p>`}
        <h2>${titel}</h2>
        <p>${text}</p>
        ${!st.veraltet && html`<${PhasenBalken} st=${st} />`}
        ${st.endeFehlt && html`<p class="zyklus-merk"><${Icon} name="circle-alert" groesse=${16} /> Das Ende der laufenden Periode ist noch nicht eingetragen.</p>`}
        ${st.laengerAlsUeblich && html`<p class="zyklus-merk"><${Icon} name="circle-alert" groesse=${16} /> Dieser Zyklus dauert schon länger als deine übliche Länge von ${st.laenge.tage} Tagen.</p>`}
      </section>

      <div class="knopf-stapel">
        ${laufende ? html`
          <button class="knopf breit" type="button" onClick=${() => setFenster({ id: laufende.id, beenden: true })}>
            <${Icon} name="check" groesse=${20} /> Periodenende eintragen
          </button>
        ` : html`
          <button class="knopf breit" type="button" onClick=${() => setFenster({ neu: true })}>
            <${Icon} name="plus" groesse=${20} /> Periodenbeginn eintragen
          </button>
        `}
      </div>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Kennzahlen</h2></div>
        <dl class="zahlen-raster">
          <div>
            <dt>${laenge && laenge.quelle === 'daten' ? `Zykluslänge, Schnitt aus ${laenge.anzahl === 1 ? 'einem Zyklus' : `${laenge.anzahl} Zyklen`}` : 'Zykluslänge, deine Angabe'}</dt>
            <dd>${laenge ? `${laenge.tage} Tage` : 'Noch offen'}</dd>
          </div>
          <div>
            <dt>Dauer der Periode im Schnitt</dt>
            <dd>${dauer ? `${dauer} ${dauer === 1 ? 'Tag' : 'Tage'}` : 'Noch offen'}</dd>
          </div>
        </dl>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Perioden</h2><span>${alle.length}</span></div>
        <ul class="gruppe">
          ${[...alle].reverse().map((p, i, liste) => {
            const naechste = liste[i - 1];
            const teile = [];
            if (p.ende) teile.push(`${tageZwischen(p.beginn, p.ende) + 1} Tage`);
            else teile.push('Läuft noch');
            if (naechste) teile.push(`Zyklus ${tageZwischen(p.beginn, naechste.beginn)} Tage`);
            return html`
              <li class="zeile" key=${p.id} data-lang=${`periode:${p.id}`}>
                <button class="zeile-haupt" type="button" onClick=${() => setFenster({ id: p.id })}>
                  <span class="listen-icon"><${Icon} name="droplet" groesse=${20} /></span>
                  <span class="zeile-text">
                    <strong>${p.ende && p.ende !== p.beginn ? spanneLesbar(p.beginn, p.ende) : p.ende ? datumKurz(datumAusText(p.beginn)) : `Seit ${tagLesbar(p.beginn).replace('Heute', 'heute').replace('Gestern', 'gestern')}`}</strong>
                    <span>${teile.join(', ')}</span>
                  </span>
                  <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
                </button>
              </li>
            `;
          })}
        </ul>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Einstellungen</h2></div>
        ${laengenFeld}
        <div class="feld-gruppe">
          <div class="schalter-zeile">
            <span id="zyklus-heute">Phase im Tagesbereich zeigen</span>
            <button type="button" class="schalter" role="switch" aria-checked=${zyklus.imTagesbereich()} aria-labelledby="zyklus-heute"
              onClick=${() => store.setzeEinstellung('zyklus.imTagesbereich', !zyklus.imTagesbereich())}></button>
          </div>
        </div>
        <button class="knopf leise breit" type="button" onClick=${() => setTexteOffen(true)}>
          <${Icon} name="pencil" groesse=${20} /> Texte zu den Phasen anpassen
        </button>
      </section>

      <p class="text-leise zyklus-hinweis">${HINWEIS}</p>

      ${fenster && html`<${PeriodeBlatt} offen=${fenster} onSchliessen=${() => setFenster(null)} />`}
      ${texteOffen && html`<${TexteBlatt} onSchliessen=${() => setTexteOffen(false)} />`}
    </div>
  `;
}

// ---------- Periode eintragen und ändern ----------

registriere('periode', { bearbeiten: (p) => oeffneBlatt((zu) => html`<${PeriodeBlatt} offen=${{ id: p.id }} onSchliessen=${zu} />`) });

function PeriodeBlatt({ offen, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const tag = heute();
  const [beginn, setBeginn] = useState(vorhanden ? vorhanden.beginn : tag);
  const [ende, setEnde] = useState(vorhanden ? vorhanden.ende || (offen.beenden ? tag : '') : '');
  const [fehler, setFehler] = useState('');

  const speichern = () => {
    const meldung = zyklus.pruefe(beginn, ende || null, vorhanden ? vorhanden.id : null);
    if (meldung) {
      setFehler(meldung);
      return;
    }
    if (vorhanden) store.aendern(vorhanden.id, { beginn, ende: ende || null });
    else store.anlegen('periode', { beginn, ende: ende || null });
    onSchliessen();
  };

  const loeschen = async () => {
    if (await loeschePeriode(vorhanden)) onSchliessen();
  };

  const titel = !vorhanden ? 'Periode eintragen' : offen.beenden ? 'Periodenende eintragen' : 'Periode ändern';
  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Speichern' : 'Eintragen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${titel} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <label class="feld-gruppe">
          <span>Erster Tag</span>
          <input class="feld" type="date" max=${tag} value=${beginn} onInput=${(e) => { setBeginn(e.target.value); setFehler(''); }} />
        </label>
        <label class="feld-gruppe">
          <span>Letzter Tag</span>
          <input class="feld" type="date" max=${tag} value=${ende} onInput=${(e) => { setEnde(e.target.value); setFehler(''); }} />
        </label>
        <p class="feld-hinweis">Läuft die Periode noch, lass den letzten Tag frei und trag ihn später nach.</p>
        ${ende && html`<button class="knopf-text" type="button" onClick=${() => { setEnde(''); setFehler(''); }}>Letzten Tag leeren</button>`}
        ${vorhanden && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Eintrag löschen
          </button>
        `}
      </div>
    <//>
  `;
}

// ---------- Texte zu den Phasen ----------

function TexteBlatt({ onSchliessen }) {
  const [texte, setTexte] = useState(() => Object.fromEntries(zyklus.PHASEN.map((p) => [p.wert, zyklus.phasenText(p.wert)])));

  const speichern = () => {
    // Gespeichert wird nur, was vom mitgelieferten Text abweicht.
    const eigene = {};
    zyklus.PHASEN.forEach((p) => {
      const text = texte[p.wert].trim();
      if (text && text !== p.text) eigene[p.wert] = text;
    });
    store.setzeEinstellung('zyklus.texte', Object.keys(eigene).length ? eigene : null);
    onSchliessen();
    melde('Texte gespeichert');
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${speichern}>Texte speichern</button>`;

  return html`
    <${Blatt} titel="Texte zu den Phasen" onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <p class="text-leise">Die Texte sind allgemein gehalten. Schreib sie so um, wie es für dich passt.</p>
        ${zyklus.PHASEN.map((p) => html`
          <label class="feld-gruppe" key=${p.wert}>
            <span>${p.name}</span>
            <textarea class="feld" rows="4" value=${texte[p.wert]} onInput=${(e) => setTexte({ ...texte, [p.wert]: e.target.value })}></textarea>
          </label>
        `)}
        <button class="knopf-text" type="button"
          onClick=${() => setTexte(Object.fromEntries(zyklus.PHASEN.map((p) => [p.wert, p.text])))}>
          Mitgelieferte Texte wiederherstellen
        </button>
      </div>
    <//>
  `;
}
