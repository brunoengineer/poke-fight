// Travelling between regions (the plane in the city's bottom bar): one card per region. Its legendaries stand in front
// of its pixel-art map, in its color; below, what the player has there (its badges, the Pokédex) or, for a journey not
// started yet, the three partners to choose from. A closed region shows its legendaries as shadows.
// A on an open region flies there (the flight screen), then the journey there goes on, or a new one starts.
// The flight: the plane crosses a sky of drifting clouds toward the destination's color; A skips it.

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { badgePicture, button, heading, hintBar, picture, pokemonSprite, screen, type ButtonSpec, type Hint } from '../kit';

export interface TravelRegion {
  id: string;
  name: string;
  /** Its map, painted (a canvas). */
  map: HTMLCanvasElement | null;
  color: string;
  status: string;
  state: 'here' | 'open' | 'new' | 'locked' | 'soon';
  onFly: () => void;
  /** "Gen II" and "251 Pokémon". */
  generation: string;
  species: string;
  /** Its legendaries' sprites: the one in front first, then the two beside it. */
  legends: string[];
  /** A journey there: its badges (earned or not) and its Pokédex. */
  journey: { badgesLabel: string; badges: { url: string; earned: boolean }[]; dexLabel: string; caught: number; total: number } | null;
  /** No journey yet: the three partners to choose from. */
  partners: { label: string; sprites: string[] } | null;
}

export interface TravelView {
  title: string;
  info: string;
  regions: TravelRegion[];
  back: ButtonSpec;
  hints: Hint[];
}

function legends(r: TravelRegion) {
  const hidden = r.state === 'locked' || r.state === 'soon';
  const [front, ...sides] = r.legends;
  return h('span', { class: 'travel-legends' }, [
    h('span', { class: 'travel-glow' }),
    ...sides.map((url, i) => pokemonSprite(url, `sprite travel-legend side ${i === 0 ? 'left' : 'right'}`, { silhouette: hidden })),
    front ? pokemonSprite(front, 'sprite travel-legend front', { silhouette: hidden }) : null,
  ]);
}

function journey(r: TravelRegion) {
  const j = r.journey;
  if (!j) return null;
  const earned = j.badges.filter(b => b.earned).length;
  return h('span', { class: 'travel-journey' }, [
    h('span', { class: 'travel-row' }, [
      h('span', { class: 'travel-label', text: j.badgesLabel }),
      h('span', { class: 'travel-count', text: `${earned}/${j.badges.length}` }),
    ]),
    h(
      'span',
      { class: 'travel-badges', testid: `travel-${r.id}-badges` },
      j.badges.map(b => h('span', { class: `travel-badge${b.earned ? ' earned' : ''}` }, [badgePicture(b.url, 'badge')])),
    ),
    h('span', { class: 'travel-row' }, [
      h('span', { class: 'travel-label', text: j.dexLabel }),
      h('span', { class: 'travel-count', testid: `travel-${r.id}-dex`, text: `${j.caught}/${j.total}` }),
    ]),
    h('span', { class: 'travel-bar' }, [h('span', { style: { '--p': `${Math.min(100, (100 * j.caught) / Math.max(1, j.total))}%` } })]),
  ]);
}

function partners(r: TravelRegion) {
  const p = r.partners;
  if (!p) return null;
  return h('span', { class: 'travel-partners' }, [
    h('span', { class: 'travel-label', text: p.label }),
    h('span', { class: 'travel-partner-row' }, p.sprites.map(url => pokemonSprite(url, 'sprite travel-partner'))),
  ]);
}

export function renderTravel(root: HTMLElement, view: TravelView) {
  const cards = view.regions.map((r, i) => {
    const usable = r.state === 'open' || r.state === 'new';
    const closed = r.state === 'locked' || r.state === 'soon';
    const card = h(
      'button',
      {
        class: `travel-card ${r.state}`,
        testid: `travel-${r.id}`,
        style: { '--c': r.color, '--i': i },
        attrs: {
          type: 'button',
          'aria-label': `${r.name}: ${r.status}`,
          ...(usable ? {} : { 'aria-disabled': 'true', 'data-focusable': '' }),
          ...(r.state === 'here' ? { 'data-autofocus': '' } : {}),
        },
      },
      [
        h('span', { class: 'travel-scene' }, [h('span', { class: 'travel-map' }, r.map ? [r.map] : [])]),
        h('span', { class: 'travel-head' }, [
          h('span', { class: 'travel-gen' }, [h('b', { text: r.generation }), h('span', { text: r.species })]),
          h('strong', { class: 'display travel-name', text: r.name }),
        ]),
        legends(r),
        closed ? h('span', { class: 'travel-lock' }, [icon('lock')]) : null,
        h('span', { class: 'travel-info' }, [
          journey(r),
          partners(r),
          h('small', { class: 'travel-status', testid: `travel-${r.id}-status` }, [
            closed ? icon('lock') : r.state === 'here' ? icon('pin') : icon('arrow'),
            r.status,
          ]),
        ]),
      ],
    );
    if (usable) card.addEventListener('click', r.onFly);
    return card;
  });
  mount(
    root,
    screen('travel', 'travel-screen', view.title, [
      h('header', { class: 'screen-head' }, [heading(view.title), h('p', { class: 'screen-info', text: view.info })]),
      h('div', { class: 'travel-cards' }, cards),
      h('footer', { class: 'screen-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
}

export interface FlightView {
  /** "Flying to Johto…" */
  text: string;
  plane: string;
  from: string;
  to: string;
  skip: string;
  hints: Hint[];
  onArrive: () => void;
}

/** How long the flight takes (milliseconds; the CSS animation uses the same). */
export const FLIGHT_MS = 2600;

const testMode = () => document.documentElement.dataset.test !== undefined;

export function renderFlight(root: HTMLElement, view: FlightView) {
  let arrived = false;
  const arrive = () => {
    if (arrived) return;
    arrived = true;
    window.clearTimeout(timer);
    view.onArrive();
  };
  mount(
    root,
    screen('flight', 'flight-screen', view.text, [
      h('div', { class: 'flight-sky', style: { '--from': view.from, '--to': view.to } }, [
        ...Array.from({ length: 7 }, (_, i) => h('span', { class: 'flight-cloud', style: { '--i': i } })),
        h('span', { class: 'flight-plane' }, [picture(view.plane, 'flight-plane-image')]),
        h('span', { class: 'flight-trail' }),
      ]),
      h('div', { class: 'flight-footer glass' }, [
        h('p', { class: 'flight-text', testid: 'flight-text', text: view.text }),
        button({ label: view.skip, testid: 'flight-skip', primary: true, icon: 'arrow', onClick: arrive }),
      ]),
      hintBar(view.hints),
    ]),
  );
  // The browser tests don't wait for the plane.
  const timer = window.setTimeout(arrive, testMode() ? 0 : FLIGHT_MS);
}
