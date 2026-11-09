// Pictures drawn on the fight canvas besides the Pokémon: the places' backgrounds and the trainers (Showdown). They
// load by URL without crossOrigin (their host sends no CORS header): the canvas can draw them, never read them back,
// which it never needs to. Until a picture is ready (or if it can't load), callers draw their stand-in.

const cache = new Map<string, HTMLImageElement | 'loading' | 'failed'>();

export function getImage(url: string): HTMLImageElement | null {
  const cached = cache.get(url);
  if (cached === undefined) {
    cache.set(url, 'loading');
    const image = new Image();
    // A tiny image (the browser tests' stub) counts as missing: the stand-in is drawn.
    image.onload = () => cache.set(url, image.naturalWidth >= 8 ? image : 'failed');
    image.onerror = () => cache.set(url, 'failed');
    image.src = url;
  }
  return typeof cached === 'object' ? cached : null;
}

/** Starts loading pictures early (a fight's stage and trainers, while its intro plays). */
export const preloadImages = (urls: readonly string[]) => urls.forEach(getImage);
