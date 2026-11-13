// Gemeinsame Listen: Namen der Datensatz-Typen, Farben und Icons zur Auswahl.

// Anzeigenamen der Typen (für die Backup-Vorschau). Die Typen kommen nach und
// nach mit den Etappen dazu, die Namen stehen schon jetzt fest.
export const TYP_NAMEN = {
  kategorie: 'Kategorien',
  projekt: 'Projekte und Listen',
  aufgabe: 'Aufgaben',
  serie: 'Wiederholungen und Routinen',
  tagesroutine: 'Tagesroutinen',
  tagesroutineHaken: 'Abgehakte Tagesroutinen',
  pool: 'Aufgabenpools',
  poolEintrag: 'Pool-Einträge',
  termin: 'Termine',
  habit: 'Habits',
  habitEintrag: 'Habit-Einträge',
  urlaub: 'Urlaubszeiten',
  notiz: 'Notizen',
  messwert: 'Messwerte',
  periode: 'Zyklus-Einträge',
  ziel: 'Ziele',
  punkteEreignis: 'Punkte',
};

// Farben für Kategorien: die Töne der Palette plus gedeckte Ergänzungen,
// damit sich viele Kategorien im Kalender unterscheiden lassen.
export const KATEGORIE_FARBEN = [
  { wert: '#a9c9c3', name: 'Jade' },
  { wert: '#7ba6a5', name: 'Salbei' },
  { wert: '#4c6f72', name: 'Petrol' },
  { wert: '#c7dcd4', name: 'Nebelgrün' },
  { wert: '#b8975a', name: 'Gold' },
  { wert: '#d9c7a3', name: 'Sand' },
  { wert: '#c58b6b', name: 'Terrakotta' },
  { wert: '#d4a5a5', name: 'Altrosa' },
  { wert: '#a8697b', name: 'Beere' },
  { wert: '#b3a7cc', name: 'Lavendel' },
  { wert: '#8fa8c4', name: 'Taubenblau' },
  { wert: '#9aa57a', name: 'Oliv' },
  { wert: '#6b4a32', name: 'Holz' },
  { wert: '#7c8686', name: 'Graphit' },
];

// Icons zur Auswahl für Kategorien (später auch für Aufgaben und Habits).
export const AUSWAHL_ICONS = [
  'heart-pulse', 'graduation-cap', 'briefcase', 'cake', 'house', 'dumbbell', 'book-open', 'shopping-cart',
  'utensils', 'plane', 'car', 'music', 'palette', 'star', 'gift', 'users',
  'user', 'baby', 'paw-print', 'stethoscope', 'pill', 'wallet', 'piggy-bank', 'phone',
  'mail', 'laptop', 'camera', 'film', 'gamepad-2', 'bike', 'footprints', 'bed',
  'bath', 'shirt', 'sparkles', 'coffee', 'wine', 'tree-pine', 'mountain', 'map-pin',
  'clock', 'bell', 'flag', 'trophy', 'brush', 'washing-machine', 'wrench', 'lightbulb',
  'smile', 'brain', 'languages', 'heart', 'moon', 'sun', 'scissors', 'glasses',
  'headphones', 'tv', 'shopping-bag', 'banknote', 'landmark', 'church', 'school', 'hospital',
  'train-front', 'bus', 'tent', 'umbrella', 'snowflake', 'apple', 'carrot', 'cooking-pot',
  'dog', 'cat', 'flower', 'flower-2', 'sprout', 'leaf', 'droplet', 'party-popper',
  'pen-line', 'calendar-heart', 'hand-heart', 'spray-can', 'target', 'bookmark', 'tag', 'flame',
];
