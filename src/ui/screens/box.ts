// The PC box: the party in a column on the left, the box as a grid of slots on the right, and the focused Pokémon's
// details underneath. A moves the focused Pokémon across (party → box, box → party).

import { h } from '../dom';
import { mount } from '../focus';
import { button, heading, hintBar, hpBar, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export interface BoxMon {
  name: string;
  level: string;
  sprite: string;
  hp: number;
  maxHp: number;
  types: { type: string; label: string }[];
  /** What A does with it ("Send to the box"), or why it can't. */
  action: string;
  blocked: boolean;
  onMove: () => void;
}

export interface BoxView {
  title: string;
  partyLabel: string;
  boxLabel: string;
  empty: string;
  party: BoxMon[];
  box: BoxMon[];
  back: ButtonSpec;
  hints: Hint[];
}

/** The box always shows at least this many slots, so it looks like a box even when nearly empty. */
const MIN_SLOTS = 24;

function slot(mon: BoxMon, testid: string, wrapper: string, details: (mon: BoxMon) => void, compact: boolean) {
  const slotButton = h(
    'button',
    {
      class: `slot${compact ? ' compact' : ''}`,
      testid,
      attrs: {
        type: 'button',
        'aria-label': `${mon.name} ${mon.level}`,
        ...(mon.blocked ? { 'aria-disabled': 'true', 'data-focusable': '' } : {}),
      },
    },
    [
      pokemonSprite(mon.sprite, 'sprite slot-sprite'),
      compact ? null : h('span', { class: 'slot-info' }, [h('strong', { text: mon.name }), h('small', { text: mon.level }), hpBar(mon.hp, mon.maxHp)]),
    ],
  );
  if (!mon.blocked) slotButton.addEventListener('click', mon.onMove);
  slotButton.addEventListener('focus', () => details(mon));
  return h('div', { class: 'slot-wrap', testid: wrapper }, [slotButton]);
}

export function renderBox(root: HTMLElement, view: BoxView) {
  const detail = h('div', { class: 'box-detail glass' });
  const details = (mon: BoxMon) =>
    detail.replaceChildren(
      pokemonSprite(mon.sprite, 'sprite box-detail-sprite'),
      h('div', { class: 'box-detail-text' }, [
        h('strong', { class: 'display', text: mon.name }),
        h('span', { class: 'pills' }, [h('small', { class: 'level-tag', text: mon.level }), ...mon.types.map(t => typePill(t.type, t.label))]),
        hpBar(mon.hp, mon.maxHp),
        h('small', { class: `box-action${mon.blocked ? ' blocked' : ''}`, text: mon.action }),
      ]),
    );
  const empties = Math.max(0, MIN_SLOTS - view.box.length);

  mount(
    root,
    screen('box', 'box-screen', view.title, [
      h('header', { class: 'box-head' }, [heading(view.title)]),
      h('section', { class: 'box-party glass' }, [
        h('h3', { class: 'label', text: view.partyLabel }),
        h('div', { class: 'box-party-list' }, view.party.map((mon, i) => slot(mon, `to-box-${i}`, `party-${i}`, details, false))),
      ]),
      h('section', { class: 'box-grid-wrap glass' }, [
        h('h3', { class: 'label', text: view.boxLabel }),
        h('div', { class: 'box-grid' }, [
          ...view.box.map((mon, i) => slot(mon, `to-party-${i}`, `boxed-${i}`, details, true)),
          ...Array.from({ length: empties }, () => h('span', { class: 'slot empty', attrs: { 'aria-hidden': 'true' } })),
        ]),
        view.box.length === 0 ? h('p', { class: 'box-empty', text: view.empty }) : null,
      ]),
      detail,
      h('footer', { class: 'screen-foot box-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
  const first = view.party[0];
  if (first && !detail.hasChildNodes()) details(first);
}
