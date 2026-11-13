// Zeichnet ein Linien-Icon aus der lokal eingebetteten Icon-Sammlung.

import { html } from '../../bibliothek/preact-htm.js';
import { ICONS } from '../icon-daten.js';

export function Icon({ name, groesse = 22, strich = 1.6, klasse = '' }) {
  const inhalt = ICONS[name] || ICONS.tag;
  return html`<svg
    class=${`icon ${klasse}`}
    width=${groesse}
    height=${groesse}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width=${strich}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: inhalt }}
  />`;
}
