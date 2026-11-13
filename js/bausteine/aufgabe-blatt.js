// Das Fenster zum Anlegen und Bearbeiten einer Aufgabe.
// Oben das Schnellfenster (Titel, Tag, Dauer, Wiederholung, Unteraufgaben),
// darunter aufklappbar die übrigen Angaben.

import { html, useState, useEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Blatt, melde, waehle } from './fenster.js';
import { Icon } from './icon.js';
import { IconWahl } from './icon-wahl.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import { standardRegel, regelGueltig } from '../regeln.js';
import { heute, plusTage, dauerLesbar } from '../hilfen.js';
import { PRIORITAETEN, WOCHENTAGE, DAUER_VORSCHLAEGE } from '../typen.js';

let setzeOffen = null;

// Öffnet das Aufgaben-Fenster.
//   { id }              – vorhandene Aufgabe bearbeiten
//   { vorgaben: {…} }   – neue Aufgabe, zum Beispiel mit Plandatum oder Liste vorbelegt
export function oeffneAufgabe(was) {
  if (setzeOffen) setzeOffen({ ...was, schluessel: Date.now() });
}

// Wird einmal ganz oben in der App eingehängt.
export function AufgabenFenster() {
  const [offen, setOffen] = useState(null);
  useEffect(() => {
    setzeOffen = setOffen;
    // Wechselt die Seite (zum Beispiel über "Zurück"), schließt sich das Fenster.
    const schliesse = () => setOffen(null);
    window.addEventListener('hashchange', schliesse);
    return () => { setzeOffen = null; window.removeEventListener('hashchange', schliesse); };
  }, []);
  if (!offen) return null;
  return html`<${AufgabeBlatt} key=${offen.schluessel} id=${offen.id} vorgaben=${offen.vorgaben} onSchliessen=${() => setOffen(null)} />`;
}

// ---------- Liste zum Bearbeiten (Unteraufgaben, Checkliste) ----------

// "entwurf" ist der Text im Eingabefeld, der noch nicht hinzugefügt wurde. Er liegt
// beim Fenster, damit er beim Speichern nicht verloren geht.
function PunktListe({ punkte, onAendern, entwurf, onEntwurf, platzhalter }) {
  const hinzu = () => {
    const text = entwurf.trim();
    if (!text) return;
    onAendern([...punkte, aufgaben.neuerPunkt(text)]);
    onEntwurf('');
  };

  return html`
    <ul class="bearbeit-liste">
      ${punkte.map((p) => html`
        <li key=${p.id} class=${p.erledigt ? 'erledigt' : ''}>
          <button class="haken klein" type="button" aria-pressed=${p.erledigt}
            aria-label=${p.erledigt ? 'Wieder öffnen' : 'Abhaken'}
            onClick=${() => onAendern(punkte.map((x) => (x.id === p.id ? { ...x, erledigt: !x.erledigt } : x)))}>
            <span class="haken-kreis">${p.erledigt && html`<${Icon} name="check" groesse=${13} strich=${2.6} />`}</span>
          </button>
          <input class="feld" type="text" value=${p.text} aria-label="Text"
            onInput=${(e) => onAendern(punkte.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))} />
          <button class="knopf-rund" type="button" aria-label=${`„${p.text}“ entfernen`}
            onClick=${() => onAendern(punkte.filter((x) => x.id !== p.id))}>
            <${Icon} name="x" groesse=${18} />
          </button>
        </li>
      `)}
      <li>
        <span class="haken klein" aria-hidden="true"><${Icon} name="plus" groesse=${18} /></span>
        <input class="feld" type="text" value=${entwurf} placeholder=${platzhalter} enterkeyhint="done"
          onInput=${(e) => onEntwurf(e.target.value)}
          onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); hinzu(); } }} />
      </li>
    </ul>
  `;
}

// ---------- Wiederholungsregel ----------

function RegelEditor({ regel, modus, onRegel, onModus }) {
  const schalteTag = (nr) => {
    const hat = regel.wochentage.includes(nr);
    onRegel({ ...regel, wochentage: hat ? regel.wochentage.filter((x) => x !== nr) : [...regel.wochentage, nr] });
  };

  return html`
    <div class="formular">
      <select class="feld" aria-label="Art der Wiederholung" value=${regel.art}
        onChange=${(e) => onRegel({ ...regel, art: e.target.value })}>
        <option value="taeglich">Täglich</option>
        <option value="wochentage">An bestimmten Wochentagen</option>
        <option value="intervall">In festem Abstand</option>
      </select>

      ${regel.art === 'wochentage' && html`
        <div class="chips woche" role="group" aria-label="Wochentage">
          ${WOCHENTAGE.map((w) => html`
            <button type="button" class=${`chip tag ${regel.wochentage.includes(w.nr) ? 'aktiv' : ''}`}
              aria-pressed=${regel.wochentage.includes(w.nr)} aria-label=${w.lang} onClick=${() => schalteTag(w.nr)}>
              ${w.kurz}
            </button>
          `)}
        </div>
      `}

      ${regel.art === 'intervall' && html`
        <div class="zahl-zeile">
          <span>Alle</span>
          <input class="feld" type="number" inputmode="numeric" min="1" max="365" aria-label="Abstand"
            value=${regel.n}
            onInput=${(e) => onRegel({ ...regel, n: parseInt(e.target.value, 10) || 0 })} />
          <select class="feld" aria-label="Einheit" value=${regel.einheit}
            onChange=${(e) => onRegel({ ...regel, einheit: e.target.value })}>
            <option value="tage">Tage</option>
            <option value="wochen">Wochen</option>
            <option value="monate">Monate</option>
          </select>
        </div>
      `}

      <div class="feld-gruppe">
        <div class="wahl" role="group" aria-label="Rhythmus">
          <button type="button" class=${modus === 'fest' ? 'aktiv' : ''} aria-pressed=${modus === 'fest'} onClick=${() => onModus('fest')}>
            Fester Rhythmus
          </button>
          <button type="button" class=${modus === 'abErledigung' ? 'aktiv' : ''} aria-pressed=${modus === 'abErledigung'} onClick=${() => onModus('abErledigung')}>
            Ab Erledigung
          </button>
        </div>
        <p class="feld-hinweis">
          ${modus === 'fest'
            ? 'Die nächste Aufgabe richtet sich nach dem Kalender, egal wann du diese abhakst.'
            : 'Der Abstand zählt ab dem Tag, an dem du die Aufgabe abhakst.'}
        </p>
      </div>
    </div>
  `;
}

// ---------- Das Fenster ----------

function AufgabeBlatt({ id, vorgaben, onSchliessen }) {
  const vorhanden = id ? store.hole(id) : null;
  const serie = vorhanden ? aufgaben.serieVon(vorhanden) : null;
  const start = vorhanden || aufgaben.leereAufgabe(vorgaben);

  const [f, setF] = useState(() => ({
    titel: start.titel,
    dauerMin: start.dauerMin,
    plandatum: start.plandatum,
    deadline: start.deadline,
    prioritaet: start.prioritaet,
    kategorieId: start.kategorieId,
    projektId: start.projektId,
    icon: start.icon,
    notiz: start.notiz,
    checkliste: start.checkliste,
    unteraufgaben: start.unteraufgaben,
  }));
  const setze = (teil) => { setF((alt) => ({ ...alt, ...teil })); setFehler(''); };

  const [wiederholt, setWiederholt] = useState(Boolean(serie));
  const [regel, setRegel] = useState(() => (serie ? { ...standardRegel(start.plandatum), ...serie.regel } : standardRegel(start.plandatum)));
  const [modus, setModus] = useState(serie ? serie.modus : 'fest');
  const [andereDauer, setAndereDauer] = useState(Boolean(start.dauerMin) && !DAUER_VORSCHLAEGE.includes(start.dauerMin));
  const [mehr, setMehr] = useState(Boolean(vorhanden) && Boolean(
    start.deadline || start.prioritaet || start.kategorieId || start.projektId || start.icon || start.notiz || start.checkliste.length
  ));
  const [fehler, setFehler] = useState('');
  const [unterEntwurf, setUnterEntwurf] = useState('');
  const [checkEntwurf, setCheckEntwurf] = useState('');
  const titelFeld = useRef(null);

  useEffect(() => {
    if (!vorhanden && titelFeld.current) titelFeld.current.focus();
  }, []);

  const morgen = plusTage(heute(), 1);
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);
  const merkliste = aufgaben.merkliste();
  const listen = aufgaben.projekte();
  const gewaehlteListe = f.projektId ? store.hole(f.projektId) : null;
  const listenKategorie = gewaehlteListe && gewaehlteListe.kategorieId ? store.hole(gewaehlteListe.kategorieId) : null;

  const speichern = (e) => {
    if (e) e.preventDefault();
    const titel = f.titel.trim();
    if (!titel) {
      setFehler('Gib der Aufgabe einen Titel.');
      if (titelFeld.current) titelFeld.current.focus();
      return;
    }
    if (wiederholt && !regelGueltig(regel)) {
      setFehler(regel.art === 'wochentage' ? 'Wähle mindestens einen Wochentag für die Wiederholung.' : 'Der Abstand der Wiederholung muss mindestens 1 sein.');
      return;
    }
    // Auch was noch im Eingabefeld steht, wird übernommen.
    const sauber = (punkte, entwurf) => [...punkte, aufgaben.neuerPunkt(entwurf)]
      .map((p) => ({ ...p, text: p.text.trim() }))
      .filter((p) => p.text);
    const felder = {
      ...f,
      titel,
      // Eine Wiederholung braucht einen Starttag.
      plandatum: f.plandatum || (wiederholt ? heute() : null),
      notiz: f.notiz.trim(),
      checkliste: sauber(f.checkliste, checkEntwurf),
      unteraufgaben: sauber(f.unteraufgaben, unterEntwurf),
    };
    if (vorhanden) {
      aufgaben.aendereAufgabe(vorhanden.id, felder, wiederholt ? { regel, modus } : serie ? null : undefined);
    } else {
      aufgaben.neueAufgabe(felder, wiederholt ? { regel, modus } : null);
    }
    onSchliessen();
  };

  const aufMorgen = () => {
    const zurueck = aufgaben.verschiebeAufMorgen(vorhanden.id);
    onSchliessen();
    melde('Auf morgen verschoben', { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  const loeschen = async () => {
    let wahl = 'weiter';
    if (serie && !vorhanden.erledigtAm) {
      wahl = await waehle({
        titel: 'Wiederkehrende Aufgabe löschen',
        text: 'Soll nur diese eine Aufgabe entfallen, oder soll die ganze Wiederholung enden?',
        optionen: [
          { wert: 'weiter', name: 'Nur diese Aufgabe' },
          { wert: 'beenden', name: 'Ganze Wiederholung beenden', art: 'gefahr' },
        ],
      });
      if (!wahl) return;
    }
    const zurueck = aufgaben.loescheAufgabe(vorhanden.id, { serie: wahl });
    onSchliessen();
    melde(`„${vorhanden.titel}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  const fuss = html`
    <button class="knopf breit" type="button" onClick=${speichern}>
      ${vorhanden ? 'Änderungen speichern' : 'Aufgabe anlegen'}
    </button>
  `;

  return html`
    <${Blatt} titel=${vorhanden ? 'Aufgabe' : 'Neue Aufgabe'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <form class="formular" onSubmit=${speichern}>
        <input ref=${titelFeld} class="feld gross" type="text" maxlength="200" enterkeyhint="done"
          aria-label="Titel" placeholder="Was steht an?" value=${f.titel}
          onInput=${(e) => setze({ titel: e.target.value })} />
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <fieldset class="feld-gruppe">
          <legend>Geplant für</legend>
          <div class="chips">
            <button type="button" class=${`chip ${f.plandatum === heute() ? 'aktiv' : ''}`} onClick=${() => setze({ plandatum: heute() })}>Heute</button>
            <button type="button" class=${`chip ${f.plandatum === morgen ? 'aktiv' : ''}`} onClick=${() => setze({ plandatum: morgen })}>Morgen</button>
            <button type="button" class=${`chip ${!f.plandatum ? 'aktiv' : ''}`} onClick=${() => setze({ plandatum: null })}>Ohne Datum</button>
          </div>
          <input class="feld" type="date" aria-label="Anderes Datum" value=${f.plandatum || ''}
            onInput=${(e) => setze({ plandatum: e.target.value || null })} />
        </fieldset>

        <fieldset class="feld-gruppe">
          <legend>Dauer</legend>
          <div class="chips">
            <button type="button" class=${`chip ${!f.dauerMin && !andereDauer ? 'aktiv' : ''}`}
              onClick=${() => { setAndereDauer(false); setze({ dauerMin: null }); }}>Keine</button>
            ${DAUER_VORSCHLAEGE.map((m) => html`
              <button type="button" class=${`chip ${f.dauerMin === m && !andereDauer ? 'aktiv' : ''}`}
                onClick=${() => { setAndereDauer(false); setze({ dauerMin: m }); }}>${dauerLesbar(m)}</button>
            `)}
            <button type="button" class=${`chip ${andereDauer ? 'aktiv' : ''}`} onClick=${() => setAndereDauer(true)}>Andere</button>
          </div>
          ${andereDauer && html`
            <div class="zahl-zeile">
              <input class="feld" type="number" inputmode="numeric" min="1" max="1440" aria-label="Dauer in Minuten"
                value=${f.dauerMin || ''}
                onInput=${(e) => setze({ dauerMin: Math.min(1440, parseInt(e.target.value, 10) || 0) || null })} />
              <span>Minuten</span>
            </div>
          `}
        </fieldset>

        <div class="feld-gruppe">
          <div class="schalter-zeile">
            <span id="wdh-name">Wiederholen</span>
            <button type="button" class="schalter" role="switch" aria-checked=${wiederholt} aria-labelledby="wdh-name"
              onClick=${() => { setWiederholt(!wiederholt); setFehler(''); }}></button>
          </div>
          ${wiederholt && html`
            <${RegelEditor} regel=${regel} modus=${modus}
              onRegel=${(r) => { setRegel(r); setFehler(''); }} onModus=${setModus} />
          `}
        </div>

        <fieldset class="feld-gruppe">
          <legend>Unteraufgaben</legend>
          <${PunktListe} punkte=${f.unteraufgaben} platzhalter="Unteraufgabe hinzufügen"
            entwurf=${unterEntwurf} onEntwurf=${setUnterEntwurf}
            onAendern=${(liste) => setze({ unteraufgaben: liste })} />
        </fieldset>

        <button class="knopf-text" type="button" aria-expanded=${mehr} onClick=${() => setMehr(!mehr)}>
          <${Icon} name=${mehr ? 'chevron-up' : 'chevron-down'} groesse=${18} />
          ${mehr ? 'Weniger Angaben' : 'Mehr Angaben'}
        </button>

        ${mehr && html`
          <div class="feld-gruppe">
            <span id="deadline-name">Deadline</span>
            <input class="feld" type="date" aria-labelledby="deadline-name" value=${f.deadline || ''}
              onInput=${(e) => setze({ deadline: e.target.value || null })} />
            ${f.deadline && html`
              <button class="knopf-text" type="button" onClick=${() => setze({ deadline: null })}>Deadline entfernen</button>
            `}
          </div>

          <fieldset class="feld-gruppe">
            <legend>Priorität</legend>
            <div class="wahl">
              ${PRIORITAETEN.map((p) => html`
                <button type="button" class=${f.prioritaet === p.wert ? 'aktiv' : ''} aria-pressed=${f.prioritaet === p.wert}
                  onClick=${() => setze({ prioritaet: p.wert })}>${p.name}</button>
              `)}
            </div>
          </fieldset>

          <label class="feld-gruppe">
            <span>Projekt oder Liste</span>
            <select class="feld" value=${f.projektId || ''} onChange=${(e) => setze({ projektId: e.target.value || null })}>
              <option value="">Keine Liste</option>
              ${merkliste && html`<option value=${merkliste.id}>Merkliste</option>`}
              ${listen.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
            </select>
          </label>

          <label class="feld-gruppe">
            <span>Kategorie</span>
            <select class="feld" value=${f.kategorieId || ''} onChange=${(e) => setze({ kategorieId: e.target.value || null })}>
              <option value="">${listenKategorie ? `Wie die Liste: ${listenKategorie.name}` : 'Keine Kategorie'}</option>
              ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
            </select>
          </label>

          <fieldset class="feld-gruppe">
            <legend>Icon</legend>
            <${IconWahl} wert=${f.icon} ohneErlaubt=${true} onWahl=${(icon) => setze({ icon })} />
          </fieldset>

          <label class="feld-gruppe">
            <span>Notiz</span>
            <textarea class="feld" rows="3" value=${f.notiz} onInput=${(e) => setze({ notiz: e.target.value })}></textarea>
          </label>

          <fieldset class="feld-gruppe">
            <legend>Checkliste</legend>
            <${PunktListe} punkte=${f.checkliste} platzhalter="Punkt hinzufügen"
              entwurf=${checkEntwurf} onEntwurf=${setCheckEntwurf}
              onAendern=${(liste) => setze({ checkliste: liste })} />
          </fieldset>
        `}

        ${vorhanden && html`
          <div class="knopf-reihe">
            ${!vorhanden.erledigtAm && html`
              <button class="knopf leise" type="button" onClick=${aufMorgen}>
                <${Icon} name="sunrise" groesse=${20} /> Auf morgen
              </button>
            `}
            <button class="knopf leise gefahr-text" type="button" onClick=${loeschen}>
              <${Icon} name="trash-2" groesse=${20} /> Löschen
            </button>
          </div>
        `}
      </form>
    <//>
  `;
}
