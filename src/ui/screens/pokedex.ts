// The Pokédex: all 151 in a grid on the left (unseen ones as silhouettes, a Poké Ball on the ones caught), and the
// focused one's page on the right. What a page shows grows with what the player knows: nothing but its number while
// unseen; its name, types, kind, family and where it lives once seen; its size, entry, base stats and catch rate
// once caught. The d-pad moves through the grid (it scrolls with the focus).

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export type DexTileStatus = 'unseen' | 'seen' | 'caught';

export interface DexTile {
  id: number;
  number: string;
  sprite: string;
  status: DexTileStatus;
  /** Has one now (party or box). */
  owned: boolean;
}

export interface DexChainMon {
  sprite: string;
  name: string;
  known: boolean;
  /** "Lv. 16", "Fire Stone", "Link Cable" (how it evolves from the stage before), or null for the first. */
  how: string | null;
  current: boolean;
}

export interface DexPage {
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
  /** Stages, each with one or more Pokémon (Eevee). Empty when unseen. */
  chain: DexChainMon[][];
  where: string[];
  stats: { label: string; value: number }[] | null;
  catchRate: string | null;
}

export interface PokedexView {
  title: string;
  /** "Seen 12 · Caught 5 · 151" */
  counts: string;
  tiles: DexTile[];
  /** The page of a species (built when it is focused). */
  page: (id: number) => DexPage;
  /** The species focused first. */
  start: number;
  labels: { family: string; where: string; stats: string; nowhere: string };
  back: ButtonSpec;
  hints: Hint[];
}

const STAT_SCALE = 160;

export function renderPokedex(root: HTMLElement, view: PokedexView) {
  const panel = h('section', { class: 'dex-page glass', testid: 'dex-page' });

  const describe = (id: number) => {
    const p = view.page(id);
    panel.style.setProperty('--c', p.color);
    panel.dataset.status = p.status;
    const chain = p.chain.length > 1
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
    const parts = [
      h('div', { class: 'dex-head' }, [
        h('span', { class: 'dex-stage-art' }, [pokemonSprite(p.sprite, 'sprite dex-sprite', { silhouette: p.status === 'unseen' })]),
        h('div', { class: 'dex-title' }, [
          h('small', { class: 'dex-number', text: p.number }),
          h('strong', { class: 'display', testid: 'dex-name', text: p.name }),
          p.genus ? h('small', { class: 'dex-genus', text: p.genus }) : null,
          h('span', { class: 'pills' }, p.types.map(type => typePill(type.type, type.label))),
          h('small', { class: `dex-status ${p.status}`, testid: 'dex-status' }, [p.status === 'caught' ? icon('ball') : null, p.statusText]),
        ]),
      ]),
      p.entry ? h('p', { class: 'dex-entry', testid: 'dex-entry' }, [h('span', { text: p.entry }), p.size ? h('small', { text: p.size }) : null]) : null,
      chain ? h('div', { class: 'dex-section' }, [h('h3', { class: 'label', text: view.labels.family }), chain]) : null,
      p.status !== 'unseen'
        ? h('div', { class: 'dex-section' }, [
            h('h3', { class: 'label', text: view.labels.where }),
            p.where.length
              ? h('ul', { class: 'dex-where', testid: 'dex-where' }, p.where.map(line => h('li', { text: line })))
              : h('small', { class: 'none', text: view.labels.nowhere }),
          ])
        : null,
      p.stats
        ? h('div', { class: 'dex-section dex-stats' }, [
            h('h3', { class: 'label', text: view.labels.stats }),
            ...p.stats.map(stat =>
              h('span', { class: 'mini-stat' }, [
                h('small', { text: stat.label }),
                h('span', { class: 'mini-bar', style: { '--ratio': Math.min(1, stat.value / STAT_SCALE).toFixed(3) } }),
                h('b', { text: String(stat.value) }),
              ]),
            ),
            p.catchRate ? h('small', { class: 'dex-catch', text: p.catchRate }) : null,
          ])
        : null,
    ];
    panel.replaceChildren(...parts.filter(part => part !== null));
  };

  const tiles = view.tiles.map(tile => {
    const element = h(
      'button',
      {
        class: `dex-tile ${tile.status}${tile.owned ? ' owned' : ''}`,
        testid: `dex-${tile.id}`,
        attrs: { type: 'button', 'aria-label': `${tile.number} ${tile.status}`, ...(tile.id === view.start ? { 'data-autofocus': '' } : {}) },
      },
      [
        h('small', { class: 'dex-tile-number', text: tile.number }),
        pokemonSprite(tile.sprite, 'sprite dex-tile-sprite', { silhouette: tile.status === 'unseen' }),
        tile.status === 'caught' ? h('span', { class: 'dex-tile-ball', attrs: { 'aria-hidden': 'true' } }) : null,
      ],
    );
    element.addEventListener('focus', () => describe(tile.id));
    return element;
  });

  mount(
    root,
    screen('pokedex', 'dex-screen', view.title, [
      h('header', { class: 'box-head dex-head-row' }, [heading(view.title), h('span', { class: 'stat', testid: 'dex-counts', text: view.counts })]),
      h('div', { class: 'dex-grid glass' }, tiles),
      panel,
      h('footer', { class: 'screen-foot dex-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
  if (!panel.hasChildNodes()) describe(view.start);
}
