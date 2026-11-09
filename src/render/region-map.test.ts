// Every region's map stays readable (plan.md §6): each place's icon and its name fit on the map and never cover
// another place's icon or name. The boxes are the map screen's markers (ICON_BOX); a name's width is estimated from
// its English text (the longest).

import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { setLanguage, t, type MessageKey } from '../i18n';
import { ICON_BOX, iconKind, MAP_H, MAP_W } from './region-map';

/** Art pixels per unit of a region's 100 × 60 map box. */
const S = 3;
/** A name's pill: its height, and its width for a text (measured on the map screen: about 2.1 art px a letter). */
const LABEL_H = 6;
const labelWidth = (text: string) => text.length * 2.1 + 6;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function boxes(regionIndex: number) {
  const region = REGIONS[regionIndex];
  setLanguage('en');
  return Object.entries(region.map.places).map(([id, { x, y }]) => {
    const box = ICON_BOX[iconKind(region, id)];
    const px = x * S;
    const py = y * S;
    const icon = { x0: px + box.l, y0: py + box.t, x1: px + box.l + box.w, y1: py + box.t + box.h };
    const name = t(`city.${id}` as MessageKey);
    const w = labelWidth(name);
    const label = { x0: px - w / 2, y0: icon.y1 + 1, x1: px + w / 2, y1: icon.y1 + 1 + LABEL_H };
    return { id, icon, label };
  });
}

describe('the world maps', () => {
  REGIONS.forEach((region, i) => {
    it(`${region.id}: every place's icon and name fit on the map, and none covers another`, () => {
      const all = boxes(i);
      const problems: string[] = [];
      for (const a of all) {
        // The icon may reach the very edge of the map, its name too (half a letter in).
        for (const [what, r] of [
          ['icon', a.icon],
          ['name', a.label],
        ] as const) {
          if (r.x0 < -2 || r.y0 < -2 || r.x1 > MAP_W + 2 || r.y1 > MAP_H + 2) problems.push(`${a.id}'s ${what} is off the map`);
        }
        for (const b of all) {
          if (a.id >= b.id) continue;
          for (const [wa, ra] of [
            ['icon', a.icon],
            ['name', a.label],
          ] as const) {
            for (const [wb, rb] of [
              ['icon', b.icon],
              ['name', b.label],
            ] as const) {
              if (overlap(ra, rb)) problems.push(`${a.id}'s ${wa} covers ${b.id}'s ${wb}`);
            }
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });
});
