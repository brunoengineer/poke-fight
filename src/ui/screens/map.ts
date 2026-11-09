// The world map: the region in pixel art (render/region-map.ts), the cities as buttons on it, joined by routes. The
// d-pad moves between cities by direction (spatial navigation), the side panel describes the focused one, A travels.

import type { Region } from '../../data/regions';
import { iconKind, regionPicture } from '../../render/region-map';
import { townUrl } from '../../render/town';
import { h } from '../dom';
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
  /** Whose map (its land, mountains and forests are its data). */
  region: Region;
  cities: MapCity[];
  routes: [string, string][];
  back: ButtonSpec;
  hints: Hint[];
}

const W = 100;
const H = 60;

/** The pixel-art map (render/kanto-map.ts), with the roads open or not. */
function drawKanto(view: MapView) {
  const at = new Map(view.cities.map(c => [c.id, c]));
  const canvas = regionPicture(
    view.region,
    view.cities.map(c => ({ id: c.id, x: c.x, y: c.y, open: c.open })),
    view.routes.map(([from, to]) => ({ from, to, open: (at.get(from)?.open ?? false) && (at.get(to)?.open ?? false) })),
  );
  canvas.className = 'kanto';
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

export function renderMap(root: HTMLElement, view: MapView) {
  const panel = h('aside', { class: 'map-panel glass' });
  const describe = (c: MapCity) =>
    panel.replaceChildren(
      ...[
      // The place itself: its painted panorama (a town, the League's palace, the sanctuary's shrine).
      h('div', { class: `map-preview${c.open ? '' : ' locked'}`, testid: 'map-preview', style: { 'background-image': `url("${townUrl(c.id)}")` }, attrs: { 'aria-hidden': 'true' } }),
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
      // The frame over the icon; the name under it, with a pin where you are or a lock where you can't go yet.
      [h('span', { class: 'node-dot' }), h('span', { class: 'node-name' }, [c.here ? icon('pin') : !c.open ? icon('lock') : null, c.name])],
    );
    if (c.open && !c.here) node.addEventListener('click', c.onGo);
    node.addEventListener('focus', () => describe(c));
    // Which icon the map draws there (render/region-map.ts): the marker covers it.
    const kind = iconKind(view.region, c.id);
    return h('div', { class: `place ${kind}`, testid: `place-${c.id}`, style: { left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%` } }, [
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
