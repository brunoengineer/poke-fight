// The journey's special places: the Safari Zone's gate, the League's hall (the five opponents in a row), the Hall of
// Fame, the credits, and the road to the next region.

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, picture, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export interface SafariView {
  title: string;
  info: string[];
  ball: string;
  balls: number;
  buttons: ButtonSpec[];
  hints: Hint[];
}

export function renderSafari(root: HTMLElement, view: SafariView) {
  mount(
    root,
    screen('safari', 'gate-screen', view.title, [
      h('div', { class: 'gate glass' }, [
        h('div', { class: 'gate-balls' }, [picture(view.ball, 'item gate-ball'), h('strong', { class: 'gate-count', text: `×${view.balls}` })]),
        heading(view.title),
        ...view.info.map((line, i) => h('p', { class: i === 0 ? 'gate-main' : 'screen-info', testid: `safari-info-${i}`, text: line })),
        h('div', { class: 'gate-buttons' }, view.buttons.map(spec => button({ ...spec, class: 'wide' }))),
      ]),
      hintBar(view.hints),
    ]),
  );
}

export interface LeagueSeat {
  name: string;
  title: string;
  sprite: string;
  type: { type: string; label: string } | null;
  state: 'beaten' | 'next' | 'waiting';
}

export interface LeagueView {
  title: string;
  info: string[];
  seats: LeagueSeat[];
  buttons: ButtonSpec[];
  hints: Hint[];
}

export function renderLeague(root: HTMLElement, view: LeagueView) {
  mount(
    root,
    screen('league', 'league-screen', view.title, [
      h('header', { class: 'screen-head center' }, [
        heading(view.title, undefined, 'h1'),
        ...view.info.map((line, i) => h('p', { class: i === 0 ? 'league-progress' : 'screen-info', testid: `league-info-${i}`, text: line })),
      ]),
      h(
        'div',
        { class: 'seats' },
        view.seats.map((seat, i) =>
          h('div', { class: `seat ${seat.state}`, style: { '--i': i } }, [
            picture(seat.sprite, 'trainer seat-sprite'),
            h('span', { class: 'seat-plate' }, [
              h('small', { text: seat.title }),
              h('strong', { text: seat.name }),
              seat.type ? typePill(seat.type.type, seat.type.label) : null,
            ]),
            seat.state === 'beaten' ? h('span', { class: 'seat-check' }, [icon('check')]) : null,
          ]),
        ),
      ),
      h('footer', { class: 'league-foot' }, [h('div', { class: 'league-buttons' }, view.buttons.map(spec => button(spec))), hintBar(view.hints)]),
    ]),
  );
}

export interface HallView {
  title: string;
  entry: string;
  team: { name: string; level: string; sprite: string }[];
  next: ButtonSpec;
  hints: Hint[];
}

export function renderHallOfFame(root: HTMLElement, view: HallView) {
  mount(
    root,
    screen('hall-of-fame', 'hall-screen', view.title, [
      h('span', { class: 'confetti', attrs: { 'aria-hidden': 'true' } }),
      h('header', { class: 'screen-head center' }, [heading(view.title, undefined, 'h1'), h('p', { class: 'screen-info', text: view.entry })]),
      h(
        'div',
        { class: 'pedestals' },
        view.team.map((p, i) =>
          h('div', { class: 'pedestal', style: { '--i': i } }, [
            pokemonSprite(p.sprite, 'sprite pedestal-sprite'),
            h('span', { class: 'pedestal-top' }),
            h('strong', { text: p.name }),
            h('small', { text: p.level }),
          ]),
        ),
      ),
      h('footer', { class: 'screen-foot center' }, [button({ ...view.next, primary: true }), hintBar(view.hints)]),
    ]),
  );
}

export interface PageView {
  testid: string;
  title: string;
  lines: string[];
  buttons: ButtonSpec[];
  hints: Hint[];
}

/** A simple centered page (the credits, the next region). */
export function renderPage(root: HTMLElement, view: PageView) {
  mount(
    root,
    screen(view.testid, 'page-screen', view.title, [
      h('div', { class: 'page glass' }, [
        heading(view.title, undefined, 'h1'),
        ...view.lines.map((line, i) => h('p', { class: 'page-line', style: { '--i': i }, text: line })),
        h('div', { class: 'gate-buttons' }, view.buttons.map(spec => button({ ...spec, class: 'wide' }))),
      ]),
      hintBar(view.hints),
    ]),
  );
}
