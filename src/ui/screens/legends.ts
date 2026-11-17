// Visiting legends (decided 2026-11-17): in a Legends' Sanctuary, the earlier regions' legendaries come as one card
// per region; it opens this screen, a row of their cards like the sanctuary's own (A fights one; caught ones say so).

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, screen, type ButtonSpec, type Hint } from '../kit';
import { adventureRow, type PlaceCard } from './city';

export interface LegendsView {
  /** "Sinnoh" (where the sanctuary is). */
  region: string;
  /** "Legends of Kanto". */
  title: string;
  tagline: string;
  theme: string;
  cards: PlaceCard[];
  back: ButtonSpec;
  hints: Hint[];
}

export function renderLegends(root: HTMLElement, view: LegendsView) {
  mount(
    root,
    screen(
      'legends',
      'city legends-screen',
      view.title,
      [
        h('header', { class: 'topbar' }, [
          h('div', { class: 'place-name' }, [
            h('span', { class: 'region-label' }, [icon('pin'), view.region]),
            heading(view.title, 'legends-heading', 'h1'),
            h('p', { class: 'tagline', text: view.tagline }),
          ]),
        ]),
        h('main', { class: 'places' }, [adventureRow(view.cards)]),
        h('footer', { class: 'city-footer' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
      ],
      view.theme,
    ),
  );
}
