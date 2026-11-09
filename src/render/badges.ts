// The gym badges come from PokeAPI as 85×85 drawings with a partial white rim (a sticker edge). Shown small, that rim
// breaks into white dots around the badge. Each badge is cleaned once when it loads: the white pixels on its outer
// edge become transparent (two passes deep), so its dark outline is the edge. The art stays loaded by URL.

/** Near-white and nearly grey: the rim's color (not a badge's own white highlights inside). */
const isRim = (r: number, g: number, b: number) => r > 190 && g > 190 && b > 190 && Math.max(r, g, b) - Math.min(r, g, b) < 40;

/**
 * Makes the white rim on the outer edge transparent, in place (RGBA pixels, `passes` pixels deep). Only pixels that
 * touch the outside are looked at, so white inside the badge is kept. Returns how many pixels it cleared.
 */
export function trimWhiteRim(data: Uint8ClampedArray, width: number, height: number, passes = 2): number {
  let cleared = 0;
  const alpha = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : data[(y * width + x) * 4 + 3]);
  for (let pass = 0; pass < passes; pass++) {
    const edge: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;
        const outside = !alpha(x - 1, y) || !alpha(x + 1, y) || !alpha(x, y - 1) || !alpha(x, y + 1);
        if (outside && isRim(data[i], data[i + 1], data[i + 2])) edge.push(i);
      }
    }
    for (const i of edge) data[i + 3] = 0;
    cleared += edge.length;
    if (edge.length === 0) break;
  }
  return cleared;
}

const cleaned = new Map<string, Promise<string>>();

/** The badge without its white rim, as an image URL (the original if it can't be read). */
export function cleanBadge(url: string): Promise<string> {
  let result = cleaned.get(url);
  if (!result) {
    result = new Promise<string>(resolve => {
      const image = new Image();
      // PokeAPI's host allows reading the pixels (it sends CORS headers).
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(url);
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          trimWhiteRim(pixels.data, canvas.width, canvas.height);
          ctx.putImageData(pixels, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(url);
        }
      };
      image.onerror = () => resolve(url);
      image.src = url;
    });
    cleaned.set(url, result);
  }
  return result;
}
