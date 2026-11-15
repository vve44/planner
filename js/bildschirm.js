// Unterer Bildschirmrand auf dem iPhone.
// Vom Home-Bildschirm gestartet endet der Bereich, in dem die App zeichnen kann, ein Stück
// über dem unteren Bildschirmrand (um die Höhe der Statusleiste, beim iPhone 13 sind es
// 47 Punkte). Darunter zeigt das iPhone nur die Hintergrundfarbe der Seite. Alles, was die
// App dorthin schiebt, wird abgeschnitten.
//
// Deshalb bleibt die App in ihrem Bereich, und der Streifen darunter hat die Farbe der
// unteren Leiste (siehe app.css). Der Sicherheitsabstand für den Home-Balken liegt damit
// schon in diesem Streifen. Er wird hier gemessen und in app.css vom Abstand abgezogen
// (Variable --unten-luecke), damit die Leiste nicht doppelt Platz lässt.

export function richteBildschirmEin() {
  // navigator.standalone gibt es nur auf iPhone und iPad.
  if (window.navigator.standalone !== true) return;
  const wurzel = document.documentElement;
  const app = document.getElementById('app');
  const hochformat = window.matchMedia('(orientation: portrait)');

  const miss = () => {
    if (!app) return;
    // screen.width und screen.height drehen sich auf dem iPhone nicht mit.
    const lang = Math.max(window.screen.width, window.screen.height);
    const luecke = hochformat.matches ? Math.round(lang - app.getBoundingClientRect().height) : 0;
    wurzel.style.setProperty('--unten-luecke', `${luecke > 0 && luecke <= 80 ? luecke : 0}px`);
  };

  miss();
  window.addEventListener('resize', miss);
  window.addEventListener('orientationchange', () => setTimeout(miss, 250));
}
