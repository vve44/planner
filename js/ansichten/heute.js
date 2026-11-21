// Tagesbereich: der Stand eines Tages, normalerweise des heutigen.
// Über die Pfeile im Kopf (oder das Datum) springt die Ansicht zu anderen Tagen: #/heute/2026-11-20.
// An vergangenen Tagen lassen sich Habits und Tagesroutinen nachtragen, kommende Tage sind eine Vorschau.
//
// Die Bereiche (Level, Termine, Habits, Tagesroutinen, Überfällig, Aufgaben, Vorschläge, Zyklus)
// stehen in der Reihenfolge, die die Nutzerin gewählt hat, und lassen sich ausblenden (heute-layout.js).
// Langes Drücken auf die Überschrift eines Bereichs öffnet sein Menü, unten auf der Seite steht „Ansicht anpassen“.

import { html, useState, useRef } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { Blatt, melde, waehle, oeffneBlatt } from '../bausteine/fenster.js';
import { AufgabenGruppe } from '../bausteine/aufgabe-zeile.js';
import { oeffneAufgabe } from '../bausteine/aufgabe-blatt.js';
import { oeffneBackup } from '../bausteine/backup-dialoge.js';
import { registriere } from '../bausteine/lang-druck.js';
import { useDaten, geheZu } from '../haken.js';
import { backupStatus } from '../backup.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as tagesroutinen from '../tagesroutinen.js';
import * as pools from '../pools.js';
import * as termine from '../termine.js';
import * as habits from '../habits.js';
import * as layout from '../heute-layout.js';
import { TerminBlatt } from '../bausteine/termin-blatt.js';
import { HabitZeile } from '../bausteine/habit-teile.js';
import { ZyklusHeute } from './zyklus.js';
import { LevelZeile } from './garten.js';
import {
  heute, istInstalliert, vorTagen, tagLesbar, tagImSatz, dauerLesbar, jetztMin, datumAusText, datumLokal,
  plusTage, tageZwischen, tagAusfuehrlich,
} from '../hilfen.js';

const TERMIN_FARBE = '#7ba6a5';

// ---------- Welcher Tag gezeigt wird ----------

export function tagAusRoute(teil) {
  if (teil && /^\d{4}-\d{2}-\d{2}$/.test(teil) && !Number.isNaN(datumAusText(teil).getTime())) return teil;
  return heute();
}

export function geheZuTag(tag) {
  geheZu(tag === heute() ? 'heute' : `heute/${tag}`);
}

function tagTitel(tag) {
  const abstand = tageZwischen(heute(), tag);
  if (abstand === 0) return 'Heute';
  if (abstand === -1) return 'Gestern';
  if (abstand === 1) return 'Morgen';
  if (abstand === -2) return 'Vorgestern';
  if (abstand === 2) return 'Übermorgen';
  return abstand > 0 ? `In ${abstand} Tagen` : `Vor ${-abstand} Tagen`;
}

// Kopf des Tabs: Titel und Datum (antippen öffnet die Datumswahl), dazu Pfeile zum Blättern.
export function HeuteKopf({ teil }) {
  const tag = tagAusRoute(teil);
  const istHeute = tag === heute();
  const oeffneWahl = (e) => {
    try { if (e.currentTarget.showPicker) e.currentTarget.showPicker(); } catch (fehler) { /* iOS öffnet die Wahl selbst */ }
  };
  return html`
    <div class="kopf-text tag-wahl">
      <h1>${tagTitel(tag)}</h1>
      <p>${tagAusfuehrlich(tag)}</p>
      <input class="tag-wahl-feld" type="date" value=${tag} aria-label="Tag wählen"
        onClick=${oeffneWahl} onChange=${(e) => { if (e.target.value) geheZuTag(e.target.value); }} />
    </div>
    <div class="kopf-tage">
      ${!istHeute && html`<button class="kopf-aktion klein" type="button" onClick=${() => geheZuTag(heute())}>Heute</button>`}
      <button class="kopf-pfeil" type="button" aria-label="Vorheriger Tag" onClick=${() => geheZuTag(plusTage(tag, -1))}>
        <${Icon} name="chevron-left" groesse=${24} />
      </button>
      <button class="kopf-pfeil" type="button" aria-label="Nächster Tag" onClick=${() => geheZuTag(plusTage(tag, 1))}>
        <${Icon} name="chevron-right" groesse=${24} />
      </button>
    </div>
  `;
}

// ---------- Die Seite ----------

export function Heute({ teil }) {
  useDaten();
  const tag0 = heute();
  const tag = tagAusRoute(teil);
  const istHeute = tag === tag0;
  const kommend = tag > tag0;
  const status = backupStatus();
  const alle = aufgaben.alleAufgaben();
  const lang = (id) => `bereich:${id}:${tag}`;

  const ueberfaellig = istHeute ? aufgaben.sortiere(alle.filter((a) => aufgaben.istUeberfaellig(a, tag))) : [];
  const offen = aufgaben.sortiere(alle.filter((a) => !a.erledigtAm && a.plandatum === tag));
  const geschafft = aufgaben.sortiereErledigte(alle.filter((a) => a.erledigtAm && datumLokal(new Date(a.erledigtAm)) === tag));
  const aufgabenTitel = istHeute ? 'Aufgaben für heute'
    : tageZwischen(tag0, tag) === 1 ? 'Aufgaben für morgen'
      : tageZwischen(tag0, tag) === -1 ? 'Aufgaben von gestern'
        : `Aufgaben ${kommend ? 'für' : 'vom'} ${tagLesbar(tag)}`;
  const leerText = istHeute
    ? 'Für heute ist nichts geplant. Mit dem Plus legst du eine Aufgabe an.'
    : kommend ? 'Für diesen Tag ist nichts geplant. Mit dem Plus legst du eine Aufgabe dafür an.' : 'An diesem Tag war nichts geplant.';

  const bereiche = {
    level: () => html`<${LevelZeile} lang=${lang('level')} />`,
    termine: () => html`<${TermineAm} tag=${tag} kopfLang=${lang('termine')} />`,
    habits: () => html`<${HabitsAm} tag=${tag} kommend=${kommend} kopfLang=${lang('habits')} />`,
    tagesroutinen: () => html`<${Tagesroutinen} tag=${tag} kommend=${kommend} kopfLang=${lang('tagesroutinen')} />`,
    ueberfaellig: () => (istHeute ? html`
      <${AufgabenGruppe} titel="Überfällig" liste=${ueberfaellig} warnung=${true} zeigeDatum=${true} mitMorgen=${true} kopfLang=${lang('ueberfaellig')} />
    ` : null),
    aufgaben: () => html`
      <${AufgabenGruppe} titel=${aufgabenTitel} liste=${[...offen, ...geschafft]} mitMorgen=${istHeute} leerText=${leerText} kopfLang=${lang('aufgaben')} />
    `,
    vorschlaege: () => (istHeute ? html`<${Vorschlaege} tag=${tag} kopfLang=${lang('vorschlaege')} />` : null),
    zyklus: () => html`<${ZyklusHeute} tag=${tag} kopfLang=${lang('zyklus')} />`,
  };
  const reihe = layout.reihenfolge().filter((id) => !layout.ausgeblendet(id, tag));
  const versteckt = layout.ausgeblendeteAm(tag);

  return html`
    <div class="seite">
      ${istHeute && !istInstalliert() && html`<${InstallHinweis} />`}
      ${istHeute && html`<${BackupKarte} status=${status} />`}

      ${reihe.map((id) => html`<div class="bereich" data-bereich=${id} key=${id}>${bereiche[id]()}</div>`)}

      <div class="heute-fuss">
        ${versteckt.length > 0 && html`<p>Ausgeblendet: ${versteckt.map(layout.nameVon).join(', ')}</p>`}
        <button class="knopf-text" type="button" onClick=${() => oeffneAnpassen(tag)}>
          <${Icon} name="sliders-horizontal" groesse=${17} /> Ansicht anpassen
        </button>
      </div>

      <button class="knopf-plus" type="button" aria-label=${kommend ? 'Aufgabe für diesen Tag anlegen' : 'Aufgabe für heute anlegen'}
        onClick=${() => oeffneAufgabe({ vorgaben: { plandatum: kommend ? tag : tag0 } })}>
        <${Icon} name="plus" groesse=${26} />
      </button>
    </div>
  `;
}

// ---------- Bereiche verschieben und ausblenden ----------

function oeffneAnpassen(tag) {
  oeffneBlatt((zu) => html`<${AnpassenBlatt} tag=${tag} onSchliessen=${zu} />`);
}

// Menü beim langen Drücken auf die Überschrift eines Bereichs.
async function bereichMenue(id, [tag = heute()]) {
  const istHeute = tag === heute();
  // Was gerade auf der Seite zu sehen ist, in dieser Reihenfolge
  const sichtbar = [...document.querySelectorAll('[data-bereich]')]
    .filter((el) => el.childElementCount > 0)
    .map((el) => el.dataset.bereich);
  const i = sichtbar.indexOf(id);
  const optionen = [];
  if (i > 0) optionen.push({ wert: 'oben', name: 'Ganz nach oben' }, { wert: 'hoch', name: 'Eins nach oben' });
  if (i >= 0 && i < sichtbar.length - 1) optionen.push({ wert: 'runter', name: 'Eins nach unten' });
  optionen.push(
    { wert: 'tag', name: istHeute ? 'Nur heute ausblenden' : 'Nur an diesem Tag ausblenden' },
    { wert: 'aus', name: 'Bis auf Weiteres ausblenden' },
    { wert: 'anpassen', name: 'Ansicht anpassen' },
  );
  const wahl = await waehle({ titel: layout.nameVon(id), optionen });
  if (!wahl) return;
  if (wahl === 'anpassen') { oeffneAnpassen(tag); return; }
  const zurueck = layout.sichern();
  const name = layout.nameVon(id);
  if (wahl === 'oben') await layout.setzeVor(id, sichtbar[0]);
  else if (wahl === 'hoch') await layout.setzeVor(id, sichtbar[i - 1]);
  else if (wahl === 'runter') await layout.setzeHinter(id, sichtbar[i + 1]);
  else {
    await layout.blendeAus(id, wahl === 'tag' ? tag : null);
    const wann = wahl === 'tag' ? (istHeute ? 'für heute' : `für ${tagImSatz(tag).replace(/^am /, 'den ')}`) : 'bis auf Weiteres';
    melde(`„${name}“ ${wann} ausgeblendet`, { aktion: 'Rückgängig', beiAktion: zurueck });
  }
}

registriere('bereich', { menue: bereichMenue });

// Blatt „Ansicht anpassen“: Reihenfolge per Griff ziehen, Bereiche ein- und ausblenden.
function AnpassenBlatt({ tag, onSchliessen }) {
  useDaten();
  const istHeute = tag === heute();
  const reihe = layout.reihenfolge();
  const liste = useRef(null);
  const zugRef = useRef(null);
  const [zug, setZug] = useState(null);

  const ziehStart = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const zeilen = [...liste.current.querySelectorAll('[data-zeile]')];
    const rahmen = zeilen.map((z) => z.getBoundingClientRect());
    const von = reihe.indexOf(id);
    const y0 = e.clientY;
    const hoehe = rahmen[von].height;
    const neu = { id, von, ziel: von, dy: 0, hoehe };
    zugRef.current = neu;
    setZug(neu);
    const bewege = (ev) => {
      const dy = Math.max(rahmen[0].top - rahmen[von].top, Math.min(rahmen[rahmen.length - 1].top - rahmen[von].top, ev.clientY - y0));
      const mitte = rahmen[von].top + hoehe / 2 + dy;
      // Neuer Platz: so viele andere Zeilen, wie oberhalb der Mitte der gezogenen Zeile liegen
      // (2 Pixel Spielraum: Die Zeilen sind wegen der Trennlinien nicht ganz gleich hoch.)
      const ziel = rahmen.filter((r, j) => j !== von && r.top + r.height / 2 < mitte - 2).length;
      zugRef.current = { ...zugRef.current, dy, ziel };
      setZug(zugRef.current);
    };
    const ende = () => {
      window.removeEventListener('pointermove', bewege);
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      const z = zugRef.current;
      zugRef.current = null;
      setZug(null);
      if (z && z.ziel !== z.von) {
        const ordnung = reihe.filter((x) => x !== z.id);
        ordnung.splice(z.ziel, 0, z.id);
        layout.setzeReihenfolge(ordnung);
      }
    };
    window.addEventListener('pointermove', bewege);
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
  };

  // Verschiebung der übrigen Zeilen, während eine gezogen wird
  const versatz = (j) => {
    if (!zug) return 0;
    if (j === zug.von) return zug.dy;
    if (zug.ziel > zug.von && j > zug.von && j <= zug.ziel) return -zug.hoehe;
    if (zug.ziel < zug.von && j >= zug.ziel && j < zug.von) return zug.hoehe;
    return 0;
  };

  const schalte = (id, an) => {
    if (an) layout.blendeEin(id, tag);
    else layout.blendeAus(id, null);
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${onSchliessen}>Fertig</button>`;

  return html`
    <${Blatt} titel="Ansicht anpassen" onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <p class="text-leise">
          Halte den Griff links und ziehe einen Bereich an seinen Platz. Mit dem Schalter blendest du ihn aus,
          bis du ihn wieder einschaltest. Die Hinweise zu Backup und Installation stehen immer oben.
        </p>
        <ul class=${`gruppe anpassen-liste ${zug ? 'zieht' : ''}`} ref=${liste}>
          ${reihe.map((id, j) => {
            const b = layout.BEREICHE.find((x) => x.id === id);
            const aus = layout.ausgeblendet(id, tag);
            const gezogen = zug && zug.id === id;
            return html`
              <li key=${id} data-zeile=${id} class=${`anpassen-zeile ${aus ? 'aus' : ''} ${gezogen ? 'gezogen' : ''}`}
                style=${`transform:translateY(${versatz(j)}px)`}>
                <button class="griff" type="button" aria-label=${`${b.name} verschieben`} onPointerDown=${(e) => ziehStart(e, id)}>
                  <${Icon} name="grip-vertical" groesse=${20} />
                </button>
                <span class="anpassen-name">
                  <${Icon} name=${b.icon} groesse=${18} />
                  <span>
                    <strong>${b.name}</strong>
                    ${aus === 'tag' && html`<small>${istHeute ? 'Nur heute ausgeblendet' : 'An diesem Tag ausgeblendet'}</small>`}
                    ${aus === 'dauerhaft' && html`<small>Ausgeblendet</small>`}
                  </span>
                </span>
                <button class="schalter" type="button" role="switch" aria-checked=${!aus} aria-label=${`${b.name} zeigen`}
                  onClick=${() => schalte(id, Boolean(aus))}>
                </button>
              </li>
            `;
          })}
        </ul>
        ${!layout.istStandard() && html`
          <button class="knopf leise breit" type="button" onClick=${() => {
            const zurueck = layout.sichern();
            layout.zuruecksetzen();
            melde('Ansicht zurückgesetzt', { aktion: 'Rückgängig', beiAktion: zurueck });
          }}>
            <${Icon} name="rotate-ccw" groesse=${18} /> Ursprüngliche Ansicht wiederherstellen
          </button>
        `}
      </div>
    </${Blatt}>
  `;
}

// ---------- Termine des Tages (nur wenn es welche gibt) ----------

function TermineAm({ tag, kopfLang }) {
  const [offen, setOffen] = useState(null);
  const { ganztags, zeitlich } = termine.eintraegeAm(tag);
  const tag0 = heute();
  const jetzt = jetztMin();
  const vorbeiAm = (v) => tag < tag0 || (tag === tag0 && v.bisMin <= jetzt);
  const zeilen = [
    ...ganztags.map((v) => ({ v, zeit: 'Ganztägig', vorbei: tag < tag0 })),
    ...zeitlich.map((v) => ({ v, zeit: termine.zeitText(v, tag), vorbei: vorbeiAm(v) })),
  ];
  if (!zeilen.length && !offen) return null;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
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
            <li key=${`${v.termin.id}-${v.start}`} data-lang=${`termin:${v.termin.id}:${v.start}`}>
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

// ---------- Habits, die an diesem Tag anstehen ----------

function HabitsAm({ tag, kommend = false, kopfLang }) {
  const alle = habits.alle();
  const urlaub = habits.urlaubAm(tag);
  // Was heute nicht dran ist oder ruht, erscheint hier nicht.
  const sichtbar = alle
    .map((habit) => ({ habit, lage: habits.lageAm(habit, tag) }))
    .filter(({ lage }) => lage !== 'frei' && lage !== 'ruht');
  const liste = [...sichtbar.filter((x) => x.lage === 'offen'), ...sichtbar.filter((x) => x.lage !== 'offen')];
  const erledigt = sichtbar.filter((x) => x.lage === 'erledigt').length;
  const zuTun = sichtbar.filter((x) => x.lage === 'offen' || x.lage === 'erledigt').length;

  let leerText = tag === heute() ? 'Heute steht kein Habit an.' : 'An diesem Tag steht kein Habit an.';
  if (!alle.length) leerText = 'Gewohnheiten mit Streak und Statistik, zum Beispiel täglich lesen oder dreimal pro Woche Sport.';
  else if (urlaub && !liste.length) leerText = `Urlaub bis ${tagLesbar(urlaub.bis)}: Alle Habits ruhen, die Streaks bleiben.`;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
        <h2>Habits</h2>
        <span class="kopf-rechts">
          ${zuTun > 0 && html`<span>${erledigt}/${zuTun}</span>`}
          <button class="knopf-text" type="button" onClick=${() => geheZu('habits')}>${alle.length ? 'Alle' : 'Einrichten'}</button>
        </span>
      </div>
      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map(({ habit }) => html`<${HabitZeile} key=${habit.id} habit=${habit} tag=${tag} nurLesen=${kommend} />`)}
        </ul>
      ` : html`<div class="gruppe"><p class="leer-zeile">${leerText}</p></div>`}
    </section>
  `;
}

// ---------- Tagesroutinen: täglich einzeln abhaken, ohne Streak ----------

function Tagesroutinen({ tag, kommend = false, kopfLang }) {
  const liste = tagesroutinen.alle();
  const erledigt = tagesroutinen.erledigteAm(tag);
  const geschafft = liste.filter((r) => erledigt.has(r.id)).length;

  return html`
    <section class="abschnitt">
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
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
              <li key=${r.id} class=${`routine-zeile ${fertig ? 'erledigt' : ''}`} data-lang=${`tagesroutine:${r.id}`}>
                <button class="haken" type="button" aria-pressed=${fertig} disabled=${kommend}
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

function Vorschlaege({ tag, kopfLang }) {
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
      <div class="abschnitt-kopf" data-lang=${kopfLang}>
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
