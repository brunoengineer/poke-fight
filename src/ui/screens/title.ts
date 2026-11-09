// The title screen: the logo, two Pokémon facing off, the main menu on the left (with a line about the focused
// option), and the saved journey on the right.

import { h } from '../dom';
import { mount } from '../focus';
import { icon, type IconName } from '../icons';
import { hintBar, picture, pokemonSprite, screen, type Hint } from '../kit';

export interface TitleOption {
  label: string;
  description: string;
  testid: string;
  icon: IconName;
  primary?: boolean;
  onClick: () => void;
}

export interface TitleView {
  subtitle: string;
  /** Two Pokémon facing each other behind the logo. */
  duel: [string, string];
  options: TitleOption[];
  /** The saved journey, shown next to Continue. */
  journey: { player: string; place: string; badges: string; party: string[]; trainer: string; label: string } | null;
  footer: string;
  hints: Hint[];
}

export function renderTitle(root: HTMLElement, view: TitleView) {
  const description = h('p', { class: 'menu-description', testid: 'title-description' });
  const items = view.options.map((option, i) =>
    h(
      'button',
      {
        class: 'menu-item',
        testid: option.testid,
        onClick: option.onClick,
        style: { '--i': i },
        attrs: { type: 'button', 'data-description': option.description, ...(option.primary ? { 'data-primary': '' } : {}) },
      },
      [icon(option.icon), h('span', { class: 'menu-label', text: option.label }), icon('arrow', 'icon menu-arrow')],
    ),
  );
  const menu = h('nav', { class: 'title-menu', attrs: { 'data-nav-wrap': '' } }, items);
  // The line under the menu follows the focus.
  menu.addEventListener('focusin', event => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.menu-item') : null;
    description.textContent = target?.dataset.description ?? '';
  });

  mount(
    root,
    screen('title', 'title-screen', 'Poké Fight', [
      h('div', { class: 'duel', attrs: { 'aria-hidden': 'true' } }, [
        h('span', { class: 'duel-glow left' }),
        h('span', { class: 'duel-glow right' }),
        pokemonSprite(view.duel[0], 'sprite duel-mon left'),
        pokemonSprite(view.duel[1], 'sprite duel-mon right'),
        h('span', { class: 'duel-vs', text: 'VS' }),
      ]),
      h('header', { class: 'logo' }, [
        h('h1', { class: 'logo-mark', attrs: { 'aria-label': 'Poké Fight' } }, [h('span', { class: 'logo-poke', text: 'Poké' }), h('span', { class: 'logo-fight', text: 'Fight' })]),
        h('p', { class: 'logo-subtitle', text: view.subtitle }),
      ]),
      h('div', { class: 'title-main' }, [menu, description]),
      view.journey
        ? h('aside', { class: 'journey glass', testid: 'continue-info' }, [
            picture(view.journey.trainer, 'trainer journey-trainer'),
            h('div', { class: 'journey-text' }, [
              h('small', { class: 'journey-label', text: view.journey.label }),
              h('strong', { text: view.journey.player }),
              h('span', { text: `${view.journey.place} · ${view.journey.badges}` }),
              h('span', { class: 'journey-party' }, view.journey.party.map(url => pokemonSprite(url, 'sprite journey-mon'))),
            ]),
          ])
        : null,
      h('footer', { class: 'title-footer' }, [h('small', { text: view.footer }), hintBar(view.hints)]),
    ]),
  );
  description.textContent = (document.activeElement as HTMLElement | null)?.dataset.description ?? '';
}
