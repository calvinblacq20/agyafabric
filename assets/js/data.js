/* ==========================================================================
   data.js — the house catalogue
   Pattern names are traditional Akan and northern Ghanaian cloth names.
   ========================================================================== */

// The rack in the hero. Order matters: it reads as one continuous strip.
window.SITE_CLOTHS = [
  { name: 'Adweneasa',   origin: 'Bonwire',  kind: 'kente',          seed: 101, href: 'collections.html#bonwire' },
  { name: 'Nwomu',       origin: 'Ntonso',   kind: 'adinkra',        seed: 202, href: 'collections.html#ntonso' },
  { name: 'Sika Futuro', origin: 'Bonwire',  kind: 'kente-royal',    seed: 303, href: 'collections.html#bonwire' },
  { name: 'Bosommuru',   origin: 'Aburi',    kind: 'adire',          seed: 404, href: 'collections.html#aburi' },
  { name: 'Emaa Da',     origin: 'Bonwire',  kind: 'kente-bride',    seed: 505, href: 'collections.html#bonwire' },
  { name: 'Sunsum',      origin: 'Accra',    kind: 'batik',          seed: 606, href: 'collections.html#accra' },
  { name: 'Akyempem',    origin: 'Bonwire',  kind: 'kente',          seed: 707, href: 'collections.html#bonwire' },
  { name: 'Damba',       origin: 'Daboya',   kind: 'fugu',           seed: 808, href: 'collections.html#daboya' },
  { name: 'Nkyinkyim',   origin: 'Ntonso',   kind: 'adinkra-indigo', seed: 909, href: 'collections.html#ntonso' },
  { name: 'Kokoo',       origin: 'Ho',       kind: 'batik-clay',     seed: 111, href: 'collections.html#accra' },
  { name: 'Oyokoman',    origin: 'Bonwire',  kind: 'kente-royal',    seed: 222, href: 'collections.html#bonwire' },
  { name: 'Ntoma Fufuo', origin: 'Accra',    kind: 'calico',         seed: 333, href: 'collections.html#atelier' },
  { name: 'Babadua',     origin: 'Bonwire',  kind: 'kente',          seed: 444, href: 'collections.html#bonwire' },
  { name: 'Sapei',       origin: 'Daboya',   kind: 'fugu',           seed: 555, href: 'collections.html#daboya' }
];

// The pinned horizontal rail on the index page.
window.SITE_COLLECTIONS = [
  { id: 'bonwire', title: 'Bonwire Kente',  note: 'Silk & cotton · 24 strips',  kind: 'kente',          seed: 1201, meta: 'Ashanti' },
  { id: 'ntonso',  title: 'Ntonso Adinkra', note: 'Badie ink · hand stamped',   kind: 'adinkra',        seed: 1302, meta: 'Ashanti' },
  { id: 'accra',   title: 'Accra Wax',      note: 'Wax resist · 6 yards',       kind: 'batik',          seed: 1403, meta: 'Greater Accra' },
  { id: 'aburi',   title: 'Aburi Indigo',   note: 'Tied & stitched resist',     kind: 'adire',          seed: 1504, meta: 'Eastern' },
  { id: 'daboya',  title: 'Daboya Fugu',    note: 'Narrow strip · smock cloth', kind: 'fugu',           seed: 1605, meta: 'Savannah' },
  { id: 'atelier', title: 'The Atelier',    note: 'Cut, measured, finished',    kind: 'adinkra-indigo', seed: 1706, meta: 'Osu, Accra' }
];
