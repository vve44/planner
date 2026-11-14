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

export const STUNDE = 56;        // Höhe einer Stunde in Pixeln
export const SPALTE = 108;       // Breite eines Tages in der 7-Tage-Ansicht
const STANDARD_DAUER = 30;       // Blocklänge einer Aufgabe ohne Dauer, in Minuten
const SCHRITT = 15;              // Beim Ablegen rastet die Zeit auf 15 Minuten ein
const DRUECK_DAUER = 380;        // So lange muss der Finger ruhen, bevor das Ziehen beginnt
const TERMIN_FARBE = '#7ba6a5';  // Termine ohne Kategorie

let ziehtGerade = false;

// ---------- Blöcke nebeneinander anordnen, wenn sie sich überschneiden ----------

function ordneAn(eintraege) {
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
    e.platzBis = Math.max(e.bisMin, e.vonMin + 25);
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

function blockStil(e) {
  const breite = 100 / e.spalten;
  const hoehe = Math.max(22, ((e.bisMin - e.vonMin) / 60) * STUNDE - 2);
  return `top:${(e.vonMin / 60) * STUNDE}px;height:${hoehe}px;left:calc(${e.spalte * breite}% + 1px);width:calc(${breite}% - 3px);`;
}

function farbeVon(termin) {
  const kategorie = termin.kategorieId ? store.hole(termin.kategorieId) : null;
  return kategorie && !kategorie.geloeschtAm ? kategorie.farbe : TERMIN_FARBE;
}

// ---------- Das Raster ----------
//   tage      – Liste der Kalendertage
//   breit     – feste Spaltenbreite mit seitlichem Scrollen (7-Tage-Ansicht)
//   onTermin  – ein Termin wurde angetippt (Vorkommen)
//   onLeer    – eine freie Stelle wurde angetippt (Tag, Minute)

export function Raster({ tage, breit = false, onTermin, onLeer }) {
  const rahmen = useRef(null);
  const [, setTakt] = useState(0);
  const ablegen = useRef(null);
  const tag0 = heute();

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

  // Drag & Drop einrichten (einmal), Jetzt-Linie jede Minute nachführen.
  useEffect(() => {
    const loese = richteZiehenEin(rahmen.current, (id, ziel) => ablegen.current(id, ziel));
    const uhr = setInterval(() => { if (!ziehtGerade) setTakt((n) => n + 1); }, 60000);
    return () => { loese(); clearInterval(uhr); };
  }, []);

  // Beim Öffnen und beim Wechsel des Zeitraums zur passenden Uhrzeit springen.
  useEffect(() => {
    const el = rahmen.current;
    if (!el) return;
    const index = tage.indexOf(tag0);
    const basis = index >= 0 ? jetztMin() : 8 * 60;
    el.scrollTop = Math.max(0, ((basis - 90) / 60) * STUNDE);
    el.scrollLeft = breit && index > 0 ? index * SPALTE - 8 : 0;
  }, [tage[0], tage.length]);

  const liste = termine.vorkommenIm(tage[0], tage[tage.length - 1]);
  const alleAufgaben = aufgaben.alleAufgaben();
  const daten = tage.map((tag) => {
    const { ganztags, zeitlich } = termine.eintraegeAm(tag, liste);
    const eigene = alleAufgaben.filter((a) => a.plandatum === tag);
    const ohneZeit = aufgaben.sortiere(eigene.filter((a) => !a.startzeit && !a.erledigtAm));
    const bloecke = ordneAn([
      ...zeitlich.map((v) => ({ art: 'termin', v, vonMin: v.vonMin, bisMin: v.bisMin })),
      ...eigene.filter((a) => a.startzeit).map((a) => {
        const von = zeitZuMin(a.startzeit);
        return { art: 'aufgabe', a, vonMin: von, bisMin: Math.min(1440, von + (a.dauerMin || STANDARD_DAUER)) };
      }),
    ]);
    return { tag, ganztags, ohneZeit, bloecke };
  });

  const spaltenStil = breit ? `flex:none;width:${SPALTE}px;` : 'flex:1;min-width:0;';
  const maxOhne = breit ? 2 : 50;

  const leerGetippt = (e, tag) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((((e.clientY - r.top) / STUNDE) * 60) / 30) * 30;
    onLeer(tag, Math.max(0, Math.min(23 * 60, min)));
  };

  return html`
    <div class=${`raster-rahmen ${breit ? 'breit' : ''}`} ref=${rahmen}>
      <div class="raster" style=${breit ? `width:${46 + tage.length * SPALTE}px` : ''}>
        <div class="raster-kopf">
          <div class="raster-ecke"></div>
          ${daten.map((d) => html`
            <div class=${`tag-kopf ${d.tag === tag0 ? 'heute' : ''}`} style=${spaltenStil} data-datum=${d.tag} key=${d.tag}>
              ${tage.length > 1 && html`
                <div class="tag-kopf-datum">
                  <span>${wochentagKurz(d.tag)}</span>
                  <strong>${datumAusText(d.tag).getDate()}</strong>
                </div>
              `}
              ${d.ganztags.map((v) => html`
                <button type="button" class="ganztag-chip" key=${`${v.termin.id}-${v.start}`}
                  style=${`background:${aufhellen(farbeVon(v.termin), 0.55)};border-color:${farbeVon(v.termin)}`}
                  onClick=${() => onTermin(v)}>
                  ${v.termin.titel}
                </button>
              `)}
              ${d.ohneZeit.slice(0, maxOhne).map((a) => html`
                <button type="button" class="ohne-chip" key=${a.id} data-zieh-id=${a.id} data-dauer=${a.dauerMin || STANDARD_DAUER}
                  aria-label=${`${a.titel}, ohne Uhrzeit. Lang drücken und ins Raster ziehen.`}
                  onClick=${() => oeffneAufgabe({ id: a.id })}>
                  <${Icon} name="grip-vertical" groesse=${13} />
                  <span>${a.titel}</span>
                </button>
              `)}
              ${d.ohneZeit.length > maxOhne && html`<span class="ohne-mehr">+${d.ohneZeit.length - maxOhne} weitere</span>`}
              ${tage.length === 1 && !d.ganztags.length && !d.ohneZeit.length && html`
                <span class="ohne-mehr">Keine ganztägigen Termine, keine Aufgaben ohne Uhrzeit</span>
              `}
            </div>
          `)}
        </div>

        <div class="raster-koerper" style=${`height:${24 * STUNDE}px`}>
          <div class="stunden" aria-hidden="true">
            ${Array.from({ length: 23 }, (_, i) => i + 1).map((h) => html`
              <span style=${`top:${h * STUNDE}px`}>${String(h).padStart(2, '0')}:00</span>
            `)}
          </div>
          ${daten.map((d) => html`
            <div class=${`tag-spalte ${d.tag === tag0 ? 'heute' : ''}`} style=${spaltenStil} data-datum=${d.tag} key=${d.tag}
              onClick=${(e) => leerGetippt(e, d.tag)}>
              ${d.bloecke.map((e) => {
                if (e.art === 'termin') {
                  const farbe = farbeVon(e.v.termin);
                  return html`
                    <button type="button" class="block termin" key=${`${e.v.termin.id}-${e.v.start}`}
                      style=${`${blockStil(e)}background:${aufhellen(farbe, 0.6)};border-left-color:${farbe};`}
                      onClick=${() => onTermin(e.v)}>
                      <strong>${e.v.termin.titel}</strong>
                      <span>${termine.zeitText(e.v, d.tag)}</span>
                    </button>
                  `;
                }
                const fertig = Boolean(e.a.erledigtAm);
                return html`
                  <div class=${`block aufgabe ${fertig ? 'erledigt' : ''}`} key=${e.a.id} style=${blockStil(e)}
                    data-zieh-id=${e.a.id} data-dauer=${e.a.dauerMin || STANDARD_DAUER}>
                    <button type="button" class="block-haken" aria-pressed=${fertig}
                      aria-label=${fertig ? `${e.a.titel} wieder öffnen` : `${e.a.titel} abhaken`}
                      onClick=${(ev) => { ev.stopPropagation(); aufgaben.schalteErledigt(e.a.id); }}>
                      <span>${fertig && html`<${Icon} name="check" groesse=${11} strich=${3} />`}</span>
                    </button>
                    <button type="button" class="block-text" onClick=${() => oeffneAufgabe({ id: e.a.id })}>
                      <strong>${e.a.titel}</strong>
                      <span>${e.a.startzeit} – ${minZuZeit(Math.min(1439, e.bisMin))}</span>
                    </button>
                  </div>
                `;
              })}
              ${d.tag === tag0 && html`<div class="jetzt-linie" style=${`top:${(jetztMin() / 60) * STUNDE}px`}></div>`}
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

// ---------- Drag & Drop ----------
// Finger: lang drücken (ohne zu wischen), dann ziehen. Maus: einfach ziehen.
// Ablegen im Raster setzt Tag und Uhrzeit, Ablegen oben im Tageskopf entfernt die Uhrzeit.

function richteZiehenEin(rahmen, onAblegen) {
  const app = document.getElementById('app');
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
      let min = Math.round((((y - zug.versatzY - r.top) / STUNDE) * 60) / SCHRITT) * SCHRITT;
      min = Math.max(0, Math.min(1440 - SCHRITT, min));
      return { art: 'zeit', datum: spalte.dataset.datum, min, spalte };
    }
    const kopf = unter.closest('.tag-kopf');
    if (kopf) return { art: 'ohne', datum: kopf.dataset.datum, kopf };
    return null;
  }

  function bewege(x, y) {
    letzte = { x, y };
    zug.geist.style.transform = `translate(${x - zug.versatzX}px, ${y - zug.versatzY}px)`;
    const ziel = findeZiel(x, y);
    rahmen.querySelectorAll('.ablage-ziel').forEach((e) => e.classList.remove('ablage-ziel'));
    if (ziel && ziel.art === 'zeit') {
      const v = zug.vorschau;
      v.style.top = `${(ziel.min / 60) * STUNDE}px`;
      v.style.height = `${Math.max(22, (zug.dauer / 60) * STUNDE)}px`;
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
    const r = rahmen.getBoundingClientRect();
    const kopf = rahmen.querySelector('.raster-kopf');
    const oben = r.top + (kopf ? kopf.offsetHeight : 0);
    const { x, y } = letzte;
    let dy = 0;
    let dx = 0;
    if (y > r.bottom - 54) dy = 12;
    else if (y > oben && y < oben + 40) dy = -12;
    if (x > r.right - 34) dx = 12;
    else if (x < r.left + 46 + 26) dx = -12;
    if (!dy && !dx) {
      amRandSeit = 0;
      return;
    }
    // Erst rollen, wenn der Finger kurz am Rand verweilt. Sonst würde schon das
    // Durchqueren des Randes (zum Beispiel aus der oberen Leiste heraus) rollen.
    if (!amRandSeit) amRandSeit = Date.now();
    if (Date.now() - amRandSeit < 280) return;
    const vorher = [rahmen.scrollTop, rahmen.scrollLeft];
    rahmen.scrollTop += dy;
    rahmen.scrollLeft += dx;
    if (vorher[0] !== rahmen.scrollTop || vorher[1] !== rahmen.scrollLeft) bewege(x, y);
  }

  function beginne(el, x, y) {
    const r = el.getBoundingClientRect();
    const istBlock = el.classList.contains('block');
    const geist = el.cloneNode(true);
    geist.removeAttribute('data-zieh-id');
    geist.removeAttribute('style');
    geist.classList.add('zieh-geist');
    geist.style.width = `${r.width}px`;
    geist.style.height = `${r.height}px`;
    app.appendChild(geist);
    const vorschau = document.createElement('div');
    vorschau.className = 'zieh-vorschau';
    zug = {
      id: el.dataset.ziehId,
      el,
      geist,
      vorschau,
      dauer: Number(el.dataset.dauer) || STANDARD_DAUER,
      versatzX: x - r.left,
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
