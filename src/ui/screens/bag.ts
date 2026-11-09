// The bag: the items by pocket on the left (medicine, balls, evolution items, key items), the focused one on the
// right: what it does and, for the ones used on a Pokémon (potions, stones, the Link Cable), the party to use it on,
// each saying what it would do ("+20 HP", "Full HP", "Can evolve!", "No effect"). A on an item jumps to the first
// Pokémon it works on; A on a Pokémon uses it. The d-pad goes between the list and the party.

import { h } from '../dom';
import { mount } from '../focus';
import { button, heading, hintBar, hpBar, picture, pokemonSprite, screen, stat, type ButtonSpec, type Hint } from '../kit';

export interface BagTarget {
  testid: string;
  name: string;
  level: string;
  sprite: string;
  hp: number;
  maxHp: number;
  /** What the item would do: "+20 HP", "Can evolve!", "Full HP", "No effect". */
  note: string;
  ok: boolean;
  onUse: () => void;
}

export interface BagItem {
  id: string;
  name: string;
  count: string;
  image: string;
  text: string;
  /** Items not used from the bag: where they are used instead ("Thrown after you beat a wild Pokémon"). */
  usedElsewhere: string | null;
  targets: BagTarget[];
}

export interface BagView {
  title: string;
  money: string;
  pockets: { label: string; testid: string; items: BagItem[] }[];
  empty: string;
  useOn: string;
  /** The item shown first (after using one, the same one). */
  start: string | null;
  back: ButtonSpec;
  hints: Hint[];
}

export function renderBag(root: HTMLElement, view: BagView) {
  const detail = h('section', { class: 'bag-detail glass', testid: 'bag-detail' });

  const describe = (item: BagItem) => {
    detail.replaceChildren(
      ...[
        h('div', { class: 'bag-detail-head' }, [
          picture(item.image, 'item bag-detail-image'),
          h('div', {}, [h('strong', { class: 'display', text: item.name }), h('small', { class: 'bag-count', text: item.count })]),
        ]),
        h('p', { class: 'bag-text', testid: 'bag-text', text: item.text }),
        item.usedElsewhere
          ? h('p', { class: 'bag-elsewhere', text: item.usedElsewhere })
          : h('div', { class: 'bag-targets' }, [
              h('h3', { class: 'label', text: view.useOn }),
              ...item.targets.map(target => {
                const element = h(
                  'button',
                  {
                    class: `bag-target${target.ok ? ' ok' : ''}`,
                    testid: target.testid,
                    attrs: { type: 'button', ...(target.ok ? {} : { 'aria-disabled': 'true', 'data-focusable': '' }) },
                  },
                  [
                    pokemonSprite(target.sprite, 'sprite bag-target-sprite'),
                    h('span', { class: 'bag-target-info' }, [
                      h('span', { class: 'bag-target-line' }, [h('strong', { text: target.name }), h('small', { text: target.level })]),
                      hpBar(target.hp, target.maxHp),
                    ]),
                    h('small', { class: 'bag-target-note', text: target.note }),
                  ],
                );
                if (target.ok) element.addEventListener('click', target.onUse);
                return element;
              }),
            ]),
      ],
    );
  };

  const all = view.pockets.flatMap(p => p.items);
  const rows = view.pockets.map(pocket =>
    h('div', { class: 'bag-pocket', testid: pocket.testid }, [
      h('h3', { class: 'label', text: pocket.label }),
      ...pocket.items.map(item => {
        const row = h(
          'button',
          {
            class: 'bag-item',
            testid: `bag-${item.id}`,
            attrs: { type: 'button', ...(item.id === view.start ? { 'data-autofocus': '' } : {}) },
          },
          [picture(item.image, 'item bag-item-image'), h('span', { class: 'bag-item-name', text: item.name }), h('b', { text: item.count })],
        );
        row.addEventListener('focus', () => describe(item));
        // A: straight to the first Pokémon it works on.
        row.addEventListener('click', () => detail.querySelector<HTMLElement>('.bag-target.ok')?.focus());
        return row;
      }),
    ]),
  );

  // The panel is filled before the screen shows, so after using an item the focus can go back to the same Pokémon.
  const first = all.find(item => item.id === view.start) ?? all[0];
  if (first) describe(first);
  mount(
    root,
    screen('bag', 'bag-screen', view.title, [
      h('header', { class: 'box-head bag-head' }, [heading(view.title), stat('coin', view.money, 'bag-money', 'stat money')]),
      all.length ? h('div', { class: 'bag-list glass' }, rows) : h('p', { class: 'bag-empty glass', testid: 'bag-empty', text: view.empty }),
      all.length ? detail : null,
      h('footer', { class: 'screen-foot bag-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ].filter((part): part is HTMLElement => part !== null)),
  );
}
