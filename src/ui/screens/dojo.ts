// The Training Dojo (in each League city): a wooden hall with the master on the left and, on the mat, the Pokémon in
// training (or a straw dummy waiting for one). On the right, the trainee's progress, or the party to choose from; the
// master's words and the buttons in a dialog box below, like the Pokémon Center.

import { itemUrl } from '../../data/art';
import { h } from '../dom';
import { mount } from '../focus';
import { icon, type IconName } from '../icons';
import { button, heading, hintBar, picture, pokemonSprite, screen, type ButtonSpec, type Hint } from '../kit';

export interface DojoTrainee {
  name: string;
  sprite: string;
  /** "Lv. 12" when it was left, "Lv. 19" now. */
  from: string;
  to: string;
  /** "Battles fought: 7". */
  gained: string;
  movesLabel: string;
  /** Moves learned while training (names). */
  moves: string[];
  /** "Lv. 100: it can't grow more", "Ready to evolve"… */
  note: string | null;
}

export interface DojoView {
  title: string;
  masterName: string;
  master: string;
  message: string;
  /** Who is on the mat (null: the dummy). */
  trainee: DojoTrainee | null;
  /** With nobody training: the party, to choose who stays. */
  party: { name: string; sprite: string; level: string; testid: string; onClick: () => void }[];
  partyLabel: string;
  /** A Pokémon just left or just came back: a short cheer on the mat. */
  moment: 'none' | 'left' | 'back';
  /** How it works, at the bottom of the side panel. */
  rules: { label: string; items: { icon: IconName; text: string }[] };
  buttons: ButtonSpec[];
  hints: Hint[];
}

export function renderDojo(root: HTMLElement, view: DojoView) {
  const t = view.trainee;
  const rules = h('div', { class: 'dojo-rules', testid: 'dojo-rules' }, [
    h('h3', { class: 'label', text: view.rules.label }),
    h('ul', {}, view.rules.items.map(rule => h('li', {}, [icon(rule.icon), h('span', { text: rule.text })]))),
  ]);
  const mat = t
    ? h('div', { class: 'dojo-trainee' }, [
        h('span', { class: 'dojo-spark s1' }),
        h('span', { class: 'dojo-spark s2' }),
        h('span', { class: 'dojo-spark s3' }),
        pokemonSprite(t.sprite, 'sprite dojo-trainee-sprite'),
      ])
    : h('div', { class: 'dojo-dummy', attrs: { 'aria-hidden': 'true' } }, [h('span', { class: 'dummy-head' }), h('span', { class: 'dummy-arm' }), h('span', { class: 'dummy-post' })]);

  const side = t
    ? h('aside', { class: 'glass room-side dojo-side' }, [
        heading(view.title),
        h('div', { class: 'dojo-card', testid: 'dojo-trainee' }, [
          pokemonSprite(t.sprite, 'sprite dojo-card-sprite'),
          h('div', { class: 'dojo-card-text' }, [
            h('strong', { class: 'display', text: t.name }),
            // No battle yet: just its level (not "Lv. 34 → Lv. 34").
            h('span', { class: 'dojo-levels', testid: 'dojo-levels' }, t.from === t.to ? [h('b', { text: t.to })] : [h('small', { text: t.from }), icon('arrow'), h('b', { text: t.to })]),
            h('small', { class: 'dojo-gained', text: t.gained }),
          ]),
        ]),
        t.moves.length
          ? h('div', { class: 'dojo-moves' }, [h('h3', { class: 'label', text: t.movesLabel }), h('div', { class: 'pills' }, t.moves.map(m => h('span', { class: 'dojo-move', text: m })))])
          : null,
        t.note ? h('p', { class: 'dojo-note', text: t.note }) : null,
        rules,
      ])
    : h('aside', { class: 'glass room-side dojo-side' }, [
        heading(view.title),
        h('h3', { class: 'label', text: view.partyLabel }),
        h(
          'div',
          { class: 'dojo-party', testid: 'dojo-party' },
          view.party.map((p, i) =>
            // The first one is where the focus starts (the dialog only has Back).
            h('button', { class: 'dojo-pick', testid: p.testid, onClick: p.onClick, style: { '--i': i }, attrs: { type: 'button', ...(i === 0 ? { 'data-primary': '' } : {}) } }, [
              pokemonSprite(p.sprite, 'sprite mini-party-sprite'),
              h('span', { class: 'mini-party-name' }, [h('strong', { text: p.name }), h('small', { text: p.level })]),
              icon('belt', 'icon dojo-pick-icon'),
            ]),
          ),
        ),
        rules,
      ]);

  mount(
    root,
    screen('dojo', `dojo-screen${view.moment === 'none' ? '' : ` ${view.moment}`}`, view.title, [
      h('div', { class: 'room dojo-room' }, [
        h('div', { class: 'dojo-wall' }, [h('div', { class: 'dojo-banner' }, [picture(itemUrl('poke-ball'), 'item dojo-emblem')])]),
        h('div', { class: 'dojo-floor' }),
        picture(view.master, 'trainer dojo-master'),
        mat,
      ]),
      side,
      h('div', { class: 'dialog-box glass room-dialog' }, [
        h('strong', { class: 'name-plate', text: view.masterName }),
        h('p', { class: 'dialog-text done', testid: 'dojo-message', text: view.message }),
        h('div', { class: 'dialog-buttons' }, view.buttons.map(spec => button(spec))),
      ]),
      hintBar(view.hints),
    ]),
  );
}
