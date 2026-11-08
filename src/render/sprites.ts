// Pokémon sprites: Gen 5 (Black/White) front sprites, loaded by URL (decided in milestone 4: no local copy; switching
// to local files only means changing spriteUrl). Each one is trimmed to its visible pixels once loaded, so the
// Pokémon's feet can stand on the floor.

export const spriteUrl = (speciesId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${speciesId}.png`;

export interface Sprite {
  image: CanvasImageSource;
  width: number;
  height: number;
}

const cache = new Map<number, Sprite | 'loading' | 'failed'>();

/** The sprite if it is ready; starts loading it otherwise (and returns null until then, or if it can't load). */
export function getSprite(speciesId: number): Sprite | null {
  const cached = cache.get(speciesId);
  if (cached === undefined) load(speciesId);
  return typeof cached === 'object' ? cached : null;
}

function load(speciesId: number) {
  cache.set(speciesId, 'loading');
  const image = new Image();
  image.crossOrigin = 'anonymous'; // needed to read its pixels for trimming (the sprite host allows it)
  image.onload = () => cache.set(speciesId, trim(image));
  image.onerror = () => cache.set(speciesId, 'failed');
  image.src = spriteUrl(speciesId);
}

/** Crops the transparent border. Tiny images (the browser tests' stubs) count as missing: the fallback is drawn. */
function trim(image: HTMLImageElement): Sprite | 'failed' {
  if (image.naturalWidth < 8 || image.naturalHeight < 8) return 'failed';
  const full = document.createElement('canvas');
  full.width = image.naturalWidth;
  full.height = image.naturalHeight;
  const ctx = full.getContext('2d');
  if (!ctx) return { image, width: image.naturalWidth, height: image.naturalHeight };
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, full.width, full.height);
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return 'failed';
  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  cropped.getContext('2d')?.drawImage(full, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { image: cropped, width: cropped.width, height: cropped.height };
}

/** Starts loading these sprites now (both teams when a battle starts), so a Pokémon coming in is ready to draw. */
export function preloadSprites(speciesIds: readonly (number | null)[]): void {
  for (const id of speciesIds) if (id !== null) getSprite(id);
}
