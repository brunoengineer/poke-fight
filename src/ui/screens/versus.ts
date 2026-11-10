// Versus (plan.md §4.10): two players pick three Pokémon each, side by side, then fight; the winner's screen after.
// The selection has two cursors at once (one per player, each moved by its own device), so it can't use the DOM's
// single focus: it is built once and updated in place (game/versus.ts holds the state).

import type { VersusSide } from '../../game/versus';
import { VERSUS_COLUMNS, VERSUS_TEAM } from '../../game/versus';
import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, hintBar, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export interface VersusEntry {
  id: number;
  name: string;
  sprite: string;
  types: { type: string; label: string }[];
  /** Its move of its own ("Signature · Thunder"), if it has one. */
  own: string | null;
}

export interface VersusPlayer {
  name: string;
  /** "Keyboard", "Controller 2"… or null: nobody yet (the panel waits). */
  device: string | null;
  /** What to press, for this player's device. */
  hint: string;
}

export interface VersusSelectView {
  title: string;
  entries: VersusEntry[];
  /** Where each generation starts (index), with its label: a marker in the grids. */
  generations: { start: number; label: string }[];
  players: [VersusPlayer, VersusPlayer];
  labels: { team: string; ready: string; pressReady: string; waiting: string; level: string; fight: string };
  back: ButtonSpec;
  hints: Hint[];
  /** A click on a cell (the mouse): that player's cursor goes there and picks it. */
  onCell: (side: 0 | 1, index: number) => void;
}

export interface VersusSelectState {
  sides: [VersusSide, VersusSide];
  /** Both are ready: "Fight!" before the battle starts. */
  starting: boolean;
}

const COLORS = ['#ff5d6c', '#4f9dff'] as const;

/**
 * Scrolls a grid so this cell is fully in view, clear of the fades at its edges (fixed: offsetTop is measured from the
 * panel, not the grid, so the grid used to scroll by the wrong amount and the top rows couldn't come back into view).
 * Positions come from the screen, so they are right whatever the cell's ancestors are.
 */
function keepInView(wrap: HTMLElement, cell: HTMLElement) {
  const box = wrap.getBoundingClientRect();
  const at = cell.getBoundingClientRect();
  // The fade at each edge (main.css .vs-grid-wrap's mask) is 2cqh: keep a little more than that clear.
  const margin = at.height * 0.45;
  if (at.top < box.top + margin) wrap.scrollTop -= box.top + margin - at.top;
  else if (at.bottom > box.bottom - margin) wrap.scrollTop += at.bottom - (box.bottom - margin);
}

export function renderVersusSelect(root: HTMLElement, view: VersusSelectView): { update: (state: VersusSelectState) => void } {
  const panels = ([0, 1] as const).map(side => {
    const player = view.players[side];
    const cells = view.entries.map((entry, i) => {
      const cell = h('button', { class: 'vs-cell', attrs: { type: 'button', tabindex: '-1', 'aria-label': entry.name, 'data-i': String(i) } }, [
        pokemonSprite(entry.sprite, 'sprite vs-cell-sprite'),
        h('span', { class: 'vs-cell-mark' }),
      ]);
      cell.addEventListener('click', () => view.onCell(side, i));
      return cell;
    });
    // A label at the start of each generation, across the grid.
    const grid = h('div', { class: 'vs-grid', style: { '--cols': VERSUS_COLUMNS } }, cells);
    for (const g of view.generations) {
      if (g.start === 0) continue;
      const tag = h('span', { class: 'vs-gen', text: g.label });
      grid.insertBefore(tag, cells[g.start]);
    }
    const wrap = h('div', { class: 'vs-grid-wrap' }, [grid]);
    const slots = Array.from({ length: VERSUS_TEAM }, (_, k) => h('span', { class: 'vs-slot', attrs: { 'data-n': String(k + 1) } }));
    const focus = h('div', { class: 'vs-focus' });
    const hint = h('p', { class: 'vs-panel-hint', text: player.hint });
    const stamp = h('div', { class: 'vs-stamp', text: view.labels.ready });
    const panel = h('section', { class: `vs-panel p${side + 1}${player.device ? '' : ' waiting'}`, testid: `vs-p${side + 1}`, style: { '--pc': COLORS[side] } }, [
      h('header', { class: 'vs-panel-head' }, [
        h('strong', { class: 'vs-player display', text: player.name }),
        h('span', { class: 'vs-device', text: player.device ?? view.labels.waiting }),
      ]),
      h('div', { class: 'vs-team', testid: `vs-team-${side + 1}` }, [h('small', { class: 'label', text: view.labels.team }), ...slots]),
      focus,
      wrap,
      hint,
      stamp,
      player.device ? null : h('div', { class: 'vs-join' }, [h('strong', { class: 'display', text: view.labels.waiting })]),
    ]);
    return { panel, cells, wrap, slots, focus, hint, stamp, shown: { cursor: -1, picks: '' } };
  });

  const banner = h('div', { class: 'vs-fight display', text: view.labels.fight });
  mount(
    root,
    screen('versus', 'versus-screen', view.title, [
      h('header', { class: 'vs-head' }, [h('h1', { class: 'display vs-title', text: view.title })]),
      h('div', { class: 'vs-board' }, [panels[0].panel, h('div', { class: 'vs-mid' }, [h('span', { class: 'vs-emblem display', text: 'VS' })]), panels[1].panel]),
      h('footer', { class: 'screen-foot vs-foot' }, [button(view.back), hintBar(view.hints)]),
      banner,
    ]),
  );

  const describe = (entry: VersusEntry) => [
    pokemonSprite(entry.sprite, 'sprite vs-focus-sprite'),
    h('div', { class: 'vs-focus-text' }, [
      h('strong', { class: 'display', text: entry.name }),
      h('span', { class: 'pills' }, [h('small', { class: 'level-tag', text: view.labels.level }), ...entry.types.map(t => typePill(t.type, t.label))]),
      entry.own ? h('small', { class: 'vs-own', text: entry.own }) : null,
    ]),
  ];

  return {
    update(state) {
      root.querySelector('.versus-screen')?.classList.toggle('starting', state.starting);
      state.sides.forEach((side, s) => {
        const p = panels[s];
        if (p.shown.cursor !== side.cursor) {
          p.cells[p.shown.cursor]?.classList.remove('cursor');
          const cell = p.cells[side.cursor];
          cell.classList.add('cursor');
          keepInView(p.wrap, cell);
          p.focus.replaceChildren(...describe(view.entries[side.cursor]));
          p.shown.cursor = side.cursor;
        }
        const picks = side.picks.join(',');
        if (p.shown.picks !== picks) {
          p.cells.forEach(cell => {
            cell.classList.remove('picked');
            cell.querySelector('.vs-cell-mark')!.textContent = '';
          });
          side.picks.forEach((id, k) => {
            const index = view.entries.findIndex(e => e.id === id);
            const cell = p.cells[index];
            cell.classList.add('picked');
            cell.querySelector('.vs-cell-mark')!.textContent = String(k + 1);
          });
          p.slots.forEach((slot, k) => {
            const id = side.picks[k];
            const entry = view.entries.find(e => e.id === id);
            slot.replaceChildren(...(entry ? [pokemonSprite(entry.sprite, 'sprite vs-slot-sprite'), h('small', { text: entry.name })] : []));
            slot.classList.toggle('filled', entry !== undefined);
            slot.dataset.testid = entry ? `vs-slot-${s + 1}-${k + 1}` : '';
          });
          p.shown.picks = picks;
        }
        const full = side.picks.length === VERSUS_TEAM;
        p.panel.classList.toggle('full', full && !side.ready);
        p.panel.classList.toggle('ready', side.ready);
        p.hint.textContent = full && !side.ready ? view.labels.pressReady : view.players[s].hint;
      });
    },
  };
}

// ── The winner ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VersusWinnerView {
  title: string;
  /** "Player 1 wins!", or a draw. */
  headline: string;
  /** The winner's color (a draw: the theme's). */
  color: string;
  winner: { label: string; team: { sprite: string; name: string; fainted: boolean }[] } | null;
  loser: { label: string; team: { sprite: string; name: string; fainted: boolean }[] } | null;
  buttons: ButtonSpec[];
  hints: Hint[];
}

export function renderVersusWinner(root: HTMLElement, view: VersusWinnerView) {
  const team = (side: NonNullable<VersusWinnerView['winner']>, kind: 'winner' | 'loser') =>
    h('div', { class: `vs-result ${kind}` }, [
      h('small', { class: 'label', text: side.label }),
      h(
        'div',
        { class: 'vs-result-team' },
        side.team.map((m, i) => h('span', { class: `vs-result-mon${m.fainted ? ' fainted' : ''}`, style: { '--i': i } }, [pokemonSprite(m.sprite, 'sprite'), h('small', { text: m.name })])),
      ),
    ]);
  mount(
    root,
    screen('versus-winner', 'versus-winner-screen', view.title, [
      h('div', { class: 'vs-rays', attrs: { 'aria-hidden': 'true' } }),
      icon('crown', 'icon vs-crown'),
      h('h1', { class: 'display vs-headline', testid: 'vs-headline', text: view.headline }),
      view.winner ? team(view.winner, 'winner') : null,
      view.loser ? team(view.loser, 'loser') : null,
      h('footer', { class: 'screen-foot vs-foot' }, [h('div', { class: 'vs-winner-buttons' }, view.buttons.map(spec => button(spec))), hintBar(view.hints)]),
    ], view.color),
  );
}
