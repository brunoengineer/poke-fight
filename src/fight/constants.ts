// Units and fight-wide rules.
//   - Positions and speeds are whole numbers in sub-pixels (1 px = 256 units): no floating-point drift, so the same
//     inputs always give exactly the same fight.
//   - x grows to the right, y grows upwards from the floor (y = 0 is standing on the floor).
//   - Times are in frames (60 per second).

export const SUB = 256;

/** Pixels → sub-pixels. */
export const px = (pixels: number) => Math.round(pixels * SUB);

/** The arena is as wide as the screen (no camera yet). */
export const STAGE_WIDTH = px(480);
/** From the floor to the top of the screen (a strike's column is this tall). */
export const STAGE_HEIGHT = px(270);

/** Placeholder body: the push box and the hurt box for now. */
export const BODY_HALF_WIDTH = px(16);
export const BODY_HEIGHT = px(48);

export const START_X: readonly [number, number] = [px(160), px(320)];

/**
 * HP inside the fight is in tenths of real HP: at low levels the damage formula gives small numbers (3–5), and the
 * extra precision keeps chip damage and combo scaling meaningful. Menus show real HP (fight HP / 10, rounded up).
 */
export const HP_UNITS = 10;

/**
 * Damage scale on top of the official formula, so fights last: about 12 tackles between two equal Pokémon at Lv. 50
 * (fewer at low levels, as in the games).
 */
export const DAMAGE_SCALE = 0.6;

/** HP of the default test fighter (real Pokémon get theirs from their stats). */
export const MAX_HP = 1000;

/** A button press is remembered this many frames, so it fires as soon as the current action ends. */
export const BUFFER_FRAMES = 6;

/** Both fighters freeze this many frames when a physical hit lands (the "impact"); moves can set their own. */
export const HITSTOP = 6;

/** PP bar: one per Pokémon. Starts half full; specials spend it; landing hits refill it. */
export const PP_MAX = 100;
export const PP_START = 50;
export const ELEMENTAL_COST = 25;
/**
 * Taking damage fills the PP bar too: +1 PP for every 2% of max HP lost (decided after milestone 13, as most fighting
 * games do: the side being beaten gets its specials sooner). Guarding gives nothing, so turtling never fills it.
 */
export const PP_PER_HP_PERCENT = 0.5;

/** Specials do this fraction of their damage through a guard. */
export const CHIP_DIVISOR = 4;

/** Each hit in a combo does 10% less than the previous one, down to 40%. */
export const COMBO_SCALING = { step: 10, min: 40 };

/** Round timer. When it runs out, the Pokémon with the lower HP % faints. */
export const ROUND_FRAMES = 99 * 60;
