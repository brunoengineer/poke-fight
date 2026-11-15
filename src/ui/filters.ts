// A filter bar, shared by the Pokédex and the PC box: switches (on / off) and choices (a value from a list, picked in a
// sheet that keeps the focus), then "Clear filters" and how many are shown.

import { h } from './dom';
import { focusStart } from './focus';
import { icon, type IconName } from './icons';
import { button, type ButtonSpec } from './kit';

export interface FilterChoice {
  label: string;
  testid: string;
  selected: boolean;
  onPick: () => void;
}

export type FilterButton =
  | { kind: 'toggle'; label: string; testid: string; on: boolean; onToggle: () => void; icon?: IconName }
  | { kind: 'choice'; label: string; value: string; testid: string; active: boolean; title: string; choices: FilterChoice[] };

export interface FilterBarSpec {
  filters: FilterButton[];
  /** "Clear filters" (only while some filter is on). */
  clear: ButtonSpec | null;
  /** "24 shown" (null: not shown). */
  shown: string | null;
  shownTestid: string;
  /** The picker's Cancel. */
  cancel: string;
  /** The first filter is where the focus starts (nothing else asked for it). */
  autofocusFirst: boolean;
}

/** The bar; `sheet` is the screen's sheet layer, where a choice's picker opens. */
export function filterBar(root: HTMLElement, sheet: HTMLElement, spec: FilterBarSpec): HTMLElement {
  const pick = (filter: Extract<FilterButton, { kind: 'choice' }>) => {
    const close = () => {
      sheet.replaceChildren();
      root.querySelector<HTMLElement>(`[data-testid="${filter.testid}"]`)?.focus();
    };
    sheet.replaceChildren(
      h('div', { class: 'sheet glass dex-picker', testid: `${filter.testid}-picker`, attrs: { 'data-nav-scope': '', role: 'dialog', 'aria-label': filter.title } }, [
        h('h3', { class: 'label', text: filter.title }),
        h(
          'div',
          { class: 'dex-choices', attrs: { 'data-nav-wrap': '' } },
          filter.choices.map(choice =>
            h('button', {
              class: `dex-choice${choice.selected ? ' selected' : ''}`,
              testid: choice.testid,
              text: choice.label,
              onClick: choice.onPick,
              attrs: { type: 'button', 'aria-pressed': String(choice.selected), ...(choice.selected ? { 'data-autofocus': '' } : {}) },
            }),
          ),
        ),
        button({ label: spec.cancel, testid: `${filter.testid}-cancel`, back: true, onClick: close }),
      ]),
    );
    focusStart(root);
  };

  return h('div', { class: 'dex-filters' }, [
    ...spec.filters.map((filter, i) =>
      filter.kind === 'toggle'
        ? h(
            'button',
            {
              class: `dex-filter${filter.on ? ' on' : ''}`,
              testid: filter.testid,
              onClick: filter.onToggle,
              attrs: { type: 'button', 'aria-pressed': String(filter.on), ...(spec.autofocusFirst && i === 0 ? { 'data-autofocus': '' } : {}) },
            },
            [filter.icon ? icon(filter.icon, 'icon dex-filter-icon') : h('span', { class: 'dex-check', attrs: { 'aria-hidden': 'true' } }), h('span', { text: filter.label })],
          )
        : h(
            'button',
            {
              class: `dex-filter choice${filter.active ? ' on' : ''}`,
              testid: filter.testid,
              onClick: () => pick(filter),
              attrs: { type: 'button', 'aria-haspopup': 'dialog', ...(spec.autofocusFirst && i === 0 ? { 'data-autofocus': '' } : {}) },
            },
            [h('span', { text: filter.label }), h('b', { text: filter.value })],
          ),
    ),
    spec.clear ? button({ ...spec.clear, class: 'small ghost dex-clear' }) : null,
    spec.shown === null ? null : h('span', { class: 'dex-shown', testid: spec.shownTestid, text: spec.shown }),
  ]);
}
