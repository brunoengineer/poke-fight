// The fight is laid out in a fixed 480×270 world (VIEW_W × VIEW_H, "art pixels"), but drawn at the screen's real
// resolution: the canvas has a whole number of *device* pixels per art pixel (`scale`), so every sprite pixel is the
// same size wherever it stands (no shimmer as it moves, even with Windows display scaling at 125% / 150%), and
// texts are drawn sharp instead of zoomed. (Decided after milestone 11: the earlier 480×270 canvas, stretched by the
// browser, blurred texts and made moving sprites flicker.)

export const VIEW_W = 480;
export const VIEW_H = 270;

/** The biggest whole-number scale that fits the available space (at least 1). */
export function integerScale(availableWidth: number, availableHeight: number): number {
  return Math.max(1, Math.floor(Math.min(availableWidth / VIEW_W, availableHeight / VIEW_H)));
}

export interface CanvasFit {
  /** Device pixels per art pixel. */
  scale: number;
  /** The canvas's drawing size (device pixels). */
  width: number;
  height: number;
  /** Its size and position inside the frame, in CSS pixels (on whole device pixels). */
  cssWidth: number;
  cssHeight: number;
  left: number;
  top: number;
}

/** Where the fight canvas goes in a frame of this size (CSS pixels), on a screen with this device pixel ratio. */
export function canvasFit(frameWidth: number, frameHeight: number, devicePixelRatio: number): CanvasFit {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const scale = integerScale(frameWidth * ratio, frameHeight * ratio);
  const width = VIEW_W * scale;
  const height = VIEW_H * scale;
  // Centered, but on whole device pixels (a half pixel would blur everything).
  const left = Math.round((frameWidth * ratio - width) / 2) / ratio;
  const top = Math.round((frameHeight * ratio - height) / 2) / ratio;
  return { scale, width, height, cssWidth: width / ratio, cssHeight: height / ratio, left, top };
}

/**
 * The frame around the game: the biggest 16:9 box in the window. Menus fill it (they scale with it, like a console
 * game); the fight canvas sits in its middle, and the place's picture fills the space around.
 */
export function frameSize(availableWidth: number, availableHeight: number): { width: number; height: number } {
  const width = Math.floor(Math.min(availableWidth, (availableHeight * VIEW_W) / VIEW_H));
  return { width, height: Math.floor((width * VIEW_H) / VIEW_W) };
}

export function fitFrame(frame: HTMLElement, canvas: HTMLCanvasElement, availableWidth: number, availableHeight: number, devicePixelRatio = 1) {
  const { width, height } = frameSize(availableWidth, availableHeight);
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  // The frame itself starts on a whole device pixel too.
  frame.style.left = `${Math.round(((availableWidth - width) / 2) * ratio) / ratio}px`;
  frame.style.top = `${Math.round(((availableHeight - height) / 2) * ratio) / ratio}px`;
  const fit = canvasFit(width, height, ratio);
  if (canvas.width !== fit.width) canvas.width = fit.width;
  if (canvas.height !== fit.height) canvas.height = fit.height;
  canvas.style.width = `${fit.cssWidth}px`;
  canvas.style.height = `${fit.cssHeight}px`;
  canvas.style.left = `${fit.left}px`;
  canvas.style.top = `${fit.top}px`;
}
