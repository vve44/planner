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

// ---------- Kalendertage ----------
// Kalendertage werden als Text "JJJJ-MM-TT" gespeichert (lokales Datum, keine Zeitzonen).

export function datumLokal(d = new Date()) {
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

export function heute() {
  return datumLokal();
}

// "2026-11-13" -> Datum um 12 Uhr mittags (vermeidet Sprünge bei der Zeitumstellung).
export function datumAusText(text) {
  const [j, m, t] = text.split('-').map(Number);
  return new Date(j, m - 1, t, 12, 0, 0);
}

export function plusTage(text, tage) {
  const d = datumAusText(text);
  d.setDate(d.getDate() + tage);
  return datumLokal(d);
}

// Gleicher Tag im Monat, n Monate später. Gibt es den Tag nicht (31. im Februar), gilt der Monatsletzte.
export function plusMonate(text, monate) {
  const d = datumAusText(text);
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monate);
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzter));
  return datumLokal(d);
}

// Wochentag als Zahl: 1 = Montag … 7 = Sonntag.
export function wochentagNr(text) {
  const tag = datumAusText(text).getDay();
  return tag === 0 ? 7 : tag;
}

// Tage zwischen zwei Kalendertagen (bis minus von).
export function tageZwischen(von, bis) {
  return Math.round((datumAusText(bis) - datumAusText(von)) / 86400000);
}

const FORMAT_LANG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const FORMAT_KURZ = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FORMAT_ZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const FORMAT_TAG = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const FORMAT_TAG_JAHR = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });

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

// Kalendertag gut lesbar: "Heute", "Morgen", "Gestern", sonst "Do., 19.11." (mit Jahr, wenn es abweicht).
export function tagLesbar(text) {
  const abstand = tageZwischen(heute(), text);
  if (abstand === 0) return 'Heute';
  if (abstand === 1) return 'Morgen';
  if (abstand === -1) return 'Gestern';
  const d = datumAusText(text);
  if (d.getFullYear() !== new Date().getFullYear()) return FORMAT_TAG_JAHR.format(d);
  return FORMAT_TAG.format(d);
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

// ---------- Uhrzeiten und Kalender ----------

// "09:30" -> 570 Minuten seit Mitternacht
export function zeitZuMin(zeit) {
  const [h, m] = zeit.split(':').map(Number);
  return h * 60 + m;
}

// 570 -> "09:30"
export function minZuZeit(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Minuten seit Mitternacht, jetzt.
export function jetztMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Montag der Woche, in der der Tag liegt.
export function montagVon(text) {
  return plusTage(text, -(wochentagNr(text) - 1));
}

export function monatsErster(text) {
  return `${text.slice(0, 8)}01`;
}

const FORMAT_MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const FORMAT_WOCHENTAG_KURZ = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const FORMAT_TAG_MONAT = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const FORMAT_TAG_MONAT_JAHR = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

// "November 2026"
export function monatLesbar(text) {
  return FORMAT_MONAT.format(datumAusText(text));
}

// "Sa"
export function wochentagKurz(text) {
  return FORMAT_WOCHENTAG_KURZ.format(datumAusText(text)).replace('.', '');
}

// "Samstag, 14. November" (mit Jahr, wenn es nicht das laufende ist)
export function tagAusfuehrlich(text) {
  const d = datumAusText(text);
  const lang = FORMAT_LANG.format(d);
  return d.getFullYear() === new Date().getFullYear() ? lang : `${lang} ${d.getFullYear()}`;
}

// Für Sätze: "heute", "gestern", "morgen" oder "am Di, 24. Nov."
export function tagImSatz(text) {
  const abstand = tageZwischen(heute(), text);
  if (abstand === 0) return 'heute';
  if (abstand === 1) return 'morgen';
  if (abstand === -1) return 'gestern';
  return `am ${tagLesbar(text)}`;
}

// "16. – 22. Nov. 2026"
export function spanneLesbar(von, bis) {
  return `${FORMAT_TAG_MONAT.format(datumAusText(von))} – ${FORMAT_TAG_MONAT_JAHR.format(datumAusText(bis))}`;
}

// Mischt eine Farbe mit Weiß (anteil 0 = Farbe, 1 = Weiß), für zarte Kalenderblöcke.
export function aufhellen(hex, anteil) {
  const wert = hex.replace('#', '');
  const teile = [0, 2, 4].map((i) => parseInt(wert.slice(i, i + 2), 16));
  return `#${teile.map((t) => Math.round(t + (255 - t) * anteil).toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Text ----------

// Dauer lesbar: "30 Min", "1 Std", "1 Std 30 Min"
export function dauerLesbar(minuten) {
  if (!minuten) return '';
  const std = Math.floor(minuten / 60);
  const min = minuten % 60;
  if (!std) return `${min} Min`;
  if (!min) return `${std} Std`;
  return `${std} Std ${min} Min`;
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
  return helligkeit > 0.68 ? '#3e2b23' : '#ffffff';
}
