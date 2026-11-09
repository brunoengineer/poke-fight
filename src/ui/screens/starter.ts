// Choosing the first partner: three big cards, each with the Pokémon, its type and its base stats.

import { h } from '../dom';
import { mount } from '../focus';
import { heading, hintBar, picture, pokemonSprite, screen, typePill, type Hint } from '../kit';

export interface StarterView {
  title: string;
  subtitle: string;
  professor: string;
  starters: {
    testid: string;
    name: string;
    sprite: string;
    color: string;
    types: { type: string; label: string }[];
    stats: { label: string; value: number }[];
    onClick: () => void;
  }[];
  hints: Hint[];
}

/** Base stats are drawn against this value (a strong starter stat is around 65). */
const STAT_SCALE = 100;

export function renderStarter(root: HTMLElement, view: StarterView) {
  mount(
    root,
    screen('starters', 'starter-screen', view.title, [
      h('header', { class: 'screen-head center' }, [heading(view.title), h('p', { class: 'screen-info', text: view.subtitle })]),
      h(
        'div',
        { class: 'starters' },
        view.starters.map((starter, i) =>
          h(
            'button',
            {
              class: 'card starter-card',
              testid: starter.testid,
              onClick: starter.onClick,
              style: { '--c': starter.color, '--i': i },
              attrs: { type: 'button', ...(i === 0 ? { 'data-primary': '' } : {}) },
            },
            [
              h('span', { class: 'starter-stage' }, [h('span', { class: 'starter-ring' }), pokemonSprite(starter.sprite, 'sprite starter-sprite')]),
              h('span', { class: 'starter-info' }, [
                h('strong', { class: 'card-title', text: starter.name }),
                h('span', { class: 'pills' }, starter.types.map(t => typePill(t.type, t.label))),
                h(
                  'span',
                  { class: 'mini-stats' },
                  starter.stats.map(stat =>
                    h('span', { class: 'mini-stat' }, [
                      h('small', { text: stat.label }),
                      h('span', { class: 'mini-bar', style: { '--ratio': Math.min(1, stat.value / STAT_SCALE).toFixed(3) } }),
                      h('b', { text: String(stat.value) }),
                    ]),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
      h('footer', { class: 'screen-foot' }, [picture(view.professor, 'trainer starter-professor'), hintBar(view.hints)]),
    ]),
  );
}
