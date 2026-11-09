// Items added with generations 2–4 (evolution stones, the Soothe Bell…).
// English in `en`, Portuguese in `pt` (the same keys and {placeholders}; a test checks it).

export const en = {
  'item.sun-stone': 'Sun Stone',
  'item.dusk-stone': 'Dusk Stone',
  'item.shiny-stone': 'Shiny Stone',
  'item.dawn-stone': 'Dawn Stone',
  'item.soothe-bell': 'Soothe Bell',
  'item.sun-stone.text': 'Makes some Pokémon evolve (Gloom, Sunkern).',
  'item.dusk-stone.text': 'Makes some Pokémon evolve (Murkrow, Misdreavus).',
  'item.shiny-stone.text': 'Makes some Pokémon evolve (Togetic, Roselia).',
  'item.dawn-stone.text': 'Makes some Pokémon evolve (Kirlia, Snorunt).',
  'item.soothe-bell.text': 'Evolves the Pokémon that evolve by friendship (Pichu, Golbat, Chansey, Eevee, Togepi).',
} as const;

export const pt: Record<keyof typeof en, string> = {
  'item.sun-stone': 'Pedra do Sol',
  'item.dusk-stone': 'Pedra do Crepúsculo',
  'item.shiny-stone': 'Pedra Brilhante',
  'item.dawn-stone': 'Pedra da Aurora',
  'item.soothe-bell': 'Sino Calmante',
  'item.sun-stone.text': 'Faz alguns Pokémon evoluírem (Gloom, Sunkern).',
  'item.dusk-stone.text': 'Faz alguns Pokémon evoluírem (Murkrow, Misdreavus).',
  'item.shiny-stone.text': 'Faz alguns Pokémon evoluírem (Togetic, Roselia).',
  'item.dawn-stone.text': 'Faz alguns Pokémon evoluírem (Kirlia, Snorunt).',
  'item.soothe-bell.text': 'Evolui os Pokémon que evoluem por amizade (Pichu, Golbat, Chansey, Eevee, Togepi).',
};
