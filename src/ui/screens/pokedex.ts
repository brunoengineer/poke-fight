// The Pokédex, in two screens:
//   - the list: a filter bar (owned, type, legendary, mythical, number range) over a grid of the matching species
//     (unseen ones as silhouettes, a Poké Ball on caught ones). A opens one.
//   - a species' page: what the player knows about it, growing from unseen (only its number) to seen (name, types,
//     kind, family, where it lives) to caught (size, entry, base stats, catch rate). The text scrolls with the
//     d-pad when it is long; LB / RB go to the previous / next one in the list; B goes back to the list.

import { h } from '../dom';
import { focusStart, mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export type DexTileStatus = 'unseen' | 'seen' | 'caught';

export interface DexTile {
  id: number;
  number: string;
  /** "???" while unseen. */
  name: string;
  sprite: string;
  status: DexTileStatus;
  /** Has one now (party or box). */
  owned: boolean;
}

export interface DexChoice {
  label: string;
  testid: string;
  selected: boolean;
  onPick: () => void;
}

/** A filter: a switch (on / off), or a choice from a list (it opens a picker). */
export type DexFilterButton =
  | { kind: 'toggle'; label: string; testid: string; on: boolean; onToggle: () => void }
  | { kind: 'choice'; label: string; value: string; testid: string; active: boolean; title: string; choices: DexChoice[] };

export interface DexListView {
  title: string;
  /** "Seen 12 · Caught 5 · 151" */
  counts: string;
  filters: DexFilterButton[];
  /** "Clear filters" (only while some filter is on). */
  clear: ButtonSpec | null;
  /** "24 shown" */
  shown: string;
  /** "No Pokémon match these filters" */
  empty: string;
  tiles: DexTile[];
  /** The species focused first (the one just viewed). */
  start: number | null;
  onOpen: (id: number) => void;
  cancel: string;
  back: ButtonSpec;
  hints: Hint[];
}

export function renderDexList(root: HTMLElement, view: DexListView) {
  const sheet = h('div', { class: 'sheet-layer' });
  const pick = (filter: Extract<DexFilterButton, { kind: 'choice' }>) => {
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
        button({ label: view.cancel, testid: `${filter.testid}-cancel`, back: true, onClick: close }),
      ]),
    );
    focusStart(root);
  };

  const filterBar = h('div', { class: 'dex-filters' }, [
    ...view.filters.map(filter =>
      filter.kind === 'toggle'
        ? h('button', {
            class: `dex-filter${filter.on ? ' on' : ''}`,
            testid: filter.testid,
            onClick: filter.onToggle,
            attrs: { type: 'button', 'aria-pressed': String(filter.on) },
          }, [h('span', { class: 'dex-check', attrs: { 'aria-hidden': 'true' } }), h('span', { text: filter.label })])
        : h('button', {
            class: `dex-filter choice${filter.active ? ' on' : ''}`,
            testid: filter.testid,
            onClick: () => pick(filter),
            attrs: { type: 'button', 'aria-haspopup': 'dialog' },
          }, [h('span', { text: filter.label }), h('b', { text: filter.value })]),
    ),
    view.clear ? button({ ...view.clear, class: 'small ghost dex-clear' }) : null,
    h('span', { class: 'dex-shown', testid: 'dex-shown', text: view.shown }),
  ]);

  const tiles = view.tiles.map(tile =>
    h(
      'button',
      {
        class: `dex-tile ${tile.status}${tile.owned ? ' owned' : ''}`,
        testid: `dex-${tile.id}`,
        onClick: () => view.onOpen(tile.id),
        attrs: { type: 'button', 'aria-label': `${tile.number} ${tile.name}`, ...(tile.id === view.start ? { 'data-autofocus': '' } : {}) },
      },
      [
        h('small', { class: 'dex-tile-number', text: tile.number }),
        pokemonSprite(tile.sprite, 'sprite dex-tile-sprite', { silhouette: tile.status === 'unseen' }),
        h('span', { class: 'dex-tile-name', text: tile.name }),
        tile.status === 'caught' ? h('span', { class: 'dex-tile-ball', attrs: { 'aria-hidden': 'true' } }) : null,
      ],
    ),
  );

  mount(
    root,
    screen('pokedex', 'dex-screen', view.title, [
      h('header', { class: 'box-head dex-head-row' }, [heading(view.title), h('span', { class: 'stat', testid: 'dex-counts', text: view.counts })]),
      filterBar,
      tiles.length ? h('div', { class: 'dex-grid glass', testid: 'dex-grid' }, tiles) : h('p', { class: 'dex-empty glass', testid: 'dex-empty', text: view.empty }),
      h('footer', { class: 'screen-foot dex-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
      sheet,
    ]),
  );
}

// ── A species' page ──────────────────────────────────────────────────────────────────────────────────────────────

export interface DexChainMon {
  sprite: string;
  name: string;
  known: boolean;
  /** "Lv. 16", "Fire Stone", "Link Cable" (how it evolves from the stage before), or null for the first. */
  how: string | null;
  current: boolean;
}

export interface DexPage {
  id: number;
  number: string;
  name: string;
  sprite: string;
  status: DexTileStatus;
  /** "Caught · you have 2", "Seen", "Not seen yet". */
  statusText: string;
  color: string;
  genus: string | null;
  types: { type: string; label: string }[];
  size: string | null;
  entry: string | null;
  legend: string | null;
  /** Stages, each with one or more Pokémon (Eevee). Empty when unseen. */
  chain: DexChainMon[][];
  where: string[];
  stats: { label: string; value: number }[] | null;
  catchRate: string | null;
}

export interface DexEntryView {
  page: DexPage;
  labels: { entry: string; family: string; where: string; stats: string; nowhere: string; unknown: string };
  /** The previous / next species in the list (null at its ends). */
  previous: ButtonSpec | null;
  next: ButtonSpec | null;
  back: ButtonSpec;
  hints: Hint[];
}

const STAT_SCALE = 160;

export function renderDexEntry(root: HTMLElement, view: DexEntryView) {
  const p = view.page;
  const section = (title: string, body: (Node | null)[], testid?: string) =>
    h('section', { class: 'dex-section', testid }, [h('h3', { class: 'label', text: title }), ...body.filter((part): part is Node => part !== null)]);

  const chain =
    p.chain.length > 1
      ? h(
          'div',
          { class: 'dex-chain', testid: 'dex-chain' },
          p.chain.flatMap((stage, i) => [
            i > 0 ? h('span', { class: 'dex-arrow' }, [icon('arrow')]) : null,
            h(
              'div',
              { class: 'dex-stage' },
              stage.map(mon =>
                h('span', { class: `dex-evo${mon.current ? ' current' : ''}` }, [
                  mon.how ? h('small', { class: 'dex-how', text: mon.how }) : null,
                  pokemonSprite(mon.sprite, 'sprite dex-evo-sprite', { silhouette: !mon.known }),
                  h('b', { text: mon.name }),
                ]),
              ),
            ),
          ]),
        )
      : null;

  // The text: it takes the focus, so the d-pad scrolls it (data-scroll) when it doesn't fit.
  const body = h('div', { class: 'dex-body', testid: 'dex-body', attrs: { 'data-scroll': '', 'data-focusable': '', 'data-autofocus': '', tabindex: '0', role: 'region', 'aria-label': p.name } }, [
    p.entry ? section(view.labels.entry, [h('p', { class: 'dex-entry', testid: 'dex-entry', text: p.entry })]) : null,
    chain ? section(view.labels.family, [chain]) : null,
    p.status !== 'unseen'
      ? section(
          view.labels.where,
          [p.where.length ? h('ul', { class: 'dex-where', testid: 'dex-where' }, p.where.map(line => h('li', { text: line }))) : h('small', { class: 'none', text: view.labels.nowhere })],
        )
      : h('p', { class: 'dex-unknown', text: view.labels.unknown }),
    p.stats
      ? section(view.labels.stats, [
          h('div', { class: 'dex-stats' }, [
            ...p.stats.map(stat =>
              h('span', { class: 'mini-stat' }, [
                h('small', { text: stat.label }),
                h('span', { class: 'mini-bar', style: { '--ratio': Math.min(1, stat.value / STAT_SCALE).toFixed(3) } }),
                h('b', { text: String(stat.value) }),
              ]),
            ),
          ]),
          p.catchRate ? h('small', { class: 'dex-catch', text: p.catchRate }) : null,
        ])
      : null,
  ].filter((part): part is HTMLElement => part !== null));

  const card = h('aside', { class: 'dex-card glass', style: { '--c': p.color } }, [
    h('span', { class: 'dex-stage-art' }, [pokemonSprite(p.sprite, 'sprite dex-sprite', { silhouette: p.status === 'unseen' })]),
    h('small', { class: 'dex-number', text: p.number }),
    h('strong', { class: 'display dex-name', testid: 'dex-name', text: p.name }),
    p.genus ? h('small', { class: 'dex-genus', testid: 'dex-genus', text: p.genus }) : null,
    p.types.length ? h('span', { class: 'pills' }, p.types.map(type => typePill(type.type, type.label))) : null,
    p.legend ? h('small', { class: 'dex-legend', text: p.legend }) : null,
    h('small', { class: `dex-status ${p.status}`, testid: 'dex-status' }, [p.status === 'caught' ? icon('ball') : null, p.statusText]),
    p.size ? h('small', { class: 'dex-size', testid: 'dex-size', text: p.size }) : null,
  ]);

  mount(
    root,
    screen('dex-species', 'dex-entry-screen', p.name, [
      h('header', { class: 'dex-entry-head' }, [
        view.previous ? button({ ...view.previous, class: 'small ghost', icon: 'arrow', pad: 'lb', key: 'KeyQ' }) : h('span'),
        heading(`${p.number} ${p.name}`, 'dex-entry-heading'),
        view.next ? button({ ...view.next, class: 'small ghost dex-next', icon: 'arrow', pad: 'rb', key: 'KeyE' }) : h('span'),
      ]),
      card,
      body,
      h('footer', { class: 'screen-foot dex-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
}
