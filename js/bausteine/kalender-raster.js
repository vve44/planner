// Das Stundenraster des Kalenders für einen oder mehrere Tage.
// Zeigt Termine und eingeplante Aufgaben als Blöcke, die Jetzt-Linie und oben je Tag
// die ganztägigen Termine und die Aufgaben ohne Uhrzeit.
// Aufgaben lassen sich per Drag & Drop einplanen: lang drücken, ziehen, ablegen.

import { html, useEffect, useRef, useState } from '../../bibliothek/preact-htm.js';
import { Icon } from './icon.js';
import { melde } from './fenster.js';
import { oeffneAufgabe } from './aufgabe-blatt.js';
import * as store from '../store.js';
import * as aufgaben from '../aufgaben.js';
import * as termine from '../termine.js';
import { heute, jetztMin, minZuZeit, zeitZuMin, wochentagKurz, datumAusText, aufhellen, tagLesbar } from '../hilfen.js';

const STUNDE_GROSS = 56;         // Höhe einer Stunde in Pixeln (vergrößerter Tag und breite 7-Tage-Ansicht)
const STUNDE_KLEIN = 44;         // Höhe einer Stunde, wenn alle 7 Tage nebeneinander stehen
const STUNDE_TAG = 36;           // Höhe einer Stunde in der Tagesansicht (Standard seit 9.2.0: mehr Stunden auf einen Blick)
export const SPALTE = 108;       // Breite eines Tages in der breiten 7-Tage-Ansicht
const RASTER_BEGINN = 6 * 60;    // Das Raster beginnt immer um 6 Uhr. Früheres steht als Schild im Tageskopf.
const OBEN = 10;                 // Freier Rand über der ersten Stundenlinie, damit ihre Uhrzeit Platz hat
const STANDARD_DAUER = 30;       // Blocklänge einer Aufgabe ohne Dauer, in Minuten
const SCHRITT = 15;              // Beim Ablegen rastet die Zeit auf 15 Minuten ein
const DRUECK_DAUER = 380;        // So lange muss der Finger ruhen, bevor das Ziehen beginnt
const TERMIN_FARBE = '#7ba6a5';  // Termine ohne Kategorie

let ziehtGerade = false;

// ---------- Blöcke nebeneinander anordnen, wenn sie sich überschneiden ----------

function ordneAn(eintraege, minHoeheMin) {
  const sortiert = [...eintraege].sort((a, b) => a.vonMin - b.vonMin || b.bisMin - a.bisMin);
  const fertig = [];
  let gruppe = [];
  let gruppeEnde = -1;
  const schliesse = () => {
    const spalten = Math.max(...gruppe.map((e) => e.spalte)) + 1;
    gruppe.forEach((e) => { e.spalten = spalten; });
    fertig.push(...gruppe);
    gruppe = [];
    gruppeEnde = -1;
  };
  sortiert.forEach((e) => {
    // Sehr kurze Blöcke brauchen trotzdem Platz für eine Zeile Text.
    e.platzBis = Math.max(e.bisMin, e.vonMin + minHoeheMin);
    if (gruppe.length && e.vonMin >= gruppeEnde) schliesse();
    const belegt = gruppe.filter((g) => g.platzBis > e.vonMin).map((g) => g.spalte);
    let spalte = 0;
    while (belegt.includes(spalte)) spalte += 1;
    e.spalte = spalte;
    gruppe.push(e);
    gruppeEnde = Math.max(gruppeEnde, e.platzBis);
  });
  if (gruppe.length) schliesse();
  return fertig;
}

function farbeVon(termin) {
  const kategorie = termin.kategorieId ? store.hole(termin.kategorieId) : null;
  return kategorie && !kategorie.geloeschtAm ? kategorie.farbe : TERMIN_FARBE;
}

// ---------- Das Raster ----------
//   tage      – Liste der Kalendertage
//   modus     – 'tag' (ein Tag), 'kompakt' (alle Tage passen nebeneinander auf den Bildschirm)
//   eng       – nur bei 'tag': kleinere Stunden, damit mehr vom Tag auf den Bildschirm passt
//               oder 'breit' (breitere Spalten, seitlich scrollen)
//   onTermin  – ein Termin wurde angetippt (Vorkommen)
//   onLeer    – eine freie Stelle wurde angetippt (Tag, Minute)
//   onTag     – das Datum im Tageskopf wurde angetippt
//
// Aufbau: Der Tageskopf steht fest über dem Raster. Darunter scrollt ein Bereich nur
// senkrecht, in ihm liegt ein Bereich, der nur waagrecht scrollt. So folgt das iPhone
// je Wischbewegung nur einer Richtung. Der Tageskopf wandert beim seitlichen Scrollen mit.

export function Raster({ tage, modus = 'tag', eng = false, onTermin, onLeer, onTag }) {
  const rahmen = useRef(null);
  const senkrecht = useRef(null);
  const waagrecht = useRef(null);
  const band = useRef(null);
  const [, setTakt] = useState(0);
  const ablegen = useRef(null);
  const tag0 = heute();
  const breit = modus === 'breit';
  const kompakt = modus === 'kompakt';
  const klein = eng && modus === 'tag';
  const stunde = kompakt ? STUNDE_KLEIN : klein ? STUNDE_TAG : STUNDE_GROSS;
  // Mindesthöhe eines Blocks und ab wann ein Block nur noch den Titel zeigt (in Pixeln)
  const minHoehe = kompakt || klein ? 18 : 22;
  const zweiZeilen = kompakt ? 26 : klein ? 30 : 35;

  ablegen.current = (id, ziel) => {
    const aufgabe = store.hole(id);
    if (!aufgabe) return;
    const vorher = { plandatum: aufgabe.plandatum, startzeit: aufgabe.startzeit || null };
    if (vorher.plandatum === ziel.datum && vorher.startzeit === ziel.startzeit) return;
    store.aendern(id, { plandatum: ziel.datum, startzeit: ziel.startzeit });
    melde(ziel.startzeit ? `Eingeplant: ${tagLesbar(ziel.datum)}, ${ziel.startzeit} Uhr` : `${tagLesbar(ziel.datum)}, ohne Uhrzeit`, {
      aktion: 'Rückgängig',
      beiAktion: () => store.aendern(id, vorher),
    });
  };

  const liste = termine.vorkommenIm(tage[0], tage[tage.length - 1]);
  const alleAufgaben = aufgaben.alleAufgaben();
  const daten = tage.map((tag) => {
    const { ganztags, zeitlich } = termine.eintraegeAm(tag, liste);
    const eigene = alleAufgaben.filter((a) => a.plandatum === tag);
    const ohneZeit = aufgaben.sortiere(eigene.filter((a) => !a.startzeit && !a.erledigtAm));
    const alle = [
      ...zeitlich.map((v) => ({ art: 'termin', v, vonMin: v.vonMin, bisMin: v.bisMin, echtVon: v.vonMin })),
      ...eigene.filter((a) => a.startzeit).map((a) => {
        const von = zeitZuMin(a.startzeit);
        return { art: 'aufgabe', a, vonMin: von, bisMin: Math.min(1440, von + (a.dauerMin || STANDARD_DAUER)), echtVon: von };
      }),
    ];
    // Was vor 6 Uhr endet, steht als Schild mit Uhrzeit im Tageskopf.
    // Was vor 6 Uhr beginnt und danach endet, beginnt im Raster an der oberen Kante.
    const frueh = alle.filter((e) => e.bisMin <= RASTER_BEGINN).sort((x, y) => x.vonMin - y.vonMin);
    const bloecke = ordneAn(
      alle.filter((e) => e.bisMin > RASTER_BEGINN).map((e) => ({ ...e, vonMin: Math.max(e.vonMin, RASTER_BEGINN) })),
      Math.ceil(((minHoehe + 2) / stunde) * 60),
    );
    return { tag, ganztags, ohneZeit, frueh, bloecke };
  });

  const beginn = RASTER_BEGINN;
  const ersteStunde = beginn / 60;
  const hoehe = OBEN + (24 - ersteStunde) * stunde;
  const lage = (min) => OBEN + ((min - beginn) / 60) * stunde;

  const blockStil = (e) => {
    const breite = 100 / e.spalten;
    const h = Math.max(minHoehe, ((e.bisMin - e.vonMin) / 60) * stunde - 2);
    return `top:${lage(e.vonMin)}px;height:${h}px;left:calc(${e.spalte * breite}% + 1px);width:calc(${breite}% - ${kompakt ? 2 : 3}px);`;
  };
  // Kurze Blöcke haben nur Platz für eine Zeile: Sie zeigen den Titel ohne Uhrzeit.
  const istKurz = (e) => ((e.bisMin - e.vonMin) / 60) * stunde - 2 < zweiZeilen;

  // Drag & Drop einrichten (einmal), Tageskopf mitführen, Jetzt-Linie jede Minute nachführen.
  useEffect(() => {
    const loese = richteZiehenEin(rahmen.current, (id, ziel) => ablegen.current(id, ziel));
    const quer = waagrecht.current;
    const fuehreMit = () => { if (band.current) band.current.style.transform = `translateX(${-quer.scrollLeft}px)`; };
    quer.addEventListener('scroll', fuehreMit, { passive: true });
    const uhr = setInterval(() => { if (!ziehtGerade) setTakt((n) => n + 1); }, 60000);
    return () => { loese(); quer.removeEventListener('scroll', fuehreMit); clearInterval(uhr); };
  }, []);

  // Beim Öffnen und beim Wechsel des Zeitraums zur passenden Stelle springen:
  // heute kurz vor die aktuelle Uhrzeit, sonst an den Anfang des Rasters.
  useEffect(() => {
    const index = tage.indexOf(tag0);
    if (senkrecht.current) senkrecht.current.scrollTop = index >= 0 ? Math.max(0, lage(jetztMin() - 90)) : 0;
    if (waagrecht.current) {
      waagrecht.current.scrollLeft = breit && index > 0 ? index * SPALTE - 8 : 0;
      if (band.current) band.current.style.transform = `translateX(${-waagrecht.current.scrollLeft}px)`;
    }
  }, [tage[0], tage.length, modus, eng]);

  const spaltenStil = breit ? `flex:none;width:${SPALTE}px;` : 'flex:1;min-width:0;';
  const bandStil = breit ? `width:${tage.length * SPALTE}px;` : 'width:100%;';
  const maxOhne = modus === 'tag' ? 50 : 2;

  const leerGetippt = (e, tag) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const min = beginn + Math.floor((((e.clientY - r.top - OBEN) / stunde) * 60) / 30) * 30;
    onLeer(tag, Math.max(beginn, Math.min(23 * 60, min)));
  };

  return html`
    <div class=${`raster-rahmen ${modus} ${klein ? 'eng' : ''}`} ref=${rahmen} data-stunde=${stunde} data-beginn=${beginn} style=${`--stunde:${stunde}px;--raster-oben:${OBEN}px`}>
      <div class="raster-kopf">
        <div class="raster-ecke"></div>
        <div class="kopf-fenster">
          <div class="kopf-band" ref=${band} style=${bandStil}>
            ${daten.map((d) => html`
              <div class=${`tag-kopf ${d.tag === tag0 ? 'heute' : ''}`} style=${spaltenStil} data-datum=${d.tag} key=${d.tag}>
                ${tage.length > 1 && html`
                  <button type="button" class="tag-kopf-datum" aria-label=${`${tagLesbar(d.tag)} in der Tagesansicht öffnen`}
                    onClick=${() => onTag && onTag(d.tag)}>
                    <span>${wochentagKurz(d.tag)}</span>
                    <strong>${datumAusText(d.tag).getDate()}</strong>
                  </button>
                `}
                ${d.ganztags.map((v) => html`
                  <button type="button" class="ganztag-chip" key=${`${v.termin.id}-${v.start}`} data-lang=${`termin:${v.termin.id}:${v.start}`}
                    style=${`background:${aufhellen(farbeVon(v.termin), 0.55)};border-color:${farbeVon(v.termin)}`}
                    onClick=${() => onTermin(v)}>
                    ${v.termin.titel}
                  </button>
                `)}
                ${d.frueh.map((e) => (e.art === 'termin' ? html`
                  <button type="button" class="ganztag-chip frueh" key=${`${e.v.termin.id}-${e.v.start}`} data-lang=${`termin:${e.v.termin.id}:${e.v.start}`}
                    style=${`background:${aufhellen(farbeVon(e.v.termin), 0.55)};border-color:${farbeVon(e.v.termin)}`}
                    aria-label=${`${e.v.termin.titel}, ${termine.zeitText(e.v, d.tag)}`}
                    onClick=${() => onTermin(e.v)}>
                    <small>${minZuZeit(e.echtVon)}</small> ${e.v.termin.titel}
                  </button>
                ` : html`
                  <button type="button" class=${`frueh-chip ${e.a.erledigtAm ? 'erledigt' : ''}`} key=${e.a.id}
                    data-zieh-id=${e.a.id} data-dauer=${e.a.dauerMin || STANDARD_DAUER} data-titel=${e.a.titel}
                    aria-label=${`Aufgabe ${e.a.titel}, ${e.a.startzeit} Uhr. Lang drücken und ins Raster ziehen.`}
                    onClick=${() => oeffneAufgabe({ id: e.a.id })}>
                    <small>${e.a.startzeit}</small> <span>${e.a.titel}</span>
                  </button>
                `))}
                ${d.ohneZeit.slice(0, maxOhne).map((a) => html`
                  <button type="button" class="ohne-chip" key=${a.id} data-zieh-id=${a.id} data-dauer=${a.dauerMin || STANDARD_DAUER} data-titel=${a.titel}
                    aria-label=${`${a.titel}, ohne Uhrzeit. Lang drücken und ins Raster ziehen.`}
                    onClick=${() => oeffneAufgabe({ id: a.id })}>
                    ${!kompakt && html`<${Icon} name="grip-vertical" groesse=${13} />`}
                    <span>${a.titel}</span>
                  </button>
                `)}
                ${d.ohneZeit.length > maxOhne && html`
                  <span class="ohne-mehr">+${d.ohneZeit.length - maxOhne}${kompakt ? '' : ' weitere'}</span>
                `}
                ${tage.length === 1 && !d.ganztags.length && !d.ohneZeit.length && !d.frueh.length && html`
                  <span class="ohne-mehr">Keine ganztägigen Termine, keine Aufgaben ohne Uhrzeit</span>
                `}
              </div>
            `)}
          </div>
        </div>
      </div>

      <div class="raster-senkrecht" ref=${senkrecht}>
        <div class="raster-koerper" style=${`height:${hoehe}px`}>
          <div class="stunden" aria-hidden="true">
            ${Array.from({ length: 24 - ersteStunde }, (_, i) => ersteStunde + i).map((h) => html`
              <span style=${`top:${lage(h * 60)}px`}>${String(h).padStart(2, '0')}:00</span>
            `)}
          </div>
          <div class="raster-waagrecht" ref=${waagrecht}>
            <div class="spalten" style=${`${bandStil}height:${hoehe}px`}>
              ${daten.map((d) => html`
                <div class=${`tag-spalte ${d.tag === tag0 ? 'heute' : ''}`} style=${spaltenStil} data-datum=${d.tag} key=${d.tag}
                  onClick=${(e) => leerGetippt(e, d.tag)}>
                  ${d.bloecke.map((e) => {
                    const kurz = istKurz(e);
                    if (e.art === 'termin') {
                      const farbe = farbeVon(e.v.termin);
                      return html`
                        <button type="button" class=${`block termin ${kurz ? 'kurz' : ''}`} key=${`${e.v.termin.id}-${e.v.start}`}
                          data-lang=${`termin:${e.v.termin.id}:${e.v.start}`}
                          style=${`${blockStil(e)}background:${aufhellen(farbe, 0.6)};border-left-color:${farbe};`}
                          aria-label=${`${e.v.termin.titel}, ${termine.zeitText(e.v, d.tag)}`}
                          onClick=${() => onTermin(e.v)}>
                          <strong>${e.v.termin.titel}</strong>
                          ${!kompakt && !kurz && html`<span>${termine.zeitText(e.v, d.tag)}</span>`}
                        </button>
                      `;
                    }
                    const fertig = Boolean(e.a.erledigtAm);
                    const zeit = `${e.a.startzeit} – ${minZuZeit(Math.min(1439, e.bisMin))}`;
                    return html`
                      <div class=${`block aufgabe ${fertig ? 'erledigt' : ''} ${kurz ? 'kurz' : ''}`} key=${e.a.id} style=${blockStil(e)}
                        data-zieh-id=${e.a.id} data-dauer=${e.a.dauerMin || STANDARD_DAUER} data-titel=${e.a.titel}>
                        ${!kompakt && html`
                          <button type="button" class="block-haken" aria-pressed=${fertig}
                            aria-label=${fertig ? `${e.a.titel} wieder öffnen` : `${e.a.titel} abhaken`}
                            onClick=${(ev) => { ev.stopPropagation(); aufgaben.schalteErledigt(e.a.id); }}>
                            <span>${fertig && html`<${Icon} name="check" groesse=${11} strich=${3} />`}</span>
                          </button>
                        `}
                        <button type="button" class="block-text" aria-label=${`Aufgabe ${e.a.titel}, ${zeit}`} onClick=${() => oeffneAufgabe({ id: e.a.id })}>
                          <strong>${e.a.titel}</strong>
                          ${!kompakt && !kurz && html`<span>${zeit}</span>`}
                        </button>
                      </div>
                    `;
                  })}
                  ${d.tag === tag0 && html`<div class="jetzt-linie" style=${`top:${lage(jetztMin())}px`}></div>`}
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------- Drag & Drop ----------
// Finger: lang drücken (ohne zu wischen), dann ziehen. Maus: einfach ziehen.
// Ablegen im Raster setzt Tag und Uhrzeit, Ablegen oben im Tageskopf entfernt die Uhrzeit.

function richteZiehenEin(rahmen, onAblegen) {
  const buehne = rahmen.closest('.kalender') || document.getElementById('app');
  const stunde = () => Number(rahmen.dataset.stunde) || STUNDE_GROSS;
  const beginn = () => Number(rahmen.dataset.beginn) || 0;
  let kandidat = null;
  let zug = null;
  let gesperrtBis = 0;
  let letzte = { x: 0, y: 0 };
  let rollUhr = null;
  let amRandSeit = 0;

  const quelle = (ziel) => (ziel instanceof Element ? ziel.closest('[data-zieh-id]') : null);

  function findeZiel(x, y) {
    const unter = document.elementFromPoint(x, y);
    if (!unter || !rahmen.contains(unter)) return null;
    const spalte = unter.closest('.tag-spalte');
    if (spalte) {
      const r = spalte.getBoundingClientRect();
      let min = beginn() + Math.round((((y - zug.versatzY - r.top - OBEN) / stunde()) * 60) / SCHRITT) * SCHRITT;
      min = Math.max(beginn(), Math.min(1440 - SCHRITT, min));
      return { art: 'zeit', datum: spalte.dataset.datum, min, spalte };
    }
    const kopf = unter.closest('.tag-kopf');
    if (kopf) return { art: 'ohne', datum: kopf.dataset.datum, kopf };
    return null;
  }

  function bewege(x, y) {
    letzte = { x, y };
    // Das kleine Schild schwebt über dem Finger, damit man es sieht.
    const links = Math.max(6, Math.min(window.innerWidth - zug.geistBreite - 6, x - zug.geistBreite / 2));
    zug.geist.style.transform = `translate(${links}px, ${Math.max(6, y - 62)}px)`;
    const ziel = findeZiel(x, y);
    rahmen.querySelectorAll('.ablage-ziel').forEach((e) => e.classList.remove('ablage-ziel'));
    if (ziel && ziel.art === 'zeit') {
      const v = zug.vorschau;
      v.style.top = `${OBEN + ((ziel.min - beginn()) / 60) * stunde()}px`;
      v.style.height = `${Math.max(18, (zug.dauer / 60) * stunde())}px`;
      v.textContent = minZuZeit(ziel.min);
      if (v.parentNode !== ziel.spalte) ziel.spalte.appendChild(v);
    } else {
      zug.vorschau.remove();
      if (ziel) ziel.kopf.classList.add('ablage-ziel');
    }
    zug.ziel = ziel;
  }

  // Am Rand weiterrollen, solange gezogen wird.
  function rolle() {
    if (!zug) return;
    const hoch = rahmen.querySelector('.raster-senkrecht');
    const quer = rahmen.querySelector('.raster-waagrecht');
    if (!hoch || !quer) return;
    const r = hoch.getBoundingClientRect();
    const q = quer.getBoundingClientRect();
    const { x, y } = letzte;
    let dy = 0;
    let dx = 0;
    if (y > r.bottom - 54) dy = 12;
    else if (y > r.top && y < r.top + 40) dy = -12;
    if (x > q.right - 30) dx = 12;
    else if (x < q.left + 24) dx = -12;
    if (!dy && !dx) {
      amRandSeit = 0;
      return;
    }
    // Erst rollen, wenn der Finger kurz am Rand verweilt. Sonst würde schon das
    // Durchqueren des Randes (zum Beispiel aus der oberen Leiste heraus) rollen.
    if (!amRandSeit) amRandSeit = Date.now();
    if (Date.now() - amRandSeit < 280) return;
    const vorher = [hoch.scrollTop, quer.scrollLeft];
    hoch.scrollTop += dy;
    quer.scrollLeft += dx;
    if (vorher[0] !== hoch.scrollTop || vorher[1] !== quer.scrollLeft) bewege(x, y);
  }

  function beginne(el, x, y) {
    const r = el.getBoundingClientRect();
    const istBlock = el.classList.contains('block');
    // Statt des ganzen Blocks wandert ein kleines Schild mit dem Titel mit.
    // Wo die Aufgabe landet, zeigt der gestrichelte Rahmen im Raster.
    const geist = document.createElement('div');
    geist.className = 'zieh-geist';
    geist.textContent = el.dataset.titel || '';
    buehne.appendChild(geist);
    const vorschau = document.createElement('div');
    vorschau.className = 'zieh-vorschau';
    zug = {
      id: el.dataset.ziehId,
      el,
      geist,
      vorschau,
      dauer: Number(el.dataset.dauer) || STANDARD_DAUER,
      geistBreite: geist.offsetWidth,
      // Bei einem Block bleibt der Finger an derselben Stelle des Blocks.
      // Bei einer Aufgabe aus der oberen Leiste liegt der Blockanfang knapp über dem Finger.
      versatzY: istBlock ? y - r.top : 14,
      ziel: null,
    };
    ziehtGerade = true;
    amRandSeit = 0;
    el.classList.add('wird-gezogen');
    rahmen.classList.add('zieht');
    if (navigator.vibrate) navigator.vibrate(8);
    bewege(x, y);
    rollUhr = setInterval(rolle, 30);
  }

  function beende(abbruch) {
    if (!zug) return;
    clearInterval(rollUhr);
    const { id, ziel, el, geist, vorschau } = zug;
    geist.remove();
    vorschau.remove();
    el.classList.remove('wird-gezogen');
    rahmen.classList.remove('zieht');
    rahmen.querySelectorAll('.ablage-ziel').forEach((e) => e.classList.remove('ablage-ziel'));
    zug = null;
    ziehtGerade = false;
    // Der Tipp, der auf das Loslassen folgt, soll kein Fenster öffnen.
    gesperrtBis = Date.now() + 450;
    if (!abbruch && ziel) {
      onAblegen(id, { datum: ziel.datum, startzeit: ziel.art === 'zeit' ? minZuZeit(ziel.min) : null });
    }
  }

  function verwirf() {
    if (kandidat) {
      clearTimeout(kandidat.uhr);
      kandidat = null;
    }
  }

  // Finger
  const fingerStart = (e) => {
    verwirf();
    if (e.touches.length !== 1) return;
    const el = quelle(e.target);
    if (!el) return;
    const t = e.touches[0];
    kandidat = { el, x: t.clientX, y: t.clientY };
    kandidat.uhr = setTimeout(() => {
      const k = kandidat;
      kandidat = null;
      if (k) beginne(k.el, k.x, k.y);
    }, DRUECK_DAUER);
  };
  const fingerBewegt = (e) => {
    const t = e.touches[0];
    if (zug) {
      e.preventDefault(); // verhindert, dass die Seite beim Ziehen mitscrollt
      bewege(t.clientX, t.clientY);
      return;
    }
    // Wer vor Ablauf der Zeit wischt, will scrollen und nicht ziehen.
    if (kandidat && Math.hypot(t.clientX - kandidat.x, t.clientY - kandidat.y) > 10) verwirf();
  };
  const fingerEnde = (e) => {
    verwirf();
    if (zug) {
      e.preventDefault();
      beende(false);
    }
  };
  const fingerAbbruch = () => {
    verwirf();
    beende(true);
  };

  // Maus
  const mausRunter = (e) => {
    if (e.button !== 0 || zug) return;
    const el = quelle(e.target);
    if (el) kandidat = { el, x: e.clientX, y: e.clientY, maus: true };
  };
  const mausBewegt = (e) => {
    if (zug) {
      e.preventDefault();
      bewege(e.clientX, e.clientY);
    } else if (kandidat && kandidat.maus && Math.hypot(e.clientX - kandidat.x, e.clientY - kandidat.y) > 5) {
      const k = kandidat;
      kandidat = null;
      beginne(k.el, e.clientX, e.clientY);
    }
  };
  const mausHoch = () => {
    if (kandidat && kandidat.maus) kandidat = null;
    if (zug) beende(false);
  };

  const klick = (e) => {
    if (Date.now() < gesperrtBis) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const menue = (e) => {
    if (quelle(e.target)) e.preventDefault();
  };

  rahmen.addEventListener('touchstart', fingerStart, { passive: true });
  rahmen.addEventListener('touchmove', fingerBewegt, { passive: false });
  rahmen.addEventListener('touchend', fingerEnde);
  rahmen.addEventListener('touchcancel', fingerAbbruch);
  rahmen.addEventListener('mousedown', mausRunter);
  document.addEventListener('mousemove', mausBewegt);
  document.addEventListener('mouseup', mausHoch);
  rahmen.addEventListener('click', klick, true);
  rahmen.addEventListener('contextmenu', menue);

  return () => {
    verwirf();
    beende(true);
    rahmen.removeEventListener('touchstart', fingerStart);
    rahmen.removeEventListener('touchmove', fingerBewegt);
    rahmen.removeEventListener('touchend', fingerEnde);
    rahmen.removeEventListener('touchcancel', fingerAbbruch);
    rahmen.removeEventListener('mousedown', mausRunter);
    document.removeEventListener('mousemove', mausBewegt);
    document.removeEventListener('mouseup', mausHoch);
    rahmen.removeEventListener('click', klick, true);
    rahmen.removeEventListener('contextmenu', menue);
  };
}
