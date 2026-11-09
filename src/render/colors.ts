// Colors shared by the fight's drawings.

/** The usual colors of the 18 types. */
export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878',
  fighting: '#c03028',
  flying: '#a890f0',
  poison: '#a040a0',
  ground: '#e0c068',
  rock: '#b8a038',
  bug: '#a8b820',
  ghost: '#705898',
  steel: '#b8b8d0',
  fire: '#f08030',
  water: '#6890f0',
  grass: '#78c850',
  electric: '#f8d030',
  psychic: '#f85888',
  ice: '#98d8d8',
  dragon: '#7038f8',
  dark: '#705848',
  fairy: '#ee99ac',
};

export const typeColor = (type: string | null | undefined) => (type ? (TYPE_COLORS[type] ?? '#a0a0a0') : '#a0a0a0');

/** The fonts loaded by index.html, with fallbacks (canvas texts, the same as the menus'). */
export const PIXEL_FONT = '"Pixelify Sans", ui-monospace, monospace';
export const DISPLAY_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const BODY_FONT = 'Inter, system-ui, sans-serif';
