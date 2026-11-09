// The PC box: the party in a column on the left, the box as a grid of slots on the right, and the focused Pokémon's
// details underneath.
//   - A (or a click) picks a Pokémon up; A on another one puts it there (they swap places), on an empty place it
//     moves there; A on itself, or B, puts it back.
//   - Y (or S) sends the focused (or held) Pokémon straight across: party → box, box → party.
//   - X (or Delete) releases it, after asking (a sheet that keeps the focus, "Keep it" first).

import { h } from '../dom';
import { focusStart, mount } from '../focus';
import { icon } from '../icons';
import { button, heading, hintBar, hpBar, pokemonSprite, screen, typePill, type ButtonSpec, type Hint } from '../kit';

export interface BoxMon {
  name: string;
  /** "Lv. 40" (the party's slots and the details). */
  level: string;
  /** "Lv40": the short tag in a box slot's corner, so levels show without opening each one. */
  levelTag: string;
  sprite: string;
  hp: number;
  maxHp: number;
  types: { type: string; label: string }[];
  /** Picked up, being moved. */
  held: boolean;
  /** A: pick it up, or put the held one here (they swap), or put it back if it is the held one. */
  onPick: () => void;
  /** Y: straight across ("Send to the box"), or why it can't ("Your party is full"). */
  send: { label: string; blocked: string | null; onSend: () => void };
  /** Releasing it (null: it can't be, the party's last Pokémon). */
  onRelease: (() => void) | null;
}

export interface BoxHolding {
  /** "Where should Pikachu go?…" */
  text: string;
  /** The empty place after the party / the box it can move to (null: it can't, or it is already there). */
  toParty: (() => void) | null;
  toBox: (() => void) | null;
  /** "Move here" (the empty places' label). */
  drop: string;
}

export interface BoxView {
  title: string;
  partyLabel: string;
  boxLabel: string;
  empty: string;
  party: BoxMon[];
  box: BoxMon[];
  /** While a Pokémon is held (the Back button then puts it back). */
  holding: BoxHolding | null;
  release: { label: string; ask: (mon: BoxMon) => string; yes: string; no: string; blocked: string };
  back: ButtonSpec;
  hints: Hint[];
}

/** The box always shows at least this many slots, so it looks like a box even when nearly empty. */
const MIN_SLOTS = 24;

function slot(mon: BoxMon, testid: string, wrapper: string, details: (mon: BoxMon) => void, compact: boolean, holding: boolean) {
  const slotButton = h(
    'button',
    {
      class: `slot${compact ? ' compact' : ''}${mon.held ? ' held' : holding ? ' target' : ''}`,
      testid,
      attrs: { type: 'button', 'aria-label': `${mon.name} ${mon.level}`, 'aria-pressed': String(mon.held) },
    },
    [
      pokemonSprite(mon.sprite, 'sprite slot-sprite'),
      compact ? h('span', { class: 'slot-level', attrs: { 'aria-hidden': 'true' }, text: mon.levelTag }) : null,
      compact ? null : h('span', { class: 'slot-info' }, [h('strong', { text: mon.name }), h('small', { text: mon.level }), hpBar(mon.hp, mon.maxHp)]),
      mon.held ? h('span', { class: 'slot-held-mark', attrs: { 'aria-hidden': 'true' } }, [icon('arrow')]) : null,
    ],
  );
  slotButton.addEventListener('click', mon.onPick);
  slotButton.addEventListener('focus', () => details(mon));
  return h('div', { class: 'slot-wrap', testid: wrapper }, [slotButton]);
}

/** An empty place the held Pokémon can move to. */
function dropSlot(label: string, testid: string, compact: boolean, onDrop: () => void) {
  return h('button', { class: `slot drop${compact ? ' compact' : ''}`, testid, onClick: onDrop, attrs: { type: 'button', 'aria-label': label } }, [
    h('span', { class: 'slot-drop-plus', attrs: { 'aria-hidden': 'true' } }, ['+']),
    compact ? null : h('span', { class: 'slot-drop-text', text: label }),
  ]);
}

export function renderBox(root: HTMLElement, view: BoxView) {
  const detail = h('div', { class: 'box-detail glass' });
  const sheet = h('div', { class: 'sheet-layer' });
  const holding = view.holding;
  const ask = (mon: BoxMon, onRelease: () => void) => {
    const close = () => {
      sheet.replaceChildren();
      focusStart(root);
    };
    sheet.replaceChildren(
      h('div', { class: 'sheet glass release-sheet', testid: 'release-sheet', attrs: { 'data-nav-scope': '', role: 'dialog', 'aria-label': view.release.label } }, [
        pokemonSprite(mon.sprite, 'sprite release-sprite'),
        h('p', { class: 'release-text', text: view.release.ask(mon) }),
        h('div', { class: 'release-buttons' }, [
          button({ label: view.release.no, testid: 'release-no', back: true, autofocus: true, onClick: close }),
          button({ label: view.release.yes, testid: 'release-yes', class: 'danger', onClick: onRelease }),
        ]),
      ]),
    );
    focusStart(root);
  };
  /** Y / S: straight across. A blocked one stays pressable (it says why), so Y never falls through to the party. */
  const sendButton = (mon: BoxMon) => {
    const send = button({ label: mon.send.label, testid: 'box-send', class: 'small', icon: 'arrow', pad: 'y', key: 'KeyS', onClick: () => !mon.send.blocked && mon.send.onSend() });
    if (mon.send.blocked) send.setAttribute('aria-disabled', 'true');
    return send;
  };
  const details = (mon: BoxMon) =>
    detail.replaceChildren(
      pokemonSprite(mon.sprite, 'sprite box-detail-sprite'),
      h('div', { class: 'box-detail-text' }, [
        h('strong', { class: 'display', text: mon.name }),
        h('span', { class: 'pills' }, [h('small', { class: 'level-tag', text: mon.level }), ...mon.types.map(t => typePill(t.type, t.label))]),
        hpBar(mon.hp, mon.maxHp),
        mon.send.blocked ? h('small', { class: 'box-action blocked', testid: 'box-blocked', text: mon.send.blocked }) : null,
      ]),
      h('div', { class: 'box-detail-buttons' }, [
        sendButton(mon),
        mon.onRelease
          ? button({ label: view.release.label, testid: 'release', class: 'small danger', pad: 'x', key: 'Delete', onClick: () => ask(mon, mon.onRelease!) })
          : h('small', { class: 'box-action blocked', text: view.release.blocked }),
      ]),
    );
  // Holding: the panel shows the held Pokémon and what to do, whatever has the focus.
  const held = [...view.party, ...view.box].find(mon => mon.held) ?? null;
  const holdingPanel = (mon: BoxMon, state: BoxHolding) =>
    detail.replaceChildren(
      pokemonSprite(mon.sprite, 'sprite box-detail-sprite lifted'),
      h('div', { class: 'box-detail-text' }, [
        h('strong', { class: 'display', text: mon.name }),
        h('p', { class: 'box-holding-text', testid: 'box-holding', text: state.text }),
      ]),
      h('div', { class: 'box-detail-buttons' }, [sendButton(mon)]),
    );
  const showDetails = (mon: BoxMon) => (held && holding ? holdingPanel(held, holding) : details(mon));

  const partySlots: HTMLElement[] = view.party.map((mon, i) => slot(mon, `party-slot-${i}`, `party-${i}`, showDetails, false, !!holding));
  if (holding?.toParty) partySlots.push(dropSlot(holding.drop, 'party-drop', false, holding.toParty));
  const boxSlots: HTMLElement[] = view.box.map((mon, i) => slot(mon, `box-slot-${i}`, `boxed-${i}`, showDetails, true, !!holding));
  if (holding?.toBox) boxSlots.push(dropSlot(holding.drop, 'box-drop', true, holding.toBox));
  const empties = Math.max(0, MIN_SLOTS - boxSlots.length);

  mount(
    root,
    screen('box', `box-screen${holding ? ' holding' : ''}`, view.title, [
      h('header', { class: 'box-head' }, [heading(view.title)]),
      h('section', { class: 'box-party glass' }, [h('h3', { class: 'label', text: view.partyLabel }), h('div', { class: 'box-party-list' }, partySlots)]),
      h('section', { class: 'box-grid-wrap glass' }, [
        h('h3', { class: 'label', text: view.boxLabel }),
        h('div', { class: 'box-grid' }, [...boxSlots, ...Array.from({ length: empties }, () => h('span', { class: 'slot empty', attrs: { 'aria-hidden': 'true' } }))]),
        view.box.length === 0 && !holding ? h('p', { class: 'box-empty', text: view.empty }) : null,
      ]),
      detail,
      h('footer', { class: 'screen-foot box-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
      sheet,
    ]),
  );
  // The panel follows the focus (mount may have put it back on a slot); before any focus, the first Pokémon.
  const focused = document.activeElement;
  const all = [...view.party, ...view.box];
  const slots = [...root.querySelectorAll<HTMLElement>('.slot:not(.empty):not(.drop)')];
  const index = focused instanceof HTMLElement ? slots.indexOf(focused) : -1;
  const first = all[index] ?? all[0];
  if (first && !detail.hasChildNodes()) showDetails(first);
}
