// The player's gear as hand-placed pixel art (PokeAPI has no Pokédex or bag sprite), in the style of the GBA games:
// one character per pixel, '.' for transparent, each letter a color of the sprite's palette.
//   - the bag: a yellow backpack (two rolled-up lobes on top, a cream flap with a grey buckle, side pockets with a
//     strap and a red tag, a front panel between two seams, a grey base), navy outlines;
//   - the Pokédex, opened: the left half with its big blue lens, three lights, a screen, a d-pad; the hinge; the right
//     half with a small screen, a blue keypad and two buttons; a darker band below for its thickness.
// Drawn for this game (the art was made from scratch, after reference pictures the player liked). The city's bottom
// bar shows them.

import { Pixels, rgb } from './pixel';

export type Gear = 'pokedex' | 'bag';

interface Sprite {
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
}

const SPRITES: Record<Gear, Sprite> = {
  bag: {
    palette: {
      O: '#36366e', // outline (navy)
      H: '#fff8cc', // highlight
      L: '#fbe58a', // light
      Y: '#f4c94c', // base yellow
      S: '#d9a23a', // shade
      D: '#a8742a', // deep shade
      g: '#d6d6e2', // grey, lit
      G: '#9a9ab0', // grey
      K: '#5c5c7a', // grey, dark
      R: '#f0663a', // the tag
      r: '#b8401f',
    },
    rows: [
    '................................',
    '........OOO..........OOO........',
    '.......OYYYO........OYYYO.......',
    '......OSLHHLO......OLHHLSO......',
    '.....OYSLHLLLO....OLLHLLSYO.....',
    '.....OYSLLLLLO....OLLLLLSYO.....',
    '.....OYSYYYYYOOOOOOYYYYYSYO.....',
    '.....OYSYYYYYYYYYYYYYYYYSYO.....',
    '......OSSSSSSSSSSSSSSSSSSO......',
    '.....OYSLHHHHHHHHHHHHHHLSYO.....',
    '.....OYSLHHHHHHHHHHHHHHLSYO.....',
    '.....OYSLHHHHKggggKHHHHLSYO.....',
    '.....OYSLLLLLgGLLGgLLLLLSYO.....',
    '.....OYSLLLLLGGYYGGLLLLLSYO.....',
    '....OOYSYYYYYKKYYKKYYYYYSYOOOO..',
    '...OYYYOOOOOOOOKKOOOOOOOOYYYRRO.',
    '..OLLLYSSSSSSSSSSSSSSSSSDYLLLRrO',
    '..OLLLYLLYSLYYYYYYYYYSYSDYLLLrO.',
    '..OSYYYLLYSLYYYYYYYYYSYSDYYYSO..',
    '.OKGGGKLLYSLYYYYYYYYYSYSDKGGGKO.',
    '..OSYYYLLYSLYYYYYYYYYSYSDYYYSO..',
    '..OSYYYLLYSLYYYYYYYYYSYSDYYYSO..',
    '..OSSSYLLYSLYYYYYYYYYSYSDYSSSO..',
    '..OSSSYLLYSLYYYYYYYYYSYSDYSSSO..',
    '...OSSYSSSDSSSSSSSSSSDSSDYSSO...',
    '....OOYOOOOOOOOOOOOOOOOOOYOO....',
    '......OgggGGGGGGGGGGGGGGKO......',
    '......OKKKKKKKKKKKKKKKKKKO......',
    '.......OOOOOOOOOOOOOOOOOO.......',
    '................................',
    '................................',
    '................................',
    ],
  },
  pokedex: {
    palette: {
      O: '#2a1020', // outline
      H: '#ff9c98', // highlight
      L: '#ff6a6a', // light red
      R: '#e3343c', // red
      S: '#b42230', // shade
      D: '#7a1428', // the thickness
      h: '#e3343c',
      W: '#ffffff',
      B: '#2f86e0', // blue (the lens, the keys)
      b: '#8fd0ff',
      r: '#ff5a5a', // the three lights
      Y: '#ffd84a',
      G: '#5ee36a',
      K: '#3a2a44', // screen frames, the d-pad
      k: '#d8d0e0', // buttons, lit
      C: '#7cc0dc', // screen
      c: '#bfe8f4', // screen, lit
    },
    rows: [
    '........................................',
    '...OOOOOOOOOOOOOO.......................',
    '..OLOOOOLLLLLLLLLO......................',
    '.OLOWWWWOLLLLLLLLSO.....................',
    'OLLWBbBBWRRrRYRGRSSO....................',
    'OLOWbWBBWORSRSRSRSSO....................',
    'OLLWBBBBWRRRRRRRRSSO....OOOOOOOOOOOOO...',
    'OLLOWWWWORRRRRRRRSSOOO.OLLLLLLLLLLLLLO..',
    'OLLROOOORRRRRRRRRSSODOOLLLLLLLLLLLLLLSO.',
    'OLSSSSSSSSSSSSSSSSSHLSLLRRRRRRRRRRRRRSSO',
    'OLHHHHHHHHHHHHHHHLSHLSLLKKKKKKKKKKKKKSSO',
    'OLLRRRRRRRRRRRRRRSSHSSLLKWWWccccccccKSSO',
    'OLLKKKKKKKKKKKKKRSSHLSLLKcccccccccccKSSO',
    'OLLKcWWccccccccKRSSHLSLLKcccccccccccKSSO',
    'OLLKcWcccccccccKRSSHSSLLKKKKKKKKKKKKKSSO',
    'OLLKCCCCCCCcCCCKRSSHLSLLRRRRRRRRRRRRRSSO',
    'OLLKCCCCCCCCcCCKRSSHLSLLRBbRBbRBbRBbRSSO',
    'OLLKCCCCCCCCCcCKRSSHSSLLRRRRRRRRRRRRRSSO',
    'OLLKCCCCCCCCCCCKRSSHLSLLRBbRBbRBbRBbRSSO',
    'OLLKCCCCCCCCCCCKRSSHLSLLRRRRRRRRRRRRRSSO',
    'OLLKKKKKKKKKKKKKRSSHSSLLRkkkkRRRkkkkRSSO',
    'OLLRRRRRRRRRRRRRRSSHLSLLKKKKKKRKKKKKKSSO',
    'OLLRKRRRRRRRRRRkkSSHLSLLRRRRRRRRRRRRRSSO',
    'OLLKKKRRGGGGGRRKKSSHSSLLRYYRRRRRRRRRRSSO',
    'OLSSKSSSSSSSSSSSSSSHLSLSSSSSSSSSSSSSSSSO',
    '.ODDDDDDDDDDDDDDDDOHLSODDDDDDDDDDDDDDDO.',
    '..ODDDDDDDDDDDDDDOOHLSOODDDDDDDDDDDDDO..',
    '...OOOOOOOOOOOOOO.ODDDO.OOOOOOOOOOOOO...',
    '...................OOO..................',
    '........................................',
    ],
  },
};

const cache = new Map<Gear, string>();

/** The picture as an image URL (painted once), on a transparent background. */
export function gearPicture(gear: Gear): string {
  let url = cache.get(gear);
  if (!url) {
    url = paint(SPRITES[gear]).toCanvas().toDataURL('image/png');
    cache.set(gear, url);
  }
  return url;
}

function paint(sprite: Sprite): Pixels {
  const p = new Pixels(sprite.rows[0].length, sprite.rows.length);
  sprite.rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      const color = sprite.palette[char];
      if (color) p.set(x, y, rgb(color));
    }),
  );
  return p;
}

/** For the tests: every pixel's letter has a color, and every row is as wide as the first. */
export const gearSprites = (): Record<Gear, Sprite> => SPRITES;
