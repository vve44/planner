// Text mit einfacher Formatierung für Notizen.
//
// Geschrieben wird in einem gewöhnlichen Textfeld. Die Formatierung steht als kurze
// Zeichen im Text, die Knöpfe über dem Feld setzen sie:
//   **fett**        *kursiv*
//   # Überschrift   ## kleinere Überschrift
//   - Listenpunkt   1. nummerierter Punkt
// Die Leseansicht zeigt den Text formatiert, ohne die Zeichen.

import { html } from '../../bibliothek/preact-htm.js';

const LISTE = /^- (.*)$/;
const NUMMER = /^(\d+)\. (.*)$/;

// ---------- Anzeigen ----------

function inZeile(text) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).map((teil) => {
    if (teil.length > 4 && teil.startsWith('**') && teil.endsWith('**')) return html`<strong>${teil.slice(2, -2)}</strong>`;
    if (teil.length > 2 && teil.startsWith('*') && teil.endsWith('*')) return html`<em>${teil.slice(1, -1)}</em>`;
    return teil;
  });
}

export function TextAnsicht({ text }) {
  const zeilen = (text || '').split('\n');
  const teile = [];
  let i = 0;
  while (i < zeilen.length) {
    const zeile = zeilen[i];
    if (!zeile.trim()) {
      i += 1;
    } else if (zeile.startsWith('## ')) {
      teile.push(html`<h4>${inZeile(zeile.slice(3))}</h4>`);
      i += 1;
    } else if (zeile.startsWith('# ')) {
      teile.push(html`<h3>${inZeile(zeile.slice(2))}</h3>`);
      i += 1;
    } else if (LISTE.test(zeile)) {
      const punkte = [];
      while (i < zeilen.length && LISTE.test(zeilen[i])) {
        punkte.push(zeilen[i].slice(2));
        i += 1;
      }
      teile.push(html`<ul>${punkte.map((p) => html`<li>${inZeile(p)}</li>`)}</ul>`);
    } else if (NUMMER.test(zeile)) {
      const punkte = [];
      while (i < zeilen.length && NUMMER.test(zeilen[i])) {
        punkte.push(NUMMER.exec(zeilen[i])[2]);
        i += 1;
      }
      teile.push(html`<ol>${punkte.map((p) => html`<li>${inZeile(p)}</li>`)}</ol>`);
    } else {
      const absatz = [];
      while (i < zeilen.length && zeilen[i].trim() && !zeilen[i].startsWith('# ') && !zeilen[i].startsWith('## ')
        && !LISTE.test(zeilen[i]) && !NUMMER.test(zeilen[i])) {
        absatz.push(zeilen[i]);
        i += 1;
      }
      teile.push(html`<p>${absatz.map((z, n) => (n ? [html`<br />`, inZeile(z)] : inZeile(z)))}</p>`);
    }
  }
  return html`<div class="notiz-text">${teile}</div>`;
}

// Der Text ohne Formatierungszeichen (für Vorschau und Suche).
export function schlicht(text) {
  return (text || '')
    .split('\n')
    .map((z) => z.replace(/^#{1,2} /, '').replace(/^- /, '').replace(/^\d+\. /, ''))
    .join('\n')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1');
}

// ---------- Formatieren im Textfeld ----------
// Jede Funktion bekommt Text und Auswahl und gibt beides geändert zurück: { text, von, bis }.

function umschliesse(text, von, bis, zeichen) {
  const n = zeichen.length;
  const auswahl = text.slice(von, bis);
  // Steht die Auswahl schon in den Zeichen, werden sie entfernt.
  if (text.slice(von - n, von) === zeichen && text.slice(bis, bis + n) === zeichen) {
    return { text: text.slice(0, von - n) + auswahl + text.slice(bis + n), von: von - n, bis: bis - n };
  }
  return { text: text.slice(0, von) + zeichen + auswahl + zeichen + text.slice(bis), von: von + n, bis: bis + n };
}

// Wendet eine Änderung auf alle Zeilen an, die die Auswahl berührt.
function jeZeile(text, von, bis, aendere) {
  const anfang = text.lastIndexOf('\n', von - 1) + 1;
  let ende = text.indexOf('\n', bis);
  if (ende === -1) ende = text.length;
  const zeilen = text.slice(anfang, ende).split('\n');
  const neu = aendere(zeilen).join('\n');
  return { text: text.slice(0, anfang) + neu + text.slice(ende), von: anfang + neu.length, bis: anfang + neu.length };
}

const ohneZeichen = (zeile) => zeile.replace(/^#{1,2} /, '').replace(/^- /, '').replace(/^\d+\. /, '');

export function formatiere(art, text, von, bis) {
  if (art === 'fett') return umschliesse(text, von, bis, '**');
  if (art === 'kursiv') return umschliesse(text, von, bis, '*');
  if (art === 'ueberschrift') {
    // Wechselt reihum: Überschrift, kleinere Überschrift, normaler Text.
    return jeZeile(text, von, bis, (zeilen) => zeilen.map((z) => {
      if (z.startsWith('## ')) return ohneZeichen(z);
      if (z.startsWith('# ')) return `## ${ohneZeichen(z)}`;
      return `# ${ohneZeichen(z)}`;
    }));
  }
  if (art === 'liste') {
    return jeZeile(text, von, bis, (zeilen) => {
      const alleSchon = zeilen.every((z) => LISTE.test(z));
      return zeilen.map((z) => (alleSchon ? ohneZeichen(z) : `- ${ohneZeichen(z)}`));
    });
  }
  if (art === 'nummern') {
    return jeZeile(text, von, bis, (zeilen) => {
      const alleSchon = zeilen.every((z) => NUMMER.test(z));
      return zeilen.map((z, i) => (alleSchon ? ohneZeichen(z) : `${i + 1}. ${ohneZeichen(z)}`));
    });
  }
  return { text, von, bis };
}

// Nach einem Zeilenumbruch in einer Liste geht die Liste weiter. Ein Umbruch auf einem
// leeren Listenpunkt beendet sie. "stelle" ist die Schreibmarke direkt nach dem Umbruch.
// Rückgabe: { text, von, bis } oder null, wenn nichts zu tun ist.
export function setzeListeFort(text, stelle) {
  if (text[stelle - 1] !== '\n') return null;
  const anfang = text.lastIndexOf('\n', stelle - 2) + 1;
  const davor = text.slice(anfang, stelle - 1);
  const liste = LISTE.exec(davor);
  const nummer = NUMMER.exec(davor);
  if (!liste && !nummer) return null;
  const inhalt = liste ? liste[1] : nummer[2];
  if (!inhalt.trim()) {
    // Leerer Punkt: Zeichen und Umbruch entfernen, die Liste ist zu Ende.
    const neu = text.slice(0, anfang) + text.slice(stelle);
    return { text: neu, von: anfang, bis: anfang };
  }
  const zeichen = liste ? '- ' : `${Number(nummer[1]) + 1}. `;
  const neu = text.slice(0, stelle) + zeichen + text.slice(stelle);
  return { text: neu, von: stelle + zeichen.length, bis: stelle + zeichen.length };
}
