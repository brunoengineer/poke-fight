// Small line icons for the menus (24×24, drawn with the current text color). Simple shapes made for this game.

import { svg } from './dom';

const PATHS = {
  grass: 'M4 20c1-5 2-8 4-11M8 20c0-4 1-8 4-13M12 20c1-4 3-7 6-10M16 20c0-3 1-5 4-7M3 20h18',
  cave: 'M3 20 8 7l4 4 3-5 6 14H3zM10 20c0-3 1-5 2-5s2 2 2 5',
  water: 'M3 9c3-2 6 2 9 0s6-2 9 0M3 14c3-2 6 2 9 0s6-2 9 0M3 19c3-2 6 2 9 0s6-2 9 0',
  rod: 'M4 20 18 4M18 4v11a2 2 0 1 1-4 0M4 20l2-1',
  gym: 'M3 10 12 4l9 6M5 10v9h14v-9M9 19v-5h6v5M3 19h18',
  battle: 'M5 4l9 9M4 5l1-1M14 13l-2 2-3-3 2-2M19 4l-9 9M20 5l-1-1M10 13l2 2 3-3-2-2M7 17l-3 3M17 17l3 3',
  heal: 'M9 4h6v5h5v6h-5v5H9v-5H4V9h5z',
  mart: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  pc: 'M4 5h16v11H4zM9 20h6M12 16v4',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  party: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h6M15 12h6M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  gear: 'M10.3 2.5h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  check: 'M4 12l5 5L20 6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9h4a2 2 0 0 1 0 4H9V8M9 16v-3',
  dex: 'M5 3h11l3 3v15H5zM8 8h8M8 12h8M8 16h5',
  swap: 'M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4',
  crown: 'M3 8l4 5 5-7 5 7 4-5-2 11H5z',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  keyboard: 'M3 7h18v11H3zM6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M7 14h10',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  safari: 'M4 20c2-6 6-9 8-9s6 3 8 9M12 11V4M9 6l3-2 3 2M7 20h10',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, className = 'icon') {
  return svg('svg', { class: className, viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: PATHS[name] }),
  ]);
}
