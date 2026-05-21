const ONDERBOUW_KW = [
  'groep 1', 'groep 2', 'groep 3', 'groep 4',
  'groep1', 'groep2', 'groep3', 'groep4',
  'kleuter', 'kleutergroep', 'voor kleuters',
  'leren lezen', 'letters leren', 'cijfers leren',
  'beginnende lezers',
];

const BOVENBOUW_KW = [
  'groep 5', 'groep 6', 'groep 7', 'groep 8',
  'groep5', 'groep6', 'groep7', 'groep8',
  'bovenbouw', 'voortgezet onderwijs',
  'oorlog', 'klimaatverandering', 'verkiezingen', 'politiek',
  'economie', 'vluchtelingen', 'migratie', 'terrorisme',
  'seksualiteit', 'drugs', 'geweld', 'rampen', 'doodstraf',
  'kijkwijzer', 'angst en spanning', 'discriminatie',
];

export function classificeerNiveau(titel, beschrijving) {
  const tekst = (titel + ' ' + beschrijving).toLowerCase();
  for (const kw of BOVENBOUW_KW) {
    if (tekst.includes(kw)) return 'bovenbouw';
  }
  for (const kw of ONDERBOUW_KW) {
    if (tekst.includes(kw)) return 'onderbouw';
  }
  return 'alles';
}
