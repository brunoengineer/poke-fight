// The Poké Mart (and Saffron's mall): the clerk at the counter on the left, the shelves as a grid of item cards on
// the right, and the focused item's description underneath. A buys one; the focus stays on the item.

import { h } from '../dom';
import { mount } from '../focus';
import { button, heading, hintBar, picture, screen, stat, type ButtonSpec, type Hint } from '../kit';

export interface MartItem {
  id: string;
  name: string;
  price: string;
  owned: string;
  sprite: string;
  description: string;
  /** Can't be bought (a rod already owned). */
  soldOut: string | null;
  onBuy: () => void;
}

export interface MartView {
  title: string;
  clerkName: string;
  clerk: string;
  message: string;
  money: string;
  items: MartItem[];
  /** The item to keep the focus on (after buying it). */
  focus: string | null;
  back: ButtonSpec;
  hints: Hint[];
}

export function renderMart(root: HTMLElement, view: MartView) {
  const detail = h('p', { class: 'shelf-detail', testid: 'shop-detail' });
  const shelf = h(
    'div',
    { class: 'shelf' },
    view.items.map((item, i) =>
      h(
        'button',
        {
          class: `item-card${item.soldOut ? ' sold-out' : ''}`,
          testid: `buy-${item.id}`,
          onClick: item.onBuy,
          style: { '--i': i },
          attrs: {
            type: 'button',
            'data-description': item.description,
            ...(item.soldOut ? { disabled: '' } : {}),
            ...(view.focus === item.id ? { 'data-autofocus': '' } : {}),
          },
        },
        [
          h('span', { class: 'item-plate' }, [picture(item.sprite, 'item item-sprite')]),
          h('strong', { class: 'item-name', text: item.name }),
          h('span', { class: 'item-price', text: item.soldOut ?? item.price }),
          h('small', { class: 'item-owned', testid: `item-${item.id}`, text: item.owned }),
        ],
      ),
    ),
  );
  shelf.addEventListener('focusin', event => {
    const card = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.item-card') : null;
    if (card) detail.textContent = card.dataset.description ?? '';
  });

  mount(
    root,
    screen('shop', 'mart-screen', view.title, [
      h('div', { class: 'room' }, [
        h('span', { class: 'room-light' }),
        picture(view.clerk, 'trainer clerk'),
        h('div', { class: 'counter' }),
      ]),
      h('div', { class: 'mart-main' }, [
        h('header', { class: 'mart-head' }, [heading(view.title), stat('coin', view.money, 'shop-money', 'stat money')]),
        shelf,
        detail,
      ]),
      h('div', { class: 'dialog-box glass room-dialog' }, [
        h('strong', { class: 'name-plate', text: view.clerkName }),
        h('p', { class: 'dialog-text done', testid: 'shop-message', text: view.message }),
        h('div', { class: 'dialog-buttons' }, [button({ ...view.back, back: true })]),
      ]),
      hintBar(view.hints),
    ]),
  );
  const focused = document.activeElement as HTMLElement | null;
  detail.textContent = focused?.dataset.description ?? view.items[0]?.description ?? '';
}
