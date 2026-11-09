// The world map: Kanto drawn as a simple illustrated island (SVG), the cities as buttons on it, joined by routes. The
// d-pad moves between cities by direction (spatial navigation), the side panel describes the focused one, A travels.

import { h, svg } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, picture, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export interface MapCity {
  id: string;
  name: string;
  tagline: string;
  /** On the map, in a 100 × 60 box. */
  x: number;
  y: number;
  here: boolean;
  open: boolean;
  /** "You are here", "Needs 2 badge(s)"… */
  status: string;
  gym: { leader: string; sprite: string; type: string; typeLabel: string; beaten: boolean; label: string } | null;
  onGo: () => void;
}

export interface MapView {
  title: string;
  cities: MapCity[];
  routes: [string, string][];
  back: ButtonSpec;
  hints: Hint[];
}

const W = 100;
const H = 60;

function drawKanto(view: MapView) {
  const at = new Map(view.cities.map(c => [c.id, c]));
  const routes = view.routes.flatMap(([a, b]) => {
    const from = at.get(a);
    const to = at.get(b);
    if (!from || !to) return [];
    const open = from.open && to.open;
    return [svg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: `route${open ? ' open' : ''}` })];
  });
  return svg('svg', { class: 'kanto', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('linearGradient', { id: 'land', x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: '0', 'stop-color': '#7bd47f' }),
        svg('stop', { offset: '1', 'stop-color': '#3f9a5a' }),
      ]),
      svg('pattern', { id: 'waves', width: 6, height: 3, patternUnits: 'userSpaceOnUse' }, [
        svg('path', { d: 'M0 1.5 Q1.5 0.5 3 1.5 T6 1.5', class: 'wave' }),
      ]),
    ]),
    svg('rect', { x: 0, y: 0, width: W, height: H, class: 'sea' }),
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#waves)', class: 'sea-waves' }),
    // The mainland and Cinnabar Island (shapes made for this map, roughly Kanto's).
    svg('path', {
      class: 'land',
      d: 'M5 7 Q18 1 36 4 Q52 1 66 4 Q84 3 89 13 Q94 26 88 38 Q82 49 66 48 Q58 55 46 56 Q36 55 32 49 L18 49 Q8 46 8 32 Q3 18 5 7 Z',
    }),
    svg('circle', { class: 'land', cx: 21, cy: 55.5, r: 3.6 }),
    // Light from the top-left: a soft highlight on the land, a lake by Cerulean.
    svg('ellipse', { class: 'land-light', cx: 40, cy: 18, rx: 30, ry: 12 }),
    svg('ellipse', { class: 'lake', cx: 66, cy: 9, rx: 3.4, ry: 1.6 }),
    // A compass in the sea.
    svg('g', { class: 'compass', transform: 'translate(93 52)' }, [
      svg('circle', { r: 4.2 }),
      svg('path', { d: 'M0 -3.4 L0.9 0 L0 3.4 L-0.9 0 Z M-3.4 0 L0 -0.9 L3.4 0 L0 0.9 Z' }),
    ]),
    // Mountains (Mt. Moon, the Rock Tunnel, Victory Road) and a forest, for flavor.
    ...[
      [36, 11],
      [40, 9],
      [70, 17],
      [73, 19],
      [11, 20],
      [13, 23],
    ].map(([x, y]) => svg('path', { class: 'mountain', d: `M${x - 2.4} ${y + 2} L${x} ${y - 2} L${x + 2.4} ${y + 2} Z` })),
    ...[
      [18, 21],
      [20, 23],
      [16, 24],
      [26, 22],
    ].map(([x, y]) => svg('circle', { class: 'tree', cx: x, cy: y, r: 1.4 })),
    ...routes,
  ]);
}

export function renderMap(root: HTMLElement, view: MapView) {
  const panel = h('aside', { class: 'map-panel glass' });
  const describe = (c: MapCity) =>
    panel.replaceChildren(
      ...[
      h('small', { class: 'map-status' }, [icon(c.here ? 'pin' : c.open ? 'map' : 'lock'), c.status]),
      h('h2', { class: 'display', text: c.name }),
      h('p', { class: 'tagline', text: c.tagline }),
      c.gym
        ? h('div', { class: `map-gym${c.gym.beaten ? ' beaten' : ''}` }, [
            picture(c.gym.sprite, 'trainer map-gym-leader'),
            h('div', {}, [h('small', { text: c.gym.label }), h('strong', { text: c.gym.leader }), typePill(c.gym.type, c.gym.typeLabel)]),
            c.gym.beaten ? icon('check', 'icon map-gym-check') : null,
          ])
        : null,
      ].filter(child => child !== null),
    );

  const nodes = view.cities.map(c => {
    const node = h(
      'button',
      {
        class: `node${c.here ? ' here' : ''}${c.open ? '' : ' locked'}`,
        testid: `go-${c.id}`,
        attrs: {
          type: 'button',
          'aria-label': `${c.name}: ${c.status}`,
          ...(c.here ? { 'data-autofocus': '' } : {}),
          // The current city and locked ones can still be focused (to read about them), but not travelled to.
          ...(c.here || !c.open ? { 'aria-disabled': 'true', 'data-focusable': '' } : {}),
        },
      },
      [h('span', { class: 'node-dot' }, [c.here ? icon('pin') : !c.open ? icon('lock') : null]), h('span', { class: 'node-name', text: c.name })],
    );
    if (c.open && !c.here) node.addEventListener('click', c.onGo);
    node.addEventListener('focus', () => describe(c));
    return h('div', { class: 'place', testid: `place-${c.id}`, style: { left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%` } }, [
      node,
      h('small', { class: 'node-status', text: c.status }),
    ]);
  });

  mount(
    root,
    screen('map', 'map-screen', view.title, [
      h('header', { class: 'box-head' }, [heading(view.title)]),
      h('div', { class: 'map-board' }, [drawKanto(view), ...nodes]),
      panel,
      h('footer', { class: 'screen-foot map-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
  const here = view.cities.find(c => c.here) ?? view.cities[0];
  if (here && !panel.hasChildNodes()) describe(here);
}
