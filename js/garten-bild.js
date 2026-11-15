// Der Garten als Zeichnung (SVG). Reine Funktion: aus dem Level entsteht das Bild.
// Mit jedem Level kommt genau ein Schritt dazu: etwas keimt, wächst, setzt Knospen an oder blüht.
// Ab Level 50 steht der Garten in voller Blüte.

const F = {
  himmel: '#e1f1f5',
  sonne: '#f7cf6a',
  erdeHinten: '#e6d3c2',
  erde: '#c9ab93',
  erdeTief: '#a07e69',
  huegelGruen: '#c3e4bb',
  wieseGruen: '#96d09c',
  bodenGruen: '#6fb586',
  stamm: '#7a5540',
  stiel: '#3d8563',
  gruen1: '#57a773',
  gruen2: '#86c58d',
  gruen3: '#b8e0b4',
  farn1: '#3f9488',
  farn2: '#74bcae',
  halm1: '#8fc463',
  halm2: '#bfdc7c',
  gold: '#b8975a',
  mitte: '#f2b63c',
  bluete: '#fffdf7',
  koralle: '#ef7f6b',
  rosa: '#f6a3b6',
  gelb: '#f7c955',
  lila: '#a48be0',
  blau: '#6fa8e8',
  apfel: '#ffd3dc',
  mohn: '#e4533f',
  rose: '#ee7f9b',
  roseTief: '#d9567a',
  lavendel: '#9a86d8',
  lavendelGruen: '#8fb59a',
  kern: '#6a4a36',
};

const r = (zahl) => Math.round(zahl * 10) / 10;

// Mischt zwei Farben (#rrggbb), anteil 0..1.
function mische(a, b, anteil) {
  const t = Math.max(0, Math.min(1, anteil));
  const teil = (farbe, i) => parseInt(farbe.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(teil(a, i) + (teil(b, i) - teil(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Bausteine ----------

// Blatt: Mandelform, Spitze zeigt bei winkel 0 nach oben.
const blatt = (x, y, laenge, breite, winkel, farbe) =>
  `<path d="M0 0Q${r(breite)} ${r(-laenge * 0.5)} 0 ${r(-laenge)}Q${r(-breite)} ${r(-laenge * 0.5)} 0 0Z" fill="${farbe}" transform="translate(${r(x)} ${r(y)}) rotate(${r(winkel)})"/>`;

// Stiel: Linie mit leichter Biegung.
const stiel = (x1, y1, x2, y2, biegung = 0, dicke = 2.2, farbe = F.stiel) =>
  `<path d="M${r(x1)} ${r(y1)}Q${r((x1 + x2) / 2 + biegung)} ${r((y1 + y2) / 2)} ${r(x2)} ${r(y2)}" fill="none" stroke="${farbe}" stroke-width="${dicke}" stroke-linecap="round"/>`;

const kreis = (x, y, radius, farbe) => `<circle cx="${r(x)}" cy="${r(y)}" r="${r(radius)}" fill="${farbe}"/>`;

// Blüte mit Blütenblättern rund um eine goldene Mitte.
function bluete(x, y, groesse, farbe = F.bluete, mitte = F.mitte, anzahl = 8) {
  let aus = '';
  for (let i = 0; i < anzahl; i += 1) {
    aus += `<ellipse cx="0" cy="${r(-groesse * 0.62)}" rx="${r(groesse * 0.26)}" ry="${r(groesse * 0.42)}" fill="${farbe}" transform="translate(${r(x)} ${r(y)}) rotate(${r((360 / anzahl) * i)})"/>`;
  }
  return aus + kreis(x, y, groesse * 0.3, mitte);
}

// Knospe: geschlossenes Oval auf dem Stiel.
const knospe = (x, y, groesse, winkel = 0, farbe = F.gelb) =>
  `<ellipse cx="0" cy="${r(-groesse * 0.7)}" rx="${r(groesse * 0.45)}" ry="${r(groesse * 0.8)}" fill="${farbe}" transform="translate(${r(x)} ${r(y)}) rotate(${r(winkel)})"/>`;

// Tulpe: Kelch mit drei Spitzen.
const tulpe = (x, y, g, farbe, winkel = 0) =>
  `<path d="M${r(-0.5 * g)} ${r(-0.1 * g)}C${r(-0.62 * g)} ${r(-0.7 * g)} ${r(-0.45 * g)} ${r(-0.95 * g)} ${r(-0.4 * g)} ${r(-1.15 * g)}C${r(-0.22 * g)} ${r(-0.98 * g)} ${r(-0.1 * g)} ${r(-1.02 * g)} 0 ${r(-1.25 * g)}C${r(0.1 * g)} ${r(-1.02 * g)} ${r(0.22 * g)} ${r(-0.98 * g)} ${r(0.4 * g)} ${r(-1.15 * g)}C${r(0.45 * g)} ${r(-0.95 * g)} ${r(0.62 * g)} ${r(-0.7 * g)} ${r(0.5 * g)} ${r(-0.1 * g)}C${r(0.35 * g)} ${r(0.2 * g)} ${r(-0.35 * g)} ${r(0.2 * g)} ${r(-0.5 * g)} ${r(-0.1 * g)}Z" fill="${farbe}" transform="translate(${r(x)} ${r(y)}) rotate(${r(winkel)})"/>`;

// Keimling: kurzer Stiel mit zwei Blättchen.
const keimling = (x, y, g = 1) =>
  stiel(x, y, x, y - 9 * g, 0, 2) + blatt(x, y - 8 * g, 9 * g, 3.4 * g, -52, F.gruen1) + blatt(x, y - 8 * g, 9 * g, 3.4 * g, 52, F.gruen2);

// ---------- Pflanzen (jede mit ihren Wachstumsstufen) ----------

function gaensebluemchen(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y);
  const blaetter = [-64, -34, 34, 64].map((w, i) => blatt(x, y, 17 + (i % 2) * 4, 5, w, i % 2 ? F.gruen2 : F.gruen1)).join('');
  if (stufe === 2) return blaetter;
  const stiele = [[-13, 40, -4], [1, 54, 2], [15, 36, 4]];
  let aus = stiele.map(([dx, hoehe, biegung]) => stiel(x, y, x + dx, y - hoehe, biegung)).join('') + blaetter;
  stiele.forEach(([dx, hoehe], i) => {
    aus += stufe === 3 ? knospe(x + dx, y - hoehe + 3, 6, dx * 0.8) : bluete(x + dx, y - hoehe, i === 1 ? 11 : 9);
  });
  return aus;
}

function gras(x, y, stufe) {
  if (stufe < 1) return '';
  const halme = stufe === 1
    ? [[-6, 20, -5], [0, 27, 1], [7, 18, 5]]
    : [[-12, 30, -10], [-7, 46, -5], [-2, 58, -1], [3, 50, 5], [8, 38, 9], [13, 26, 12]];
  return halme.map(([dx, hoehe, neigung], i) => stiel(x + dx * 0.5, y, x + dx + neigung * 0.6, y - hoehe, neigung * 0.5, 2.3, i % 2 ? F.halm2 : F.halm1)).join('');
}

function farn(x, y, stufe) {
  if (stufe < 1) return '';
  const wedel = (winkel, laenge, farbe) => {
    let aus = `<g transform="translate(${r(x)} ${r(y)}) rotate(${winkel})">` + stiel(0, 0, 0, -laenge, laenge * 0.06, 1.8);
    const paare = Math.floor(laenge / 9);
    for (let i = 1; i <= paare; i += 1) {
      const hoehe = -(laenge * i) / (paare + 0.6);
      const g = 10 - (6 * i) / paare;
      aus += blatt(0, hoehe, g + 3, 2.6, -62, farbe) + blatt(0, hoehe, g + 3, 2.6, 62, farbe);
    }
    return `${aus}${blatt(0, -laenge + 2, 8, 2.4, 0, farbe)}</g>`;
  };
  if (stufe === 1) return wedel(-8, 26, F.farn1);
  if (stufe === 2) return wedel(-30, 34, F.farn2) + wedel(24, 30, F.farn2) + wedel(-4, 42, F.farn1);
  return wedel(-48, 40, F.farn2) + wedel(44, 36, F.farn2) + wedel(-24, 54, F.farn1) + wedel(22, 50, F.farn2) + wedel(-2, 64, F.farn1);
}

function tulpen(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y);
  const blaetter = blatt(x - 3, y, 34, 6.5, -24, F.gruen2) + blatt(x + 3, y, 30, 6.5, 22, F.gruen1) + blatt(x, y, 24, 5.5, -3, F.gruen3);
  if (stufe === 2) return blaetter;
  if (stufe === 3) return stiel(x, y, x + 1, y - 50, 3) + blaetter + knospe(x + 1, y - 46, 8, 2, F.koralle);
  return stiel(x, y, x - 15, y - 44, -5) + stiel(x, y, x + 1, y - 62, 3) + stiel(x, y, x + 17, y - 46, 6) + blaetter
    + tulpe(x - 15, y - 42, 14, F.gelb, -8) + tulpe(x + 1, y - 60, 16, F.koralle) + tulpe(x + 17, y - 44, 14, F.rosa, 8);
}

function busch(x, y, stufe) {
  if (stufe < 1) return '';
  const kugeln = [
    [[0, -9, 11, F.gruen2], [6, -6, 8, F.gruen1]],
    [[-9, -10, 13, F.gruen3], [9, -11, 14, F.gruen2], [0, -19, 13, F.gruen1]],
    [[-21, -11, 15, F.gruen3], [21, -12, 16, F.gruen3], [-10, -24, 16, F.gruen2], [12, -26, 17, F.gruen2], [0, -14, 17, F.gruen1], [1, -36, 13, F.gruen1]],
  ][Math.min(stufe, 3) - 1];
  let aus = kugeln.map(([dx, dy, radius, farbe]) => kreis(x + dx, y + dy, radius, farbe)).join('');
  if (stufe >= 4) {
    aus += [[-20, -16], [-8, -30], [4, -42], [15, -30], [24, -16], [-2, -18], [10, -12], [-12, -8]]
      .map(([dx, dy], i) => (i % 3 === 0 ? bluete(x + dx, y + dy, 5.5, F.bluete, F.mitte, 6) : kreis(x + dx, y + dy, 2.8, i % 2 ? F.rosa : F.koralle))).join('');
  }
  return aus;
}

function baum(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y, 1.1);
  if (stufe === 2) {
    return stiel(x, y, x + 1, y - 40, 2, 3, F.stamm) + blatt(x + 1, y - 22, 14, 4.5, -58, F.gruen2) + blatt(x + 1, y - 30, 15, 4.5, 56, F.gruen1) + blatt(x + 1, y - 38, 16, 5, -8, F.gruen1);
  }
  const hoch = stufe === 3 ? 58 : 80;
  const g = stufe === 3 ? 0.72 : 1;
  let aus = stiel(x, y, x + 1, y - hoch, 2, stufe === 3 ? 3.6 : 4.4, F.stamm)
    + stiel(x + 1, y - hoch * 0.55, x - 13 * g, y - hoch * 0.8, -2, 2.6, F.stamm) + stiel(x + 1, y - hoch * 0.62, x + 14 * g, y - hoch * 0.86, 2, 2.6, F.stamm);
  const krone = [[-20, 0, 21, F.gruen3], [21, -2, 22, F.gruen3], [-8, -20, 23, F.gruen2], [14, -22, 21, F.gruen2], [1, -4, 22, F.gruen1], [3, -36, 16, F.gruen1]];
  aus += krone.map(([dx, dy, radius, farbe]) => kreis(x + 1 + dx * g, y - hoch - 6 * g + dy * g, radius * g, farbe)).join('');
  if (stufe >= 5) {
    aus += [[-26, -2], [-14, -24], [-2, -44], [10, -30], [26, -8], [18, -20], [-6, -8], [8, -4], [-20, -16], [2, -22]]
      .map(([dx, dy], i) => (i % 3 === 0 ? bluete(x + 1 + dx, y - hoch - 6 + dy, 6, F.apfel, F.mitte, 6) : kreis(x + 1 + dx, y - hoch - 6 + dy, 2.8, i % 2 ? F.gold : F.rosa))).join('');
  }
  return aus;
}

function blattpflanze(x, y, stufe) {
  if (stufe < 1) return '';
  const alle = [[0, 30, 9, F.gruen1], [-34, 34, 10, F.gruen2], [32, 32, 10, F.gruen2], [-62, 28, 9, F.gruen1], [60, 26, 9, F.gruen1]];
  const zahl = [1, 3, 5][stufe - 1];
  const g = [0.8, 1, 1.25][stufe - 1];
  return alle.slice(0, zahl).reverse().map(([winkel, laenge, breite, farbe]) =>
    blatt(x, y, laenge * g, breite * g, winkel, farbe) + `<g transform="translate(${r(x)} ${r(y)}) rotate(${winkel})">${stiel(0, -2, 0, -laenge * g * 0.78, 0, 1.2, F.stiel)}</g>`).join('');
}

function margerite(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y);
  const blaetter = blatt(x, y - 14, 16, 4.5, -56, F.gruen2) + blatt(x + 1, y - 26, 16, 4.5, 54, F.gruen1) + blatt(x, y, 14, 4.5, 40, F.gruen2);
  if (stufe === 2) return stiel(x, y, x + 2, y - 58, 4) + blaetter + knospe(x + 2, y - 55, 7, 4, F.lila);
  return stiel(x, y, x + 2, y - 70, 4) + stiel(x + 1, y - 30, x - 14, y - 52, -3, 2) + blaetter + bluete(x - 14, y - 52, 10, F.lila) + bluete(x + 2, y - 70, 13, F.lila);
}

function wiesenblumen(x, y, stufe) {
  if (stufe < 1) return '';
  let aus = [[-10, 16, -6], [-4, 24, -2], [3, 20, 3], [9, 14, 6]].map(([dx, hoehe, neigung], i) => stiel(x + dx * 0.6, y, x + dx + neigung * 0.5, y - hoehe, neigung * 0.4, 2.1, i % 2 ? F.halm1 : F.gruen2)).join('');
  if (stufe >= 2) {
    aus += [[-13, 30, -4], [0, 38, 1], [12, 28, 4]].map(([dx, hoehe, biegung], i) =>
      stiel(x + dx * 0.4, y, x + dx, y - hoehe, biegung, 1.6) + bluete(x + dx, y - hoehe, 6.5, i === 1 ? F.gelb : F.blau, F.bluete, 5)).join('');
  }
  return aus;
}

function sonnenblume(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y, 1.1);
  const hoch = stufe === 2 ? 58 : 88;
  let aus = stiel(x, y, x + 2, y - hoch, 4, 3)
    + blatt(x + 1, y - hoch * 0.25, 20, 7, -62, F.gruen2) + blatt(x + 1, y - hoch * 0.42, 21, 7, 60, F.gruen1) + blatt(x + 2, y - hoch * 0.62, 18, 6, -58, F.gruen1);
  if (stufe === 2) return aus + blatt(x + 2, y - hoch + 2, 14, 5, 6, F.gruen2);
  if (stufe === 3) return aus + kreis(x + 2, y - hoch - 4, 7.5, F.gruen1) + kreis(x + 2, y - hoch - 5, 4, F.gelb);
  aus += bluete(x + 2, y - hoch - 8, 17, F.gelb, F.kern, 14);
  return aus + kreis(x + 2, y - hoch - 8, 3, '#8a6248');
}

function lavendel(x, y, stufe) {
  if (stufe < 1) return '';
  const halme = stufe === 1
    ? [[-7, 15, -4], [-2, 19, -1], [3, 17, 2], [8, 13, 5]]
    : [[-16, 26, -10], [-11, 33, -6], [-6, 38, -3], [-1, 41, 0], [4, 39, 3], [9, 34, 6], [14, 28, 10], [-3, 30, -2], [7, 30, 4]];
  let aus = halme.map(([dx, hoehe, neigung]) => stiel(x + dx * 0.35, y, x + dx + neigung * 0.4, y - hoehe, neigung * 0.3, 1.6, F.lavendelGruen)).join('');
  if (stufe >= 3) {
    halme.forEach(([dx, hoehe, neigung], i) => {
      const hx = x + dx + neigung * 0.4;
      const hy = y - hoehe;
      for (let k = 0; k < 4; k += 1) aus += kreis(hx - (neigung * 0.05) * k, hy + k * 3.4 - 5, 2.5 - k * 0.2, i % 2 ? F.lavendel : F.lila);
    });
  }
  return aus;
}

function mohn(x, y, stufe) {
  if (stufe < 1) return '';
  if (stufe === 1) return keimling(x, y);
  const blaetter = [-58, -26, 24, 56].map((w, i) => blatt(x, y, 15 + (i % 2) * 5, 4.5, w, i % 2 ? F.gruen1 : F.gruen2)).join('');
  if (stufe === 2) return blaetter;
  const stiele = [[-13, 42, -5], [2, 56, 3], [15, 38, 6]];
  let aus = stiele.map(([dx, hoehe, biegung]) => stiel(x, y, x + dx, y - hoehe, biegung, 1.9)).join('') + blaetter;
  stiele.forEach(([dx, hoehe], i) => {
    if (stufe === 3) {
      aus += knospe(x + dx, y - hoehe + 4, 6, dx * 1.5, F.gruen1);
    } else {
      const g = i === 1 ? 10.5 : 8.5;
      const mx = x + dx;
      const my = y - hoehe;
      aus += [[0, -0.48], [0.5, 0], [0, 0.48], [-0.5, 0]].map(([px, py]) => kreis(mx + px * g, my + py * g, g * 0.56, F.mohn)).join('') + kreis(mx, my, g * 0.26, F.kern);
    }
  });
  return aus;
}

function rosenbusch(x, y, stufe) {
  if (stufe < 1) return '';
  const kugeln = [
    [[0, -8, 10, '#4f9a6a'], [-6, -5, 8, F.gruen1]],
    [[-10, -9, 13, F.gruen1], [9, -10, 13, '#4f9a6a'], [0, -19, 13, F.gruen1]],
    [[-19, -10, 14, '#4f9a6a'], [18, -11, 15, F.gruen1], [-9, -24, 15, F.gruen1], [10, -25, 16, '#4f9a6a'], [0, -13, 16, F.gruen1], [1, -36, 12, '#4f9a6a']],
  ][Math.min(stufe, 3) - 1];
  let aus = kugeln.map(([dx, dy, radius, farbe]) => kreis(x + dx, y + dy, radius, farbe)).join('');
  const stellen = [[-18, -14], [-7, -28], [4, -40], [14, -27], [20, -13], [-2, -15], [8, -8]];
  if (stufe === 3) aus += stellen.slice(0, 5).map(([dx, dy]) => kreis(x + dx, y + dy, 2.4, F.rose)).join('');
  if (stufe >= 4) aus += stellen.map(([dx, dy]) => kreis(x + dx, y + dy, 5.6, F.rose) + kreis(x + dx + 0.6, y + dy - 0.4, 3.3, F.roseTief) + kreis(x + dx + 1, y + dy - 0.8, 1.4, F.apfel)).join('');
  return aus;
}

// Kleine Blümchen, verstreut über Hügel und Wiese.
function tupfer(stufe) {
  if (stufe < 1) return '';
  const alle = [
    [26, 196, F.bluete], [226, 198, F.gelb], [372, 190, F.bluete], [150, 240, F.bluete], [300, 238, F.gelb], [78, 238, F.bluete],
    [132, 190, F.rosa], [330, 196, F.blau], [232, 242, F.rosa], [376, 236, F.bluete], [14, 232, F.blau], [190, 196, F.bluete],
  ];
  return alle.slice(0, stufe === 1 ? 6 : 12).map(([px, py, farbe]) => bluete(px, py, 3.6, farbe, farbe === F.gelb ? F.bluete : F.mitte, 5)).join('');
}

function falter(x, y, g, fluegel, innen, winkel) {
  const paar = (seite) => `<ellipse cx="${r(seite * 5.2 * g)}" cy="${r(-3 * g)}" rx="${r(5 * g)}" ry="${r(6.4 * g)}" fill="${fluegel}" transform="rotate(${seite * 22})"/>`
    + `<ellipse cx="${r(seite * 4.2 * g)}" cy="${r(4 * g)}" rx="${r(3.6 * g)}" ry="${r(4.4 * g)}" fill="${innen}" transform="rotate(${seite * -18})"/>`;
  return `<g transform="translate(${r(x)} ${r(y)}) rotate(${winkel})">${paar(-1)}${paar(1)}<ellipse cx="0" cy="0" rx="${r(1.1 * g)}" ry="${r(6 * g)}" fill="${F.kern}"/></g>`;
}

function schmetterlinge(stufe) {
  if (stufe < 1) return '';
  return falter(262, 96, 1.15, F.koralle, F.gelb, 18) + (stufe >= 2 ? falter(60, 84, 1, F.lila, F.rosa, -16) : '');
}

// Ein kleiner Vogel, der oben auf dem Busch sitzt.
function vogel(x, y) {
  return `<g transform="translate(${r(x)} ${r(y)})">`
    + `<path d="M-13 -3L-21 -8L-19 1Z" fill="${F.blau}"/>`
    + `<ellipse cx="-3" cy="-5" rx="10.5" ry="7.5" fill="${F.blau}"/>`
    + `<circle cx="6" cy="-11" r="5.6" fill="${F.blau}"/>`
    + `<ellipse cx="-4" cy="-3.5" rx="6.5" ry="4" fill="#9cc5f1"/>`
    + `<path d="M11 -12L16.5 -10.2L11 -8.6Z" fill="${F.gelb}"/>`
    + `<circle cx="7.6" cy="-12" r="1.1" fill="${F.kern}"/>`
    + stiel(-3, 2, -3, 6, 0, 1.2, F.kern) + stiel(1, 2, 1, 6, 0, 1.2, F.kern)
    + '</g>';
}

// ---------- Aufbau des Gartens ----------

// Die Pflanzen und ihr Platz. Reihenfolge = Zeichenreihenfolge (hinten zuerst). g = Größe.
const PFLANZEN = [
  { name: 'rosenbusch', zeichne: rosenbusch, x: 36, y: 186, g: 1.5, reihe: 'hinten' },
  { name: 'baum', zeichne: baum, x: 124, y: 181, g: 1.12, reihe: 'hinten' },
  { name: 'gras', zeichne: gras, x: 184, y: 176, g: 1.25, reihe: 'hinten' },
  { name: 'sonnenblume', zeichne: sonnenblume, x: 228, y: 180, g: 1.15, reihe: 'hinten' },
  { name: 'busch', zeichne: busch, x: 290, y: 182, g: 1.3, reihe: 'hinten' },
  { name: 'margerite', zeichne: margerite, x: 356, y: 178, g: 1.3, reihe: 'hinten' },
  { name: 'mohn', zeichne: mohn, x: 160, y: 210, g: 1.3, reihe: 'mitte' },
  { name: 'lavendel', zeichne: lavendel, x: 322, y: 212, g: 1.35, reihe: 'mitte' },
  { name: 'farn', zeichne: farn, x: 40, y: 224, g: 1.35, reihe: 'vorn' },
  { name: 'tulpen', zeichne: tulpen, x: 84, y: 228, g: 1.4, reihe: 'vorn' },
  { name: 'gaensebluemchen', zeichne: gaensebluemchen, x: 212, y: 230, g: 1.45, reihe: 'vorn' },
  { name: 'blattpflanze', zeichne: blattpflanze, x: 268, y: 228, g: 1.35, reihe: 'vorn' },
  { name: 'wiesenblumen', zeichne: wiesenblumen, x: 368, y: 224, g: 1.5, reihe: 'vorn' },
];

// Mit jedem Level wächst die Pflanze an dieser Stelle der Liste um eine Stufe.
// "tupfer" (Blümchen in der Wiese), "schmetterlinge" und "vogel" haben keinen festen Platz im Beet.
export const SCHRITTE = [
  'gaensebluemchen', 'gras', 'farn', 'gaensebluemchen', 'tulpen', 'busch', 'gaensebluemchen', 'baum', 'mohn', 'gaensebluemchen',
  'blattpflanze', 'tulpen', 'gras', 'baum', 'tulpen', 'sonnenblume', 'tulpen', 'farn', 'busch', 'mohn',
  'margerite', 'lavendel', 'baum', 'mohn', 'mohn', 'blattpflanze', 'margerite', 'rosenbusch', 'margerite', 'sonnenblume',
  'busch', 'wiesenblumen', 'lavendel', 'farn', 'lavendel', 'rosenbusch', 'baum', 'busch', 'sonnenblume', 'wiesenblumen',
  'sonnenblume', 'blattpflanze', 'rosenbusch', 'tupfer', 'rosenbusch', 'baum', 'schmetterlinge', 'tupfer', 'vogel', 'schmetterlinge',
];

export const VOLL_AB_LEVEL = SCHRITTE.length;

// Wie weit jede Pflanze bei diesem Level ist.
export function stufen(level) {
  const stand = {};
  SCHRITTE.slice(0, Math.max(0, Math.min(level, SCHRITTE.length))).forEach((name) => { stand[name] = (stand[name] || 0) + 1; });
  return stand;
}

// Das Bild als SVG-Text.
export function gartenSvg(level, { titel = `Garten auf Level ${level}` } = {}) {
  const stand = stufen(level);
  const anteil = Math.min(1, level / VOLL_AB_LEVEL);
  // Hügel, Wiese und Boden werden mit jedem Level grüner.
  const huegel = mische(F.erdeHinten, F.huegelGruen, Math.min(1, anteil * 1.6));
  const wiese = mische(F.erde, F.wieseGruen, Math.min(1, Math.max(0, (anteil - 0.1) * 1.5)));
  const boden = mische(F.erdeTief, F.bodenGruen, Math.min(1, Math.max(0, (anteil - 0.3) * 1.6)));
  const setze = (p) => `<g transform="translate(${p.x} ${p.y}) scale(${p.g})">${p.zeichne(0, 0, stand[p.name] || 0)}</g>`;
  const reihe = (name) => PFLANZEN.filter((p) => p.reihe === name).map(setze).join('');
  // Saatstellen: kleine Mulden dort, wo noch nichts wächst.
  const mulde = (p) => `<ellipse cx="${p.x}" cy="${p.y + 2}" rx="11" ry="3" fill="${p.reihe === 'vorn' ? F.erdeTief : F.erde}" opacity="0.5"/>`;
  const frei = (name) => PFLANZEN.filter((p) => p.reihe === name && !stand[p.name]).map(mulde).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 400 250" role="img" aria-label="${titel}">`
    + `<rect y="10" width="400" height="250" fill="${F.himmel}"/>`
    + `<circle cx="340" cy="48" r="${r(16 + anteil * 5)}" fill="${F.sonne}" opacity="${r(0.55 + anteil * 0.45)}"/>`
    + `<path d="M0 188C66 171 134 167 212 177C278 185 344 175 400 167V260H0Z" fill="${huegel}"/>`
    + frei('hinten') + reihe('hinten')
    + (stand.vogel ? vogel(293, 118) : '')
    + `<path d="M0 230C78 218 166 222 244 229C312 234 366 227 400 222V260H0Z" fill="${wiese}"/>`
    + frei('mitte') + reihe('mitte')
    + `<path d="M0 248C100 240 266 252 400 243V260H0Z" fill="${boden}" opacity="0.55"/>`
    + tupfer(stand.tupfer || 0)
    + frei('vorn') + reihe('vorn')
    + schmetterlinge(stand.schmetterlinge || 0)
    + '</svg>';
}
