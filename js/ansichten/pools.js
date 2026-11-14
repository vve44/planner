// Aufgabenpools (zum Beispiel der Putzplan): Pools anlegen und ihre Einträge mit
// Abständen pflegen. Was wieder dran ist, erscheint als Vorschlag im Tagesbereich.

import { html, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from '../bausteine/icon.js';
import { IconWahl } from '../bausteine/icon-wahl.js';
import { DauerWahl, AbstandWahl } from '../bausteine/felder.js';
import { Blatt, melde } from '../bausteine/fenster.js';
import { useDaten, geheZu } from '../haken.js';
import * as store from '../store.js';
import * as pools from '../pools.js';
import { heute, tagLesbar } from '../hilfen.js';

// ---------- Alle Pools ----------

export function Pools() {
  useDaten();
  const [neu, setNeu] = useState(false);
  const liste = pools.pools();
  const tag = heute();

  if (!liste.length) {
    return html`
      <div class="seite">
        <section class="leer">
          <span class="leer-icon"><${Icon} name="repeat" groesse=${28} strich=${1.4} /></span>
          <h2>Noch kein Aufgabenpool</h2>
          <p class="text-leise">
            Ein Pool sammelt Dinge, die in bestimmten Abständen dran sind, zum Beispiel ein Putzplan:
            Bad wöchentlich, Staubsaugen alle 2 Tage, Bettwäsche alle 2 Wochen. Was ansteht, erscheint
            als Vorschlag im Tagesbereich.
          </p>
          <button class="knopf" type="button" onClick=${() => setNeu(true)}>
            <${Icon} name="plus" /> Pool anlegen
          </button>
        </section>
        ${neu && html`<${PoolBlatt} onSchliessen=${() => setNeu(false)} />`}
      </div>
    `;
  }

  return html`
    <div class="seite">
      <ul class="gruppe">
        ${liste.map((p) => {
          const eigene = pools.eintraege(p.id);
          const an = eigene.filter((e) => pools.stehtAn(e, tag) && !pools.offeneAufgabeZu(e)).length;
          const teile = [eigene.length === 1 ? '1 Eintrag' : `${eigene.length} Einträge`];
          if (an) teile.push(an === 1 ? '1 steht an' : `${an} stehen an`);
          return html`
            <li class="zeile" key=${p.id}>
              <button class="zeile-haupt" type="button" onClick=${() => geheZu(`pool/${p.id}`)}>
                <span class="listen-icon"><${Icon} name=${p.icon || 'repeat'} groesse=${20} /></span>
                <span class="zeile-text"><strong>${p.name}</strong><span>${teile.join(', ')}</span></span>
                <${Icon} name="chevron-right" groesse=${18} klasse="zeile-pfeil" />
              </button>
            </li>
          `;
        })}
      </ul>
      <button class="knopf leise breit" type="button" onClick=${() => setNeu(true)}>
        <${Icon} name="plus" groesse=${20} /> Pool anlegen
      </button>
      ${neu && html`<${PoolBlatt} onSchliessen=${() => setNeu(false)} />`}
    </div>
  `;
}

// ---------- Ein einzelner Pool ----------

export function Pool({ teil }) {
  useDaten();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [offen, setOffen] = useState(null); // null | { neu: true } | { id }
  const pool = teil ? store.hole(teil) : null;
  const tag = heute();

  if (!pool || pool.geloeschtAm || pool.typ !== 'pool') {
    return html`
      <div class="seite">
        <section class="leer">
          <h2>Diesen Pool gibt es nicht mehr</h2>
          <button class="knopf" type="button" onClick=${() => geheZu('pools')}>Zu den Pools</button>
        </section>
      </div>
    `;
  }

  const liste = pools.eintraege(pool.id);
  const kategorie = pool.kategorieId ? store.hole(pool.kategorieId) : null;
  const kategorieDa = kategorie && !kategorie.geloeschtAm;

  const erledigt = (eintrag) => {
    const vorher = pools.markiereErledigt(eintrag.id, tag);
    const danach = store.hole(eintrag.id);
    melde(`„${eintrag.titel}“ erledigt, wieder dran: ${tagLesbar(danach.naechsteFaelligkeit)}`, {
      aktion: 'Rückgängig',
      beiAktion: () => pools.setzeZurueck(eintrag.id, vorher),
    });
  };

  return html`
    <div class="seite">
      <div class="leiste">
        <p class="text-leise">
          ${kategorieDa
            ? html`<i class="farb-tupfer" style=${`display:inline-block;margin-right:8px;background:${kategorie.farbe}`}></i>${kategorie.name}`
            : 'Ohne Kategorie'}
        </p>
        <button class="knopf-text" type="button" onClick=${() => setBearbeiten(true)}>Bearbeiten</button>
      </div>

      ${liste.length ? html`
        <ul class="gruppe">
          ${liste.map((e) => {
            const eingeplant = pools.offeneAufgabeZu(e);
            const an = pools.stehtAn(e, tag);
            const zuSpaet = e.naechsteFaelligkeit < tag;
            return html`
              <li class="aufgabe" key=${e.id}>
                <div class="aufgabe-zeile">
                  <button class="haken" type="button" aria-pressed="false" aria-label=${`${e.titel} als erledigt abhaken`} onClick=${() => erledigt(e)}>
                    <span class="haken-kreis"></span>
                  </button>
                  <button class="aufgabe-haupt" type="button" onClick=${() => setOffen({ id: e.id })}>
                    <span class="aufgabe-titel">${e.titel}</span>
                    <span class="aufgabe-meta">
                      <span><${Icon} name="repeat" groesse=${14} /> ${pools.abstandText(e)}</span>
                      <span class=${zuSpaet ? 'warnung' : an ? 'gold' : ''}>
                        <${Icon} name="calendar" groesse=${14} /> ${zuSpaet ? 'War dran:' : 'Dran:'} ${tagLesbar(e.naechsteFaelligkeit)}
                      </span>
                      ${eingeplant && html`<span>Als Aufgabe eingeplant</span>`}
                    </span>
                  </button>
                </div>
              </li>
            `;
          })}
        </ul>
      ` : html`
        <div class="gruppe"><p class="leer-zeile">Noch keine Einträge. Mit dem Plus legst du den ersten an.</p></div>
      `}

      <button class="knopf-plus" type="button" aria-label=${`Eintrag in „${pool.name}“ anlegen`} onClick=${() => setOffen({ neu: true })}>
        <${Icon} name="plus" groesse=${26} />
      </button>

      ${bearbeiten && html`<${PoolBlatt} pool=${pool} onSchliessen=${() => setBearbeiten(false)} />`}
      ${offen && html`<${EintragBlatt} pool=${pool} offen=${offen} onSchliessen=${() => setOffen(null)} />`}
    </div>
  `;
}

// ---------- Pool anlegen und bearbeiten ----------

function PoolBlatt({ pool = null, onSchliessen }) {
  const [name, setName] = useState(pool ? pool.name : '');
  const [kategorieId, setKategorieId] = useState(pool ? pool.kategorieId : null);
  const [icon, setIcon] = useState(pool ? pool.icon : 'spray-can');
  const [fehler, setFehler] = useState('');
  const kategorien = store.liste('kategorie').sort((a, b) => a.reihenfolge - b.reihenfolge);

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = name.trim();
    if (!sauber) {
      setFehler('Gib dem Pool einen Namen.');
      return;
    }
    if (pool) {
      store.aendern(pool.id, { name: sauber, kategorieId, icon });
      onSchliessen();
    } else {
      const neu = pools.neuerPool({ name: sauber, kategorieId, icon });
      onSchliessen();
      geheZu(`pool/${neu.id}`);
    }
  };

  const loeschen = () => {
    const zurueck = pools.loeschePool(pool.id);
    onSchliessen();
    geheZu('pools');
    melde(`„${pool.name}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: zurueck });
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${speichern}>${pool ? 'Änderungen speichern' : 'Pool anlegen'}</button>`;

  return html`
    <${Blatt} titel=${pool ? 'Pool bearbeiten' : 'Neuer Pool'} onSchliessen=${onSchliessen} fuss=${fuss}>
      <form class="formular" onSubmit=${speichern}>
        <label class="feld-gruppe">
          <span>Name</span>
          <input class="feld" type="text" maxlength="60" enterkeyhint="done" value=${name}
            placeholder="zum Beispiel Putzplan" onInput=${(e) => { setName(e.target.value); setFehler(''); }} />
        </label>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <label class="feld-gruppe">
          <span>Kategorie</span>
          <select class="feld" value=${kategorieId || ''} onChange=${(e) => setKategorieId(e.target.value || null)}>
            <option value="">Keine Kategorie</option>
            ${kategorien.map((k) => html`<option value=${k.id}>${k.name}</option>`)}
          </select>
        </label>

        <fieldset class="feld-gruppe">
          <legend>Icon</legend>
          <${IconWahl} wert=${icon} onWahl=${setIcon} />
        </fieldset>

        ${pool && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Pool mit allen Einträgen löschen
          </button>
        `}
      </form>
    <//>
  `;
}

// ---------- Eintrag anlegen und bearbeiten ----------

function EintragBlatt({ pool, offen, onSchliessen }) {
  const vorhanden = offen.id ? store.hole(offen.id) : null;
  const [titel, setTitel] = useState(vorhanden ? vorhanden.titel : '');
  const [intervall, setIntervall] = useState(vorhanden ? vorhanden.intervall : { n: 1, einheit: 'wochen' });
  const [modus, setModus] = useState(vorhanden ? vorhanden.modus : 'abErledigung');
  const [faellig, setFaellig] = useState(vorhanden ? vorhanden.naechsteFaelligkeit : heute());
  const [dauerMin, setDauerMin] = useState(vorhanden ? vorhanden.dauerMin : null);
  const [fehler, setFehler] = useState('');

  const speichern = (e) => {
    if (e) e.preventDefault();
    const sauber = titel.trim();
    if (!sauber) {
      setFehler('Gib dem Eintrag einen Namen.');
      return;
    }
    if (!Number.isInteger(intervall.n) || intervall.n < 1) {
      setFehler('Der Abstand muss mindestens 1 sein.');
      return;
    }
    const felder = { titel: sauber, intervall, modus, dauerMin, naechsteFaelligkeit: faellig || heute() };
    if (vorhanden) store.aendern(vorhanden.id, felder);
    else pools.neuerEintrag({ poolId: pool.id, ...felder });
    onSchliessen();
  };

  const loeschen = () => {
    const id = vorhanden.id;
    store.loeschen(id);
    onSchliessen();
    melde(`„${vorhanden.titel}“ gelöscht`, { aktion: 'Rückgängig', beiAktion: () => store.wiederherstellen(id) });
  };

  const fuss = html`<button class="knopf breit" type="button" onClick=${speichern}>${vorhanden ? 'Änderungen speichern' : 'Eintrag anlegen'}</button>`;

  return html`
    <${Blatt} titel=${vorhanden ? 'Eintrag bearbeiten' : `Neuer Eintrag in „${pool.name}“`} onSchliessen=${onSchliessen} fuss=${fuss}>
      <div class="formular">
        <form onSubmit=${speichern}>
          <input class="feld gross" type="text" maxlength="200" enterkeyhint="done" aria-label="Name des Eintrags"
            placeholder="zum Beispiel Bettwäsche wechseln" value=${titel}
            onInput=${(e) => { setTitel(e.target.value); setFehler(''); }} />
        </form>
        ${fehler && html`<p class="fehlertext" role="alert">${fehler}</p>`}

        <fieldset class="feld-gruppe">
          <legend>Abstand</legend>
          <${AbstandWahl} n=${intervall.n} einheit=${intervall.einheit} onAendern=${(a) => { setIntervall(a); setFehler(''); }} />
          <div class="wahl" role="group" aria-label="Rhythmus">
            <button type="button" class=${modus === 'abErledigung' ? 'aktiv' : ''} aria-pressed=${modus === 'abErledigung'} onClick=${() => setModus('abErledigung')}>
              Ab Erledigung
            </button>
            <button type="button" class=${modus === 'fest' ? 'aktiv' : ''} aria-pressed=${modus === 'fest'} onClick=${() => setModus('fest')}>
              Fester Rhythmus
            </button>
          </div>
          <p class="feld-hinweis">
            ${modus === 'abErledigung'
              ? 'Der Abstand zählt ab dem Tag, an dem du den Eintrag abhakst.'
              : 'Der Eintrag ist nach dem Kalender dran, egal wann du ihn zuletzt abgehakt hast.'}
          </p>
        </fieldset>

        <div class="feld-gruppe">
          <span id="faellig-name">${vorhanden ? 'Das nächste Mal dran am' : 'Zum ersten Mal dran am'}</span>
          <input class="feld" type="date" aria-labelledby="faellig-name" value=${faellig}
            onInput=${(e) => setFaellig(e.target.value)} />
          <p class="feld-hinweis">Der Vorschlag erscheint ab Montag dieser Woche, bei Abständen unter einer Woche erst an diesem Tag.</p>
        </div>

        <fieldset class="feld-gruppe">
          <legend>Dauer</legend>
          <${DauerWahl} wert=${dauerMin} onWahl=${setDauerMin} />
        </fieldset>

        ${vorhanden && html`
          <button class="knopf breit leise gefahr-text" type="button" onClick=${loeschen}>
            <${Icon} name="trash-2" groesse=${20} /> Eintrag löschen
          </button>
        `}
      </div>
    <//>
  `;
}
