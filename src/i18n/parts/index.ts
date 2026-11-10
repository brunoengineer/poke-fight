// Texts split by part, so each part of the game (a region, the bosses…) keeps its own file. en.ts and pt.ts add them
// to the base dictionaries. A new part: a file like these, added here.

import * as boss from './boss';
import * as gyms from './gyms';
import * as hoenn from './hoenn';
import * as items from './items';
import * as johto from './johto';
import * as motion from './motion';
import * as regions from './regions';
import * as sinnoh from './sinnoh';

export const partsEn = { ...items.en, ...boss.en, ...regions.en, ...johto.en, ...hoenn.en, ...sinnoh.en, ...motion.en, ...gyms.en };

export const partsPt: Record<keyof typeof partsEn, string> = { ...items.pt, ...boss.pt, ...regions.pt, ...johto.pt, ...hoenn.pt, ...sinnoh.pt, ...motion.pt, ...gyms.pt };
