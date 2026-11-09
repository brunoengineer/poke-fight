// Travelling between regions (the plane in the city's bottom bar): one card per region, with its pixel-art map, and
// what the player has there ("You are here", "3 badges · 24 caught", "A new journey", "Win the Kanto League first").
// A on an open region flies there (the flight screen), then the journey there goes on, or a new one starts.
// The flight: the plane crosses a sky of drifting clouds toward the destination's color; A skips it.

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, picture, screen, type ButtonSpec, type Hint } from '../kit';

export interface TravelRegion {
  id: string;
  name: string;
  /** Its map, painted (a canvas). */
  map: HTMLCanvasElement | null;
  color: string;
  status: string;
  state: 'here' | 'open' | 'new' | 'locked' | 'soon';
  onFly: () => void;
}

export interface TravelView {
  title: string;
  info: string;
  regions: TravelRegion[];
  back: ButtonSpec;
  hints: Hint[];
}

export function renderTravel(root: HTMLElement, view: TravelView) {
  const cards = view.regions.map(r => {
    const usable = r.state === 'open' || r.state === 'new';
    const card = h(
      'button',
      {
        class: `travel-card ${r.state}`,
        testid: `travel-${r.id}`,
        style: { '--c': r.color },
        attrs: {
          type: 'button',
          'aria-label': `${r.name}: ${r.status}`,
          ...(usable ? {} : { 'aria-disabled': 'true', 'data-focusable': '' }),
          ...(r.state === 'here' ? { 'data-autofocus': '' } : {}),
        },
      },
      [
        h('span', { class: 'travel-map' }, r.map ? [r.map] : []),
        h('span', { class: 'travel-text' }, [
          h('strong', { class: 'display', text: r.name }),
          h('small', { class: 'travel-status', testid: `travel-${r.id}-status` }, [
            r.state === 'locked' || r.state === 'soon' ? icon('lock') : r.state === 'here' ? icon('pin') : icon('arrow'),
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
