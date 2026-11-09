// The gear sprites are hand-placed pixel art: every row as wide as the first, every letter a color of the palette.

import { describe, expect, it } from 'vitest';
import { gearSprites } from './gear';

describe('gear sprites', () => {
  it('are well-formed grids with a transparent background', () => {
    for (const [name, sprite] of Object.entries(gearSprites())) {
      const width = sprite.rows[0].length;
      for (const row of sprite.rows) {
        expect(row.length, name).toBe(width);
        for (const char of row) expect(char === '.' || char in sprite.palette, `${name}: ${char}`).toBe(true);
      }
      // The corners are see-through (no background box).
      expect(sprite.rows[0][0], name).toBe('.');
      expect(sprite.rows[sprite.rows.length - 1][width - 1], name).toBe('.');
    }
  });
});
