// The party: six slots on the left (sprite, level, HP bar, types), the focused Pokémon's summary on the right (stats,
// XP, its two specials, items to use). A on a slot picks it up to reorder the party; A on another slot swaps them.
// A special opens a move picker (a sheet over the screen that keeps the focus inside it).

import { h } from '../dom';
import { focusStart, mount } from '../focus';
import { button, heading, hintBar, hpBar, pokemonSprite, screen, typePill, xpBar, type ButtonSpec, type Hint } from '../kit';

export interface MoveInfo {
  slug: string;
  name: string;
  type: string;
  typeLabel: string;
  color: string;
  power: string;
  shape: string;
}

export interface PartySpecial {
  label: string;
  testid: string;
  move: MoveInfo;
  options: MoveInfo[];
  onChoose: (slug: string) => void;
}

export interface PartyMember {
  name: string;
  sprite: string;
  level: string;
  color: string;
  types: { type: string; label: string }[];
  hp: number;
  maxHp: number;
  hpText: string;
  fainted: boolean;
  xp: number;
  xpText: string;
  stats: { label: string; value: number }[];
  specials: PartySpecial[];
  /** A move of its own (a signature or legendary move): shown with its input, not chosen. */
  own: { label: string; name: string; type: string; typeLabel: string; detail: string; color: string } | null;
  actions: ButtonSpec[];
}

export interface PartyView {
  title: string;
  members: PartyMember[];
  /** Whose summary shows first. */
  selected: number;
  /** The slot picked up to reorder (null: none). */
  moving: number | null;
  labels: { lead: string; fainted: string; stats: string; specials: string; items: string; noItems: string; pick: string; cancel: string };
  /** The button that gets the focus (after a change). */
  focus: string;
  /** Two slots that just traded places: they glide to their new places (the rest of the screen stays still). */
  swapped?: [number, number];
  onPick: (index: number) => void;
  onPlace: (index: number) => void;
  onCancel: () => void;
  close: ButtonSpec;
  hints: Hint[];
}

const STAT_SCALE = 200;

export function renderParty(root: HTMLElement, view: PartyView) {
  const summary = h('section', { class: 'summary glass', testid: 'party-summary' });
  const sheet = h('div', { class: 'sheet-layer' });

  const openPicker = (special: PartySpecial) => {
    const close = () => {
      sheet.replaceChildren();
      root.querySelector<HTMLElement>(`[data-testid="${special.testid}"]`)?.focus();
    };
    sheet.replaceChildren(
      h('div', { class: 'sheet glass', attrs: { 'data-nav-scope': '', role: 'dialog', 'aria-label': view.labels.pick } }, [
        h('h3', { class: 'label', text: `${view.labels.pick} · ${special.label}` }),
        h(
          'div',
          { class: 'move-list', attrs: { 'data-nav-wrap': '' } },
          special.options.map(option =>
            h(
              'button',
              {
                class: `move-option${option.slug === special.move.slug ? ' current' : ''}`,
                testid: `move-${option.slug}`,
                onClick: () => special.onChoose(option.slug),
                attrs: { type: 'button', ...(option.slug === special.move.slug ? { 'data-autofocus': '' } : {}) },
              },
              [h('strong', { text: option.name }), typePill(option.type, option.typeLabel), h('small', { text: `${option.power} · ${option.shape}` })],
            ),
          ),
        ),
        button({ label: view.labels.cancel, testid: 'cancel-move', back: true, onClick: close }),
      ]),
    );
    focusStart(root);
  };

  // The Pokémon shown in the summary: its sprite pops in when another one is focused, not when the screen is redrawn
  // around the same one (a new move, a potion), so a change on the screen doesn't look like a new screen.
  let shown = -1;
  const describe = (index: number) => {
    if (index === shown) return;
    const pop = shown !== -1;
    shown = index;
    const m = view.members[index];
    summary.style.setProperty('--c', m.color);
    summary.replaceChildren(
      h('div', { class: 'summary-head' }, [
        h('span', { class: 'summary-stage' }, [pokemonSprite(m.sprite, `sprite summary-sprite${pop ? ' pop' : ''}`)]),
        h('div', { class: 'summary-title' }, [
          h('strong', { class: 'display', text: m.name }),
          h('span', { class: 'pills' }, [
            h('small', { class: 'level-tag', text: m.level }),
            ...m.types.map(type => typePill(type.type, type.label)),
            index === 0 ? h('small', { class: 'lead-tag', text: view.labels.lead }) : null,
          ]),
          h('span', { class: 'summary-bars' }, [hpBar(m.hp, m.maxHp), h('small', { text: m.hpText }), xpBar(m.xp), h('small', { text: m.xpText })]),
        ]),
      ]),
      h('div', { class: 'summary-body' }, [
        h('div', { class: 'summary-stats' }, [
          h('h3', { class: 'label', text: view.labels.stats }),
          ...m.stats.map(stat =>
            h('span', { class: 'mini-stat' }, [
              h('small', { text: stat.label }),
              h('span', { class: 'mini-bar', style: { '--ratio': Math.min(1, stat.value / STAT_SCALE).toFixed(3) } }),
              h('b', { text: String(stat.value) }),
            ]),
          ),
        ]),
        h('div', { class: 'summary-specials' }, [
          h('h3', { class: 'label', text: view.labels.specials }),
          ...m.specials.map(special =>
            h(
              'button',
              { class: 'special-card', testid: special.testid, onClick: () => openPicker(special), style: { '--c': special.move.color }, attrs: { type: 'button' } },
              [
                h('small', { text: special.label }),
                h('strong', { text: special.move.name }),
                h('span', { class: 'pills' }, [typePill(special.move.type, special.move.typeLabel), h('small', { text: `${special.move.power} · ${special.move.shape}` })]),
              ],
            ),
          ),
          m.own
            ? h('div', { class: 'special-card own', testid: `own-move-${index}`, style: { '--c': m.own.color } }, [
                h('small', { text: m.own.label }),
                h('strong', { text: m.own.name }),
                h('span', { class: 'pills' }, [typePill(m.own.type, m.own.typeLabel), h('small', { text: m.own.detail })]),
              ])
            : null,
        ]),
      ]),
      h('div', { class: 'summary-items' }, [
        h('h3', { class: 'label', text: view.labels.items }),
        m.actions.length
          ? h('div', { class: 'summary-actions' }, m.actions.map(action => button({ ...action, class: 'small' })))
          : h('small', { class: 'none', text: view.labels.noItems }),
      ]),
    );
  };

  const slots = view.members.map((m, i) => {
    const slot = h(
      'button',
      {
        class: `member${m.fainted ? ' fainted' : ''}${view.moving === i ? ' moving' : ''}${view.moving !== null && view.moving !== i ? ' target' : ''}`,
        testid: `member-${i}`,
        style: { '--c': m.color, '--i': i },
        attrs: { type: 'button' },
      },
      [
        pokemonSprite(m.sprite, 'sprite member-sprite'),
        h('span', { class: 'member-info' }, [
          h('span', { class: 'member-line' }, [h('strong', { text: m.name }), h('small', { text: m.level })]),
          hpBar(m.hp, m.maxHp),
          h('span', { class: 'member-line' }, [
            h('span', { class: 'pills' }, m.types.map(type => typePill(type.type, type.label))),
            h('small', { text: m.fainted ? view.labels.fainted : m.hpText }),
          ]),
        ]),
        i === 0 ? h('span', { class: 'lead-tag corner', text: view.labels.lead }) : null,
      ],
    );
    slot.addEventListener('focus', () => describe(i));
    slot.addEventListener('click', () => (view.moving === null ? view.onPick(i) : view.onPlace(i)));
    return slot;
  });

  const party = screen('party', `party-screen${view.moving !== null ? ' is-moving' : ''}`, view.title, [
    // (Moving a Pokémon needs no words: the lifted slot and the highlighted places say it.)
    h('header', { class: 'party-head' }, [heading(view.title)]),
    h('div', { class: 'members' }, slots),
    summary,
    h('footer', { class: 'screen-foot party-foot' }, [
      view.moving !== null ? button({ label: view.labels.cancel, testid: 'cancel-reorder', back: true, onClick: view.onCancel }) : button({ ...view.close, back: true }),
      hintBar(view.hints),
    ]),
    sheet,
  ]);
  // The summary first: the place to focus may be in it (the special just changed).
  describe(Math.min(view.selected, view.members.length - 1));
  const target = party.querySelector<HTMLElement>(`[data-testid="${view.focus}"]`);
  target?.setAttribute('data-autofocus', '');
  mount(root, party);
  if (view.swapped) glide(slots, view.swapped);
}

/** How long two swapped slots take to trade places (milliseconds). */
export const SWAP_MS = 420;

/** Each of the two slots starts where the other one is and glides home (FLIP: the layout is already final). */
function glide(slots: HTMLElement[], [a, b]: [number, number]) {
  const ra = slots[a]?.getBoundingClientRect();
  const rb = slots[b]?.getBoundingClientRect();
  if (!ra || !rb || typeof slots[a].animate !== 'function') return;
  for (const [slot, from, to] of [
    [slots[a], rb, ra],
    [slots[b], ra, rb],
  ] as const) {
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    slot.style.zIndex = slot === slots[a] ? '3' : '2';
    slot
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1.04)`, boxShadow: '0 2cqh 4cqh rgba(0, 0, 0, 0.45)' },
          { transform: 'translate(0, 0) scale(1)', boxShadow: 'none' },
        ],
        { duration: SWAP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
      .finished.then(
        () => (slot.style.zIndex = ''),
        () => undefined,
      );
  }
}
