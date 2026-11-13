// Kleine Helfer für IDs, Datum und Text.

// Zufällige, eindeutige ID für jeden Datensatz.
export function neueId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

// Zeitstempel für "erstellt am" und "geändert am".
export function jetztIso() {
  return new Date().toISOString();
}

// Lokales Kalenderdatum als JJJJ-MM-TT (ohne Zeitzonen-Umrechnung).
export function datumLokal(d = new Date()) {
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

const FORMAT_LANG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const FORMAT_KURZ = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FORMAT_ZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

// "Freitag, 13. November"
export function datumLang(d = new Date()) {
  return FORMAT_LANG.format(d);
}

// "13.11.2026"
export function datumKurz(wert) {
  return FORMAT_KURZ.format(new Date(wert));
}

// "13.11.2026, 10:15 Uhr"
export function datumMitZeit(wert) {
  const d = new Date(wert);
  return `${FORMAT_KURZ.format(d)}, ${FORMAT_ZEIT.format(d)} Uhr`;
}

// Volle Tage seit einem Zeitstempel.
export function tageSeit(wert) {
  return Math.floor((Date.now() - new Date(wert).getTime()) / 86400000);
}

// "vor 3 Tagen", "gestern", "heute"
export function vorTagen(tage) {
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

// Dateigröße lesbar: "12 KB"
export function groesseLesbar(bytes) {
  if (bytes < 1024) return `${bytes} Byte`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// Läuft die App vom Home-Bildschirm (installiert) oder im Browser-Tab?
export function istInstalliert() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Wählt für Icons auf einer Farbfläche Weiß oder dunkle Tinte, je nach Helligkeit der Fläche.
export function farbeDarauf(hex) {
  const wert = hex.replace('#', '');
  const r = parseInt(wert.slice(0, 2), 16);
  const g = parseInt(wert.slice(2, 4), 16);
  const b = parseInt(wert.slice(4, 6), 16);
  const helligkeit = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return helligkeit > 0.68 ? '#2b4042' : '#ffffff';
}
