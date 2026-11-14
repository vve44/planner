// Bildschirmhöhe auf dem iPhone.
// Vom Home-Bildschirm gestartet rechnet iOS "unten" teils zu kurz, und zwar um die Höhe
// der Statusleiste: Unter der unteren Leiste bleibt dann ein Streifen frei. Deshalb
// bekommt die App dort ihre Höhe direkt aus der Bildschirmgröße (siehe app.css,
// Klasse "installiert" und Variable --bildschirm).

export function richteBildschirmEin() {
  // navigator.standalone gibt es nur auf iPhone und iPad.
  if (window.navigator.standalone !== true) return;
  const wurzel = document.documentElement;
  const hochformat = window.matchMedia('(orientation: portrait)');

  const miss = () => {
    // screen.width und screen.height drehen sich auf dem iPhone nicht mit.
    const lang = Math.max(window.screen.width, window.screen.height);
    const kurz = Math.min(window.screen.width, window.screen.height);
    const hoehe = hochformat.matches ? lang : kurz;
    if (hoehe > 0) wurzel.style.setProperty('--bildschirm', `${hoehe}px`);
  };

  wurzel.classList.add('installiert');
  miss();
  window.addEventListener('resize', miss);
  window.addEventListener('orientationchange', () => setTimeout(miss, 250));
}
