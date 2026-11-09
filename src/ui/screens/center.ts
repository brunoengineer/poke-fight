// The Pokémon Center: the nurse and her Chansey behind the counter, the healing machine with a Poké Ball for each
// party member, the party's HP on the right, and the nurse's words in a dialog box.

import { itemUrl } from '../../data/art';
import { h } from '../dom';
import { mount } from '../focus';
import { button, heading, hintBar, hpBar, picture, pokemonSprite, screen, type ButtonSpec, type Hint } from '../kit';

export interface CenterView {
  title: string;
  nurseName: string;
  nurse: string;
  helper: string;
  message: string;
  /** Just healed: the machine lights up, Chansey hops. */
  healed: boolean;
  party: { name: string; sprite: string; level: string; hp: number; maxHp: number; hpText: string }[];
  partyLabel: string;
  heal: ButtonSpec;
  back: ButtonSpec;
  hints: Hint[];
}

export function renderCenter(root: HTMLElement, view: CenterView) {
  const balls = view.party.map((_, i) => {
    const ball = picture(itemUrl('poke-ball'), 'item machine-ball');
    ball.style.setProperty('--i', String(i));
    return ball;
  });
  mount(
    root,
    screen('center', `center-screen${view.healed ? ' healed' : ''}`, view.title, [
      h('div', { class: 'room' }, [
        h('span', { class: 'room-light' }),
        picture(view.nurse, 'trainer nurse'),
        pokemonSprite(view.helper, 'sprite helper'),
        h('div', { class: 'counter' }, [h('div', { class: 'machine' }, balls)]),
      ]),
      h('aside', { class: 'glass room-side' }, [
        heading(view.title),
        h('h3', { class: 'label', text: view.partyLabel }),
        h(
          'ul',
          { class: 'mini-party', testid: 'center-party' },
          view.party.map((p, i) =>
            h('li', { style: { '--i': i } }, [
              pokemonSprite(p.sprite, 'sprite mini-party-sprite'),
              h('span', { class: 'mini-party-info' }, [
                h('span', { class: 'mini-party-name' }, [h('strong', { text: p.name }), h('small', { text: p.level })]),
                hpBar(p.hp, p.maxHp),
                h('small', { class: 'hp-text', text: p.hpText }),
              ]),
            ]),
          ),
        ),
      ]),
      h('div', { class: 'dialog-box glass room-dialog' }, [
        h('strong', { class: 'name-plate', text: view.nurseName }),
        h('p', { class: 'dialog-text done', testid: 'center-message', text: view.message }),
        h('div', { class: 'dialog-buttons' }, [button({ ...view.heal, primary: true }), button({ ...view.back, back: true })]),
      ]),
      hintBar(view.hints),
    ]),
  );
}
