// Karten im Board mit dem Finger (oder der Maus) verschieben.
// Finger kurz auf der Karte halten, dann ziehen. Dem Finger folgt ein kleines Schild mit dem
// Titel. Eine Linie zeigt, wo die Karte landet. Am Rand rollt das Board weiter.
//
//   wurzel      – das Element des Boards
//   onAblegen   – (aufgabeId, spalteId, index) index zählt ohne die gezogene Karte

const DRUECK_DAUER = 380;   // so lange muss der Finger ruhen
const RAND_WARTEN = 280;    // erst nach dieser Zeit am Rand wird gerollt

export function richteKartenZiehenEin(wurzel, onAblegen) {
  let warte = null;        // { el, x, y, uhr } solange der Finger noch ruht
  let zug = null;          // läuft gerade ein Zug: { el, id, geist, geistBreite, ziel }
  let letzte = { x: 0, y: 0 };
  let rollUhr = null;
  let amRandSeit = 0;
  let klickSperreBis = 0;

  const raeumeMarken = () => {
    wurzel.querySelectorAll('.einfuegen-davor, .einfuegen-ende, .ablage-ziel').forEach((el) => {
      el.classList.remove('einfuegen-davor', 'einfuegen-ende', 'ablage-ziel');
    });
  };

  // Wohin würde die Karte fallen? { spalteId, index, el (Karte davor oder null), liste, erledigt }
  function findeZiel(x, y) {
    zug.geist.style.display = 'none';
    const unter = document.elementFromPoint(x, y);
    zug.geist.style.display = '';
    const spalte = unter && unter.closest ? unter.closest('.board-spalte[data-spalte]') : null;
    if (!spalte) return null;
    const liste = spalte.querySelector('.board-karten');
    const karten = [...liste.querySelectorAll('[data-karte]')].filter((k) => k !== zug.el);
    let index = karten.length;
    for (let i = 0; i < karten.length; i += 1) {
      const r = karten[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    return { spalteId: spalte.dataset.spalte, index, davor: karten[index] || null, liste, spalte, erledigt: spalte.classList.contains('erledigt') };
  }

  function bewege(x, y) {
    letzte = { x, y };
    const links = Math.max(6, Math.min(window.innerWidth - zug.geistBreite - 6, x - zug.geistBreite / 2));
    zug.geist.style.transform = `translate(${links}px, ${Math.max(6, y - 62)}px)`;
    const ziel = findeZiel(x, y);
    zug.ziel = ziel;
    raeumeMarken();
    if (!ziel) return;
    if (ziel.erledigt) ziel.spalte.classList.add('ablage-ziel');
    else if (ziel.davor) ziel.davor.classList.add('einfuegen-davor');
    else ziel.liste.classList.add('einfuegen-ende');
  }

  // Am Rand weiterrollen: seitlich das ganze Board, hoch und runter die Spalte unter dem Finger.
  function rolle() {
    if (!zug) return;
    const quer = wurzel.querySelector('.board-spalten');
    if (!quer) return;
    const q = quer.getBoundingClientRect();
    const { x, y } = letzte;
    let dx = 0;
    let dy = 0;
    if (x > q.right - 34) dx = 12;
    else if (x < q.left + 34) dx = -12;
    const liste = zug.ziel ? zug.ziel.liste : null;
    if (liste) {
      const r = liste.getBoundingClientRect();
      if (y > r.bottom - 40) dy = 10;
      else if (y < r.top + 34 && y > r.top - 30) dy = -10;
    }
    if (!dx && !dy) {
      amRandSeit = 0;
      return;
    }
    if (!amRandSeit) amRandSeit = Date.now();
    if (Date.now() - amRandSeit < RAND_WARTEN) return;
    const vorher = [quer.scrollLeft, liste ? liste.scrollTop : 0];
    quer.scrollLeft += dx;
    if (liste) liste.scrollTop += dy;
    if (vorher[0] !== quer.scrollLeft || (liste && vorher[1] !== liste.scrollTop)) bewege(x, y);
  }

  function beginne(el, x, y) {
    const geist = document.createElement('div');
    geist.className = 'zieh-schild';
    geist.textContent = el.dataset.titel || '';
    wurzel.appendChild(geist);
    el.classList.add('wird-gezogen');
    wurzel.classList.add('zieht');
    // Während des Ziehens rastet das Board nicht ein, sonst springt es beim Rollen.
    zug = { el, id: el.dataset.karte, geist, geistBreite: geist.offsetWidth, ziel: null };
    amRandSeit = 0;
    rollUhr = setInterval(rolle, 30);
    bewege(x, y);
  }

  function beende(ablegen) {
    if (warte) {
      clearTimeout(warte.uhr);
      warte = null;
    }
    if (!zug) return;
    clearInterval(rollUhr);
    const { el, id, geist, ziel } = zug;
    zug = null;
    geist.remove();
    el.classList.remove('wird-gezogen');
    wurzel.classList.remove('zieht');
    raeumeMarken();
    klickSperreBis = Date.now() + 450;
    if (ablegen && ziel) onAblegen(id, ziel.spalteId, ziel.index);
  }

  // ---------- Finger ----------
  const touchStart = (e) => {
    if (e.touches.length !== 1 || zug) return;
    const el = e.target.closest ? e.target.closest('[data-karte]') : null;
    if (!el || !wurzel.contains(el)) return;
    const t = e.touches[0];
    warte = { el, x: t.clientX, y: t.clientY, uhr: setTimeout(() => { const w = warte; warte = null; if (w) beginne(w.el, w.x, w.y); }, DRUECK_DAUER) };
  };
  const touchMove = (e) => {
    const t = e.touches[0];
    if (zug) {
      e.preventDefault();
      bewege(t.clientX, t.clientY);
    } else if (warte && Math.hypot(t.clientX - warte.x, t.clientY - warte.y) > 10) {
      // Der Finger hat sich bewegt, bevor die Zeit um war: Das war ein Scrollen.
      clearTimeout(warte.uhr);
      warte = null;
    }
  };
  const touchEnd = () => beende(true);
  const touchCancel = () => beende(false);

  // ---------- Maus ----------
  let maus = null;
  const mouseDown = (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest ? e.target.closest('[data-karte]') : null;
    if (!el || !wurzel.contains(el)) return;
    maus = { el, x: e.clientX, y: e.clientY };
  };
  const mouseMove = (e) => {
    if (zug) {
      e.preventDefault();
      bewege(e.clientX, e.clientY);
    } else if (maus && Math.hypot(e.clientX - maus.x, e.clientY - maus.y) > 5) {
      beginne(maus.el, e.clientX, e.clientY);
      maus = null;
    }
  };
  const mouseUp = () => {
    maus = null;
    beende(true);
  };

  // Direkt nach dem Ablegen keinen Klick durchlassen (sonst öffnet sich die Karte).
  const klick = (e) => {
    if (Date.now() < klickSperreBis) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const menue = (e) => { if (e.target.closest && e.target.closest('[data-karte]')) e.preventDefault(); };

  wurzel.addEventListener('touchstart', touchStart, { passive: true });
  wurzel.addEventListener('touchmove', touchMove, { passive: false });
  wurzel.addEventListener('touchend', touchEnd);
  wurzel.addEventListener('touchcancel', touchCancel);
  wurzel.addEventListener('mousedown', mouseDown);
  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('mouseup', mouseUp);
  wurzel.addEventListener('click', klick, true);
  wurzel.addEventListener('contextmenu', menue);

  return () => {
    beende(false);
    wurzel.removeEventListener('touchstart', touchStart);
    wurzel.removeEventListener('touchmove', touchMove);
    wurzel.removeEventListener('touchend', touchEnd);
    wurzel.removeEventListener('touchcancel', touchCancel);
    wurzel.removeEventListener('mousedown', mouseDown);
    window.removeEventListener('mousemove', mouseMove);
    window.removeEventListener('mouseup', mouseUp);
    wurzel.removeEventListener('click', klick, true);
    wurzel.removeEventListener('contextmenu', menue);
  };
}
