// Units used by the fight simulation.
//   - Positions and speeds are whole numbers in sub-pixels (1 px = 256 units): no floating-point drift, so the same
//     inputs always give exactly the same fight.
//   - x grows to the right, y grows upwards from the floor (y = 0 is standing on the floor).
//   - Times are in frames (60 per second).

export const SUB = 256;

/** Pixels → sub-pixels. */
export const px = (pixels: number) => Math.round(pixels * SUB);

/** The arena is as wide as the screen (no camera yet). */
export const STAGE_WIDTH = px(480);

/** Placeholder body: the push box and the hurt box for now. */
export const BODY_HALF_WIDTH = px(16);
export const BODY_HEIGHT = px(48);

export const START_X: readonly [number, number] = [px(160), px(320)];

/** Placeholder HP until Pokémon stats arrive (milestone 4). */
export const MAX_HP = 1000;

/** A button press is remembered this many frames, so it fires as soon as the current action ends. */
export const BUFFER_FRAMES = 6;

/** Most frames between the two taps of a double-tap dash. */
export const DASH_WINDOW = 12;

/** Both fighters freeze this many frames when a hit lands (the "impact"). */
export const HITSTOP = 6;
