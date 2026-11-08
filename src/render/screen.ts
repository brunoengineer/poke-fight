// The game draws at a fixed low resolution and the canvas is scaled up by a whole number, so pixel art stays sharp
// and every sprite pixel is the same size.

export const VIEW_W = 480;
export const VIEW_H = 270;

/** The biggest whole-number scale that fits the available space (at least 1). */
export function integerScale(availableWidth: number, availableHeight: number): number {
  return Math.max(1, Math.floor(Math.min(availableWidth / VIEW_W, availableHeight / VIEW_H)));
}

/** Sets the canvas's drawing size and its on-screen size for the current window. */
export function fitCanvas(canvas: HTMLCanvasElement, availableWidth: number, availableHeight: number): number {
  const scale = integerScale(availableWidth, availableHeight);
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  return scale;
}
