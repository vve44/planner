// Notizbereich: Notizen nach Kategorie, Unternotizen, Textnotizen mit Blöcken
// (Text, Checkliste, Tabelle), Messwert-Tracker mit Verlaufskurve, Sperren mit PIN.

import { html, useState, useEffect, useLayoutEffect, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, frage, waehle, oeffneBlatt } from '../bausteine/fenster.js';
import { loescheNotiz, loescheMesswert } from '../bausteine/loeschen.js';
import { registriere } from '../bausteine/lang-druck.js';
import { PunktListe } from '../bausteine/felder.js';
import { TextAnsicht, formatiere, setzeListeFort } from '../bausteine/notiz-text.js';
import { PinSperre, PinBlatt } from '../bausteine/pin-teile.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as notizen from '../notizen.js';
import * as pin from '../pin.js';
import { neuerPunkt } from '../aufgaben.js';
import { heute, plusTage, datumAusText, datumKurz, datumMitZeit, tagLesbar, tageZwischen } from '../hilfen.js';

// Eine frisch angelegte Textnotiz öffnet sich gleich zum Schreiben.
let frischAngelegt = null;

function kategorien() {
  return store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);
}

function unterzeile(notiz) {
  const kinder = notizen.kinderVon(notiz).length;
  const zusatz = kinder ? `${kinder} ${kinder === 1 ? 'Unternotiz' : 'Unternotizen'}` : '';
  if (notizen.istGesperrt(notiz)) return ['Gesperrt', zusatz].filter(Boolean).join(', ');
  if (notiz.art === 'tracker') {
    const letzter = notizen.letzterWert(notiz);
    const stand = letzter
      ? `${notizen.zahlText(letzter.wert)}${notiz.einheit ? ` ${notiz.einheit}` : ''} (${tagLesbar(letzter.datum)})`
      : 'Noch keine Werte';
    return ['Messwerte', stand, zusatz].filter(Boolean).join(', ');
  }
  return [notizen.auszug(notiz) || 'Leer', zusatz].filter(Boolean).join(', ');
}

function NotizZeile({ notiz }) {
  const gesperrt = notizen.istGesperrt(notiz);
  return html`
    <li class="zeile" data-lang=${`notiz:${notiz.id}`}>
      <button class="zeile-haupt" type="button" onClick=${() => geheZu(`notiz/${notiz.id}`)}>
        <span class="listen-icon"><${Icon} name=${gesperrt ? 'lock' : notiz.art === 'tracker' ? 'chart-line' : 'file-text'} groesse=${20} /></span>
        <span class="zeile-text">
          <strong>${notiz.titel}</strong>
          <span class="einzeilig">${unterzeile(notiz)}</span>
        </span>
        <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
      </button>
    </li>
  `;
}

// ---------- Alle Notizen ----------

export function Notizen() {
  useDaten();
  const [neu, setNeu] = useState(null); // null | { art }
  const liste = notizen.oberste();
  const alleKategorien = kategorien();
  const gruppen = [
    ...alleKategorien.map((k) => ({ kategorie: k, liste: liste.filter((n) => n.kategorieId === k.id) })),
    { kategorie: null, liste: liste.filter((n) => !alleKategorien.some((k) => k.id === n.kategorieId)) },
  ].filter((g) => g.liste.length);

  const waehleArt = async () => {
    const art = await waehle({
      titel: 'Was möchtest du anlegen?',
      optionen: [
        { wert: 'text', name: 'Notiz' },
        { wert: 'tracker', name: 'Messwert-Tracker' },
      ],
    });
    if (art) setNeu({ art });
  };

  return html`
    <div class="seite">
      ${!liste.length && html`
        <section class="leer">
          <span class="leer-icon"><${Icon} name="notebook-pen" groesse=${28} strich=${1.4} /></span>
          <h2>Noch keine Notiz</h2>
          <p class="text-leise">
            Notizen enthalten Text, Checklisten und Tabellen. Ein Messwert-Tracker sammelt Zahlen mit Datum
            und zeigt ihren Verlauf, zum Beispiel dein Gewicht. Beides lässt sich mit einer PIN sperren.
          </p>
          <div class="knopf-stapel">
            <button class="knopf" type="button" onClick=${() => setNeu({ art: 'text' })}><${Icon} name="plus" /> Notiz anlegen</button>
            <button class="knopf leise" type="button" onClick=${() => setNeu({ art: 'tracker' })}><${Icon} name="chart-line" groesse=${20} /> Messwert-Tracker anlegen</button>
          </div>
        </section>
      `}

      ${gruppen.map((g) => html`
        <section class="abschnitt" key=${g.kategorie ? g.kategorie.id : 'ohne'}>
          <div class="abschnitt-kopf">
            <h2>
              ${g.kategorie && html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${g.kategorie.farbe}`}></i>`}
              ${g.kategorie ? g.kategorie.name : 'Ohne Kategorie'}
            </h2>
            <span>${g.liste.length}</span>
          </div>
          <ul class="gruppe">
            ${g.liste.map((n) => html`<${NotizZeile} key=${n.id} notiz=${n} />`)}
          </ul>
        </section>
      `)}

      ${liste.length > 0 && html`
        <button class="knopf-plus" type="button" aria-label="Notiz oder Tracker anlegen" onClick=${waehleArt}>
          <${Icon} name="plus" groesse=${26} />
        </button>
      `}
      ${neu && html`<${NotizNeuBlatt} art=${neu.art} onSchliessen=${() => setNeu(null)} />`}
    </div>
  `;
}

// Fenster zum Anlegen einer Notiz oder eines Trackers und zum Ändern der Angaben eines Trackers.
// Langes Drücken: „Bearbeiten“ ändert Titel und Kategorie, bei Messwerten den Eintrag.
registriere('notiz', { bearbeiten: (n) => oeffneBlatt((zu) => html`<${NotizNeuBlatt} art=${n.art} vorhanden=${n} onSchliessen=${zu} />`) });
registriere('messwert', {
  bearbeiten: (m) => oeffneBlatt((zu) => html`<${MesswertBlatt} notiz=${store.hole(m.notizId)} messwert=${m} onSchliessen=${zu} />`),
});

function NotizNeuBlatt({ art, eltern = null, vorhanden = null, onSchliessen }) {
  const [titel, setTitel] = useState(vorhanden ? vorhanden.titel : '');
  const [kategorieId, setKategorieId] = useState(vorhanden ? vorhanden.kategorieId : null);
  const [einheit, setEinheit] = useState(vorhanden ? vorhanden.einheit : '');
  const [fehler, setFehler] = useState('');
  const feld = useRef(null);
  const tracker = art === 'tracker';
  const mitKategorie = !eltern && !(vorhanden && notizen.elternVon(vorhanden));

  useEffect(() => {
    if (!vorhanden && feld.current) feld.current.focus();
  }, []);

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler(tracker ? 'Gib dem Tracker einen Namen.' : 'Gib der Notiz einen Titel.');
      return;
    }
    if (vorhanden) {
      store.aendern(vorhanden.id, { titel: sauber, einheit: einheit.trim(), kategorieId: mitKategorie ? kategorieId : null });
      onSchliessen();
      return;
    }
    const neu = notizen.neu({ art, titel: sauber, kategorieId, elternId: eltern ? eltern.id : null, einheit: einheit.trim() });
    if (!tracker) frischAngelegt = neu.id;
    onSchliessen();
    geheZu(`notiz/${neu.id}`);
  };

  const ueberschrift = vorhanden ? (tracker ? 'Tracker bearbeiten' : 'Notiz bearbeiten') : tracker ? 'Neuer Messwert-Tracker' : eltern ? 'Neue Unternotiz' : 'Neue Notiz';
  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Anlegen'}</button>
    </div>
  `;

  return html`
    <${Blatt} titel=${ueberschrift} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input ref=${feld} class="feld gross" type="text" maxlength="100" enterkeyhint="done"
            aria-label=${tracker ? 'Name des Trackers' : 'Titel der Notiz'}
            placeholder=${tracker ? 'zum Beispiel Gewicht' : 'Titel'} value=${titel}
            onInput=${(e) => { setTitel(e.target.value); setFehler(''); }} />
        </form>
        ${tracker && html`
          <label class="feld-gruppe">
            <span>Einheit</span>
            <input class="feld" type="text" maxlength="12" placeholder="zum Beispiel kg" value=${einheit} onInput=${(e) => setEinheit(e.target.value)} />
          </label>
        `}
        ${mitKategorie && html`
          <label class="feld-gruppe">
            <span>Kategorie</span>
            <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
              <option value="">Keine Kategorie</option>
              ${kategorien().map((k) => html`<option value=${k.id}>${k.name}</option>`)}
            </select>
          </label>
        `}
        ${eltern && html`<p class="feld-hinweis">Gehört zu „${eltern.titel}“.</p>`}
      </div>
    <//>
  `;
}

// ---------- Eine Notiz ----------

export function Notiz({ teil }) {
  useDaten();
  const notiz = teil ? store.hole(teil) : null;
  if (!notiz || notiz.geloeschtAm || notiz.typ !== 'notiz') {
    return html`
      <div class="seite">
        <section class="leer">
          <h2>Diese Notiz gibt es nicht mehr</h2>
          <button class="knopf" type="button" onClick=${() => geheZu('notizen')}>Zu den Notizen</button>
        </section>
      </div>
    `;
  }
  if (notizen.istGesperrt(notiz) && !pin.istEntsperrt()) return html`<${PinSperre} key=${notiz.id} />`;
  if (notiz.art === 'tracker') return html`<${Tracker} key=${notiz.id} notiz=${notiz} />`;
  return html`<${TextNotiz} key=${notiz.id} notiz=${notiz} />`;
}

function Angaben({ notiz, zusatz }) {
  const kategorie = notizen.kategorieVon(notiz);
  const eltern = notizen.elternVon(notiz);
  const teile = [];
  if (eltern) teile.push(`In „${eltern.titel}“`);
  else if (kategorie) teile.push(kategorie.name);
  if (zusatz) teile.push(zusatz);
  return html`
    <p class="text-leise">
      ${kategorie && html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${kategorie.farbe}`}></i>`}
      ${teile.join(', ')}
    </p>
  `;
}

function TextNotiz({ notiz }) {
  const [bearbeiten, setBearbeiten] = useState(() => {
    const neu = frischAngelegt === notiz.id;
    if (neu) frischAngelegt = null;
    return neu;
  });

  if (bearbeiten) return html`<${Editor} notiz=${notiz} onFertig=${() => setBearbeiten(false)} />`;

  const schaltePunkt = (blockId, punktId) => {
    store.aendern(notiz.id, {
      bloecke: notiz.bloecke.map((b) => (b.id !== blockId ? b
        : { ...b, punkte: b.punkte.map((p) => (p.id === punktId ? { ...p, erledigt: !p.erledigt } : p)) })),
    });
  };

  return html`
    <div class="seite">
      <div class="leiste">
        <${Angaben} notiz=${notiz} zusatz=${`geändert ${datumMitZeit(notiz.geaendertAm)}`} />
        <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
      </div>

      ${notizen.istLeer(notiz) ? html`
        <div class="gruppe"><p class="leer-zeile">Diese Notiz ist noch leer. Tippe auf „Bearbeiten“, um zu schreiben.</p></div>
      ` : html`
        <article class="karte notiz-inhalt">
          ${notiz.bloecke.map((b) => {
            if (b.art === 'checkliste') {
              if (!b.punkte.length) return null;
              return html`
                <ul class="notiz-haken" key=${b.id}>
                  ${b.punkte.map((p) => html`
                    <li class=${p.erledigt ? 'erledigt' : ''} key=${p.id}>
                      <button class="haken klein" type="button" aria-pressed=${p.erledigt}
                        aria-label=${p.erledigt ? `${p.text} wieder öffnen` : `${p.text} abhaken`}
                        onClick=${() => schaltePunkt(b.id, p.id)}>
                        <span class="haken-kreis">${p.erledigt && html`<${Icon} name="check" groesse=${13} strich=${2.6} />`}</span>
                      </button>
                      <span>${p.text}</span>
                    </li>
                  `)}
                </ul>
              `;
            }
            if (b.art === 'tabelle') return html`<${TabelleAnsicht} key=${b.id} block=${b} />`;
            if (!b.text.trim()) return null;
            return html`<${TextAnsicht} key=${b.id} text=${b.text} />`;
          })}
        </article>
      `}

      <${Unternotizen} notiz=${notiz} />
      <${Aktionen} notiz=${notiz} />
    </div>
  `;
}

function TabelleAnsicht({ block }) {
  const leer = block.zeilen.every((z) => z.every((zelle) => !zelle.trim()));
  if (leer) return null;
  const [kopf, ...rest] = block.kopf ? block.zeilen : [null, ...block.zeilen];
  return html`
    <div class="tab-rahmen lesen">
      <table class=${`notiz-tabelle ${block.zeilen[0].length >= 5 ? 'eng' : ''}`}>
        ${kopf && html`<thead><tr>${kopf.map((zelle) => html`<th scope="col">${zelle}</th>`)}</tr></thead>`}
        <tbody>
          ${rest.map((zeile) => html`<tr>${zeile.map((zelle) => html`<td>${zelle}</td>`)}</tr>`)}
        </tbody>
      </table>
    </div>
  `;
}

// Unternotizen einer Notiz der ersten Ebene.
function Unternotizen({ notiz }) {
  const [neu, setNeu] = useState(null);
  if (notizen.elternVon(notiz)) return null;
  const kinder = notizen.kinderVon(notiz);

  const waehleArt = async () => {
    const art = await waehle({
      titel: 'Was soll dazu?',
      optionen: [
        { wert: 'text', name: 'Unternotiz' },
        { wert: 'tracker', name: 'Messwert-Tracker' },
      ],
    });
    if (art) setNeu({ art });
  };

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf"><h2>Unternotizen</h2>${kinder.length > 0 && html`<span>${kinder.length}</span>`}</div>
      ${kinder.length > 0 && html`
        <ul class="gruppe">
          ${kinder.map((k) => html`<${NotizZeile} key=${k.id} notiz=${k} />`)}
        </ul>
      `}
      <button class="knopf leise breit" type="button" onClick=${waehleArt}>
        <${Icon} name="plus" groesse=${20} /> Unternotiz hinzufügen
      </button>
      ${neu && html`<${NotizNeuBlatt} art=${neu.art} eltern=${notiz} onSchliessen=${() => setNeu(null)} />`}
    </section>
  `;
}

// Sperren mit PIN und Löschen.
function Aktionen({ notiz }) {
  const [pinFenster, setPinFenster] = useState(false);
  const eltern = notizen.elternVon(notiz);
  const ueberEltern = Boolean(eltern && eltern.gesperrt);
  const kinder = notizen.kinderVon(notiz).length;

  const sperren = () => {
    if (!pin.istGesetzt()) {
      setPinFenster(true);
      return;
    }
    store.aendern(notiz.id, { gesperrt: true });
    melde('Gesperrt. Beim nächsten Öffnen der App fragt die Notiz nach der PIN.');
  };

  const loeschen = async () => {
    if (await loescheNotiz(notiz)) geheZu(eltern ? `notiz/${eltern.id}` : 'notizen');
  };

  return html`
    <div class="knopf-stapel">
      ${ueberEltern ? html`
        <p class="feld-hinweis"><${Icon} name="lock" groesse=${14} /> Gesperrt über die Notiz „${eltern.titel}“.</p>
      ` : notiz.gesperrt ? html`
        <button class="knopf breit leise" type="button" onClick=${() => pin.sperre()}>
          <${Icon} name="lock" groesse=${20} /> Jetzt wieder sperren
        </button>
        <button class="knopf breit leise" type="button"
          onClick=${() => { store.aendern(notiz.id, { gesperrt: false }); melde('Die Sperre ist aufgehoben.'); }}>
          <${Icon} name="lock-open" groesse=${20} /> Sperre aufheben
        </button>
      ` : html`
        <button class="knopf breit leise" type="button" onClick=${sperren}>
          <${Icon} name="lock" groesse=${20} /> Mit PIN sperren
        </button>
      `}
      <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
        <${Icon} name="trash-2" groesse=${20} /> ${notiz.art === 'tracker' ? 'Tracker löschen' : 'Notiz löschen'}
      </button>
      ${pinFenster && html`
        <${PinBlatt} modus="einrichten" onSchliessen=${() => setPinFenster(false)}
          onFertig=${() => { store.aendern(notiz.id, { gesperrt: true }); melde('PIN festgelegt, die Notiz ist gesperrt.'); }} />
      `}
    </div>
  `;
}

// ---------- Schreiben: Titel, Kategorie und Blöcke ----------
// Änderungen werden laufend gespeichert (kurz nach der letzten Eingabe und beim Verlassen).

const BLOCK_NAMEN = { text: 'Text', checkliste: 'Checkliste', tabelle: 'Tabelle' };

function Editor({ notiz, onFertig }) {
  const [titel, setTitel] = useState(notiz.titel);
  const [kategorieId, setKategorieId] = useState(notiz.kategorieId);
  const [bloecke, setBloecke] = useState(notiz.bloecke && notiz.bloecke.length ? notiz.bloecke : [notizen.neuerBlock('text')]);
  const [entwuerfe, setEntwuerfe] = useState({}); // angefangene, noch nicht hinzugefügte Checklistenpunkte
  const stand = useRef(null);
  const gespeichert = useRef(JSON.stringify({ titel: notiz.titel, kategorieId: notiz.kategorieId, bloecke: notiz.bloecke }));
  const mitKategorie = !notizen.elternVon(notiz);
  stand.current = { titel, kategorieId, bloecke, entwuerfe };

  const speichere = (mitEntwuerfen) => {
    const s = stand.current;
    const fertig = s.bloecke.map((b) => {
      const offen = mitEntwuerfen && b.art === 'checkliste' ? (s.entwuerfe[b.id] || '').trim() : '';
      return offen ? { ...b, punkte: [...b.punkte, neuerPunkt(offen)] } : b;
    });
    const felder = { titel: s.titel.trim() || 'Ohne Titel', kategorieId: s.kategorieId, bloecke: fertig };
    const text = JSON.stringify(felder);
    if (text === gespeichert.current) return;
    gespeichert.current = text;
    store.aendern(notiz.id, felder);
  };

  useEffect(() => {
    const uhr = setTimeout(() => speichere(false), 600);
    return () => clearTimeout(uhr);
  }, [titel, kategorieId, bloecke]);
  useEffect(() => () => speichere(true), []);

  const aendereBlock = (id, felder) => setBloecke((alt) => alt.map((b) => (b.id === id ? { ...b, ...felder } : b)));
  const verschiebe = (index, um) => setBloecke((alt) => {
    const neu = [...alt];
    const [block] = neu.splice(index, 1);
    neu.splice(index + um, 0, block);
    return neu;
  });
  const entferne = (block) => {
    const vorher = bloecke;
    setBloecke(bloecke.filter((b) => b.id !== block.id));
    melde(`${BLOCK_NAMEN[block.art]} entfernt`, { aktion: 'Rückgängig', beiAktion: () => setBloecke(vorher) });
  };

  return html`
    <div class="seite schreiben">
      <div class="leiste">
        <p class="text-leise">Wird laufend gespeichert</p>
        <button class="knopf-text" type="button" onClick=${onFertig}>Fertig</button>
      </div>

      <input class="feld gross" type="text" maxlength="100" aria-label="Titel der Notiz" placeholder="Titel"
        value=${titel} onInput=${(e) => setTitel(e.target.value)} />

      ${mitKategorie && html`
        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
            <option value="">Keine Kategorie</option>
            ${kategorien().map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
        </label>
      `}

      ${bloecke.map((b, i) => html`
        <section class="schreib-block" key=${b.id}>
          <div class="schreib-kopf">
            <span>${BLOCK_NAMEN[b.art]}</span>
            ${bloecke.length > 1 && html`
              <span class="schreib-knoepfe">
                <button class="knopf-rund" type="button" aria-label=${`${BLOCK_NAMEN[b.art]} nach oben`} disabled=${i === 0} onClick=${() => verschiebe(i, -1)}>
                  <${Icon} name="arrow-up" groesse=${18} />
                </button>
                <button class="knopf-rund" type="button" aria-label=${`${BLOCK_NAMEN[b.art]} nach unten`} disabled=${i === bloecke.length - 1} onClick=${() => verschiebe(i, 1)}>
                  <${Icon} name="arrow-down" groesse=${18} />
                </button>
                <button class="knopf-rund" type="button" aria-label=${`${BLOCK_NAMEN[b.art]} entfernen`} onClick=${() => entferne(b)}>
                  <${Icon} name="trash-2" groesse=${18} />
                </button>
              </span>
            `}
          </div>
          ${b.art === 'text' && html`<${TextBlock} text=${b.text} onAendern=${(text) => aendereBlock(b.id, { text })} />`}
          ${b.art === 'checkliste' && html`
            <${PunktListe} punkte=${b.punkte} onAendern=${(punkte) => aendereBlock(b.id, { punkte })}
              entwurf=${entwuerfe[b.id] || ''} onEntwurf=${(text) => setEntwuerfe({ ...entwuerfe, [b.id]: text })}
              platzhalter="Punkt hinzufügen" />
          `}
          ${b.art === 'tabelle' && html`<${TabelleBlock} block=${b} onAendern=${(felder) => aendereBlock(b.id, felder)} />`}
        </section>
      `)}

      <div class="schreib-neu" role="group" aria-label="Block hinzufügen">
        <button class="chip" type="button" onClick=${() => setBloecke([...bloecke, notizen.neuerBlock('text')])}><${Icon} name="plus" groesse=${16} /> Text</button>
        <button class="chip" type="button" onClick=${() => setBloecke([...bloecke, notizen.neuerBlock('checkliste')])}><${Icon} name="plus" groesse=${16} /> Checkliste</button>
        <button class="chip" type="button" onClick=${() => setBloecke([...bloecke, notizen.neuerBlock('tabelle')])}><${Icon} name="plus" groesse=${16} /> Tabelle</button>
      </div>

      <button class="knopf breit" type="button" onClick=${onFertig}>Fertig</button>
    </div>
  `;
}

const FORMATE = [
  { art: 'fett', icon: 'bold', name: 'Fett' },
  { art: 'kursiv', icon: 'italic', name: 'Kursiv' },
  { art: 'ueberschrift', icon: 'heading', name: 'Überschrift' },
  { art: 'liste', icon: 'list', name: 'Liste' },
  { art: 'nummern', icon: 'list-ordered', name: 'Nummerierte Liste' },
];

// Textfeld mit Formatierungsknöpfen. Das Feld wächst mit dem Text.
function TextBlock({ text, onAendern }) {
  const feld = useRef(null);
  const auswahl = useRef(null); // nach dem nächsten Zeichnen zu setzende Auswahl

  // Gleich nach dem Zeichnen, noch bevor die nächste Eingabe ankommt.
  useLayoutEffect(() => {
    if (auswahl.current && feld.current) {
      const { von, bis } = auswahl.current;
      auswahl.current = null;
      feld.current.focus();
      feld.current.setSelectionRange(von, bis);
    }
  });

  const wende = (ergebnis) => {
    auswahl.current = { von: ergebnis.von, bis: ergebnis.bis };
    onAendern(ergebnis.text);
  };

  const format = (art) => {
    const el = feld.current;
    if (!el) return;
    wende(formatiere(art, el.value, el.selectionStart, el.selectionEnd));
  };

  const eingabe = (e) => {
    const el = e.target;
    const neu = el.value;
    // Nach einem Zeilenumbruch in einer Liste geht die Liste weiter.
    if (neu.length === text.length + 1 && el.selectionStart === el.selectionEnd) {
      const weiter = setzeListeFort(neu, el.selectionStart);
      if (weiter) {
        wende(weiter);
        return;
      }
    }
    onAendern(neu);
  };

  return html`
    <div class="text-block">
      <div class="format-leiste" role="toolbar" aria-label="Formatierung">
        ${FORMATE.map((f) => html`
          <button type="button" aria-label=${f.name} title=${f.name}
            onMouseDown=${(e) => e.preventDefault()} onClick=${() => format(f.art)}>
            <${Icon} name=${f.icon} groesse=${19} />
          </button>
        `)}
      </div>
      <div class="wachs" data-wert=${text}>
        <textarea ref=${feld} class="feld" rows="3" aria-label="Text" placeholder="Schreib los …" value=${text} onInput=${eingabe}></textarea>
      </div>
    </div>
  `;
}

const MAX_SPALTEN = 6;

function TabelleBlock({ block, onAendern }) {
  const zeilen = block.zeilen;
  const spalten = zeilen[0].length;
  const setze = (z, s, text) => onAendern({ zeilen: zeilen.map((zeile, i) => (i === z ? zeile.map((zelle, j) => (j === s ? text : zelle)) : zeile)) });

  return html`
    <div class="tab-block">
      <div class="tab-rahmen">
        <table class="tab-bearbeiten">
          <tbody>
            ${zeilen.map((zeile, z) => html`
              <tr class=${block.kopf && z === 0 ? 'kopfzeile' : ''}>
                ${zeile.map((zelle, s) => html`
                  <td>
                    <input class="feld" type="text" value=${zelle} aria-label=${`Zeile ${z + 1}, Spalte ${s + 1}`}
                      onInput=${(e) => setze(z, s, e.target.value)} />
                  </td>
                `)}
                <td class="tab-knopf">
                  <button class="knopf-rund" type="button" aria-label=${`Zeile ${z + 1} entfernen`} disabled=${zeilen.length === 1}
                    onClick=${() => onAendern({ zeilen: zeilen.filter((_, i) => i !== z) })}>
                    <${Icon} name="x" groesse=${17} />
                  </button>
                </td>
              </tr>
            `)}
            <tr>
              ${zeilen[0].map((_, s) => html`
                <td class="tab-knopf">
                  <button class="knopf-rund" type="button" aria-label=${`Spalte ${s + 1} entfernen`} disabled=${spalten === 1}
                    onClick=${() => onAendern({ zeilen: zeilen.map((zeile) => zeile.filter((__, j) => j !== s)) })}>
                    <${Icon} name="x" groesse=${17} />
                  </button>
                </td>
              `)}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="chips">
        <button class="chip" type="button" onClick=${() => onAendern({ zeilen: [...zeilen, zeilen[0].map(() => '')] })}><${Icon} name="plus" groesse=${16} /> Zeile</button>
        <button class="chip" type="button" disabled=${spalten >= MAX_SPALTEN} onClick=${() => onAendern({ zeilen: zeilen.map((zeile) => [...zeile, '']) })}><${Icon} name="plus" groesse=${16} /> Spalte</button>
        <button class=${`chip ${block.kopf ? 'aktiv' : ''}`} type="button" aria-pressed=${block.kopf} onClick=${() => onAendern({ kopf: !block.kopf })}>Erste Zeile als Kopf</button>
      </div>
    </div>
  `;
}

// ---------- Messwert-Tracker ----------

const ZEITRAEUME = [
  { wert: 30, name: '30 Tage' },
  { wert: 90, name: '90 Tage' },
  { wert: 365, name: '1 Jahr' },
  { wert: 0, name: 'Alles' },
];

function leseZahl(text) {
  const sauber = text.trim().replace(',', '.');
  if (!sauber) return null;
  const zahl = Number(sauber);
  return Number.isFinite(zahl) ? zahl : null;
}

function Tracker({ notiz }) {
  const [datum, setDatum] = useState(heute());
  const [eingabe, setEingabe] = useState('');
  const [fehler, setFehler] = useState('');
  const [zeitraum, setZeitraum] = useState(90);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [offen, setOffen] = useState(null); // Messwert, der gerade bearbeitet wird
  const [bearbeiten, setBearbeiten] = useState(false);
  const tag = heute();
  const einheit = notiz.einheit ? ` ${notiz.einheit}` : '';
  const alle = notizen.messwerte(notiz);
  const gezeigt = zeitraum ? alle.filter((m) => m.datum >= plusTage(tag, -zeitraum + 1)) : alle;
  const neueste = [...alle].reverse();
  const liste = alleZeigen ? neueste : neueste.slice(0, 7);

  const hinzu = (e) => {
    e.preventDefault();
    const zahl = leseZahl(eingabe);
    if (zahl === null) return setFehler('Gib eine Zahl ein, zum Beispiel 64,5.');
    if (!datum) return setFehler('Wähle ein Datum.');
    if (datum > tag) return setFehler('Das Datum liegt in der Zukunft.');
    const art = notizen.setzeMesswert(notiz, datum, zahl);
    setEingabe('');
    setFehler('');
    melde(art === 'ersetzt' ? `Wert vom ${datumKurz(datumAusText(datum))} ersetzt` : 'Wert eingetragen');
    return null;
  };

  const kacheln = [];
  if (gezeigt.length) {
    const werte = gezeigt.map((m) => m.wert);
    const letzter = gezeigt[gezeigt.length - 1];
    const unterschied = letzter.wert - gezeigt[0].wert;
    kacheln.push({ name: `Letzter Wert, ${tagLesbar(letzter.datum)}`, wert: `${notizen.zahlText(letzter.wert)}${einheit}` });
    kacheln.push({
      name: 'Veränderung im Zeitraum',
      wert: gezeigt.length > 1 ? `${unterschied > 0 ? '+' : unterschied < 0 ? '−' : '±'}${notizen.zahlText(Math.abs(unterschied))}${einheit}` : 'Noch offen',
    });
    kacheln.push({ name: 'Niedrigster Wert', wert: `${notizen.zahlText(Math.min(...werte))}${einheit}` });
    kacheln.push({ name: 'Höchster Wert', wert: `${notizen.zahlText(Math.max(...werte))}${einheit}` });
  }

  return html`
    <div class="seite">
      <div class="leiste">
        <${Angaben} notiz=${notiz} zusatz=${notiz.einheit ? `Messwerte in ${notiz.einheit}` : 'Messwerte'} />
        <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
      </div>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Neuer Wert</h2></div>
        <form class="karte wert-neu" novalidate onSubmit=${hinzu}>
          <label>
            <span>Datum</span>
            <input class="feld" type="date" max=${tag} value=${datum} onInput=${(e) => { setDatum(e.target.value); setFehler(''); }} />
          </label>
          <label>
            <span>Wert${notiz.einheit ? ` in ${notiz.einheit}` : ''}</span>
            <input class="feld" type="text" inputmode="decimal" enterkeyhint="done" placeholder="0" value=${eingabe}
              onInput=${(e) => { setEingabe(e.target.value); setFehler(''); }} />
          </label>
          <button class="knopf" type="submit" aria-label="Wert eintragen"><${Icon} name="plus" /></button>
          ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
        </form>
      </section>

      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>Verlauf</h2></div>
        <div class="wahl" role="group" aria-label="Zeitraum">
          ${ZEITRAEUME.map((z) => html`
            <button type="button" class=${zeitraum === z.wert ? 'aktiv' : ''} aria-pressed=${zeitraum === z.wert} onClick=${() => setZeitraum(z.wert)}>${z.name}</button>
          `)}
        </div>
        <div class="karte kurve-karte">
          ${gezeigt.length ? html`<${Kurve} werte=${gezeigt} einheit=${notiz.einheit} />` : html`
            <p class="leer-zeile">${alle.length ? 'In diesem Zeitraum gibt es keine Werte.' : 'Noch keine Werte. Trag oben den ersten ein.'}</p>
          `}
        </div>
        ${kacheln.length > 0 && html`
          <dl class="zahlen-raster">
            ${kacheln.map((k) => html`<div><dt>${k.name}</dt><dd>${k.wert}</dd></div>`)}
          </dl>
        `}
      </section>

      ${alle.length > 0 && html`
        <section class="abschnitt">
          <div class="abschnitt-kopf"><h2>Einträge</h2><span>${alle.length}</span></div>
          <ul class="gruppe">
            ${liste.map((m) => html`
              <li class="zeile" key=${m.id} data-lang=${`messwert:${m.id}`}>
                <button class="zeile-haupt wert-zeile" type="button" onClick=${() => setOffen(m)}>
                  <span class="zeile-text"><strong>${tagLesbar(m.datum)}</strong></span>
                  <span class="zeile-zahl">${notizen.zahlText(m.wert)}${einheit}</span>
                  <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
                </button>
              </li>
            `)}
          </ul>
          ${neueste.length > 7 && html`
            <button class="knopf-text" type="button" onClick=${() => setAlleZeigen(!alleZeigen)}>
              ${alleZeigen ? 'Weniger zeigen' : `Alle ${neueste.length} Einträge zeigen`}
            </button>
          `}
        </section>
      `}

      <${Aktionen} notiz=${notiz} />

      ${offen && html`<${MesswertBlatt} notiz=${notiz} messwert=${offen} onSchliessen=${() => setOffen(null)} />`}
      ${bearbeiten && html`<${NotizNeuBlatt} art="tracker" vorhanden=${notiz} onSchliessen=${() => setBearbeiten(false)} />`}
    </div>
  `;
}

function MesswertBlatt({ notiz, messwert, onSchliessen }) {
  const [datum, setDatum] = useState(messwert.datum);
  const [eingabe, setEingabe] = useState(notizen.zahlText(messwert.wert));
  const [fehler, setFehler] = useState('');
  const tag = heute();

  const speichern = () => {
    const zahl = leseZahl(eingabe);
    if (zahl === null) return setFehler('Gib eine Zahl ein, zum Beispiel 64,5.');
    if (!datum || datum > tag) return setFehler('Wähle ein Datum, das nicht in der Zukunft liegt.');
    notizen.setzeMesswert(notiz, datum, zahl, messwert.id);
    onSchliessen();
    return null;
  };

  const loeschen = async () => {
    if (await loescheMesswert(messwert)) onSchliessen();
  };

  const fuss = html`
    <div class="fuss-stapel">
      ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}
      <button class="knopf breit" type="button" onClick=${speichern}>Änderungen speichern</button>
    </div>
  `;

  return html`
    <${Blatt} titel="Eintrag ändern" onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <label class="feld-gruppe">
          <span>Datum</span>
          <input class="feld" type="date" max=${tag} value=${datum} onInput=${(e) => { setDatum(e.target.value); setFehler(''); }} />
        </label>
        <label class="feld-gruppe">
          <span>Wert${notiz.einheit ? ` in ${notiz.einheit}` : ''}</span>
          <input class="feld" type="text" inputmode="decimal" value=${eingabe} onInput=${(e) => { setEingabe(e.target.value); setFehler(''); }} />
        </label>
        <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
          <${Icon} name="trash-2" groesse=${20} /> Eintrag löschen
        </button>
      </div>
    <//>
  `;
}

// Verlaufskurve als Zeichnung. Die Tage liegen maßstäblich auf der Achse.
function Kurve({ werte, einheit }) {
  const B = 340;
  const H = 180;
  const links = 40;
  const rechts = 12;
  const oben = 14;
  const unten = 26;
  const zahlen = werte.map((m) => m.wert);
  let min = Math.min(...zahlen);
  let max = Math.max(...zahlen);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rand = (max - min) * 0.1;
  min -= rand;
  max += rand;
  const erster = werte[0].datum;
  const spanne = Math.max(1, tageZwischen(erster, werte[werte.length - 1].datum));
  const x = (m) => (werte.length === 1 ? links + (B - links - rechts) / 2 : links + (tageZwischen(erster, m.datum) / spanne) * (B - links - rechts));
  const y = (wert) => oben + (1 - (wert - min) / (max - min)) * (H - oben - unten);
  const punkte = werte.map((m) => [x(m), y(m.wert)]);
  const linie = punkte.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const flaeche = `${linie} L${punkte[punkte.length - 1][0].toFixed(1)} ${H - unten} L${punkte[0][0].toFixed(1)} ${H - unten} Z`;
  const stufen = [max - rand, (min + max) / 2, min + rand];
  const letzter = punkte[punkte.length - 1];
  const beschreibung = `Verlauf von ${notizen.zahlText(werte[0].wert)} am ${datumKurz(datumAusText(erster))} bis ${notizen.zahlText(werte[werte.length - 1].wert)} am ${datumKurz(datumAusText(werte[werte.length - 1].datum))}${einheit ? `, in ${einheit}` : ''}`;

  return html`
    <svg class="kurve" viewBox=${`0 0 ${B} ${H}`} role="img" aria-label=${beschreibung}>
      ${stufen.map((wert) => html`
        <line x1=${links} x2=${B - rechts} y1=${y(wert)} y2=${y(wert)} class="kurve-linie" />
        <text x=${links - 6} y=${y(wert) + 4} text-anchor="end" class="kurve-zahl">${notizen.zahlText(Math.round(wert * 10) / 10)}</text>
      `)}
      ${werte.length > 1 && html`<path d=${flaeche} class="kurve-flaeche" />`}
      ${werte.length > 1 && html`<path d=${linie} class="kurve-strich" />`}
      ${werte.length <= 45 && punkte.slice(0, -1).map(([px, py]) => html`<circle cx=${px} cy=${py} r="2.6" class="kurve-punkt" />`)}
      <circle cx=${letzter[0]} cy=${letzter[1]} r="4.5" class="kurve-letzter" />
      <text x=${links} y=${H - 7} text-anchor="start" class="kurve-zahl">${datumKurz(datumAusText(erster))}</text>
      ${werte.length > 1 && html`<text x=${B - rechts} y=${H - 7} text-anchor="end" class="kurve-zahl">${datumKurz(datumAusText(werte[werte.length - 1].datum))}</text>`}
    </svg>
  `;
}
