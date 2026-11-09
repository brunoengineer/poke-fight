// Options: sound, language, and the controls (keyboard keys to change, and the controller's layout).

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { button, glyph, heading, hintBar, screen, type ButtonSpec, type Hint, type Pad } from '../kit';

export interface OptionsView {
  title: string;
  info: string;
  sound: { label: string; value: string; on: boolean; onClick: () => void };
  language: { label: string; options: { value: string; label: string; selected: boolean; onClick: () => void }[] };
  keyboard: {
    label: string;
    rows: { action: string; label: string; key: string; waiting: boolean; changeLabel: string; onChange: () => void }[];
    reset: ButtonSpec;
  };
  pad: { label: string; rows: { pad: Pad; label: string }[]; move: string };
  back: ButtonSpec;
  hints: Hint[];
}

export function renderOptions(root: HTMLElement, view: OptionsView) {
  mount(
    root,
    screen('options', 'options-screen', view.title, [
      h('header', { class: 'screen-head' }, [heading(view.title), h('p', { class: 'screen-info', testid: 'options-info', text: view.info })]),
      h('div', { class: 'options-grid' }, [
        h('section', { class: 'glass options-col' }, [
          h('h3', { class: 'label', text: view.sound.label }),
          h(
            'button',
            {
              class: `toggle${view.sound.on ? ' on' : ''}`,
              testid: 'sound',
              onClick: view.sound.onClick,
              attrs: { type: 'button', 'aria-pressed': String(view.sound.on), 'data-autofocus': '' },
            },
            [icon(view.sound.on ? 'sound' : 'mute'), h('span', { class: 'toggle-text', text: view.sound.value }), h('span', { class: 'switch' })],
          ),
          h('h3', { class: 'label', text: view.language.label }),
          h(
            'div',
            { class: 'segmented' },
            view.language.options.map(option =>
              h(
                'button',
                {
                  class: `segment${option.selected ? ' selected' : ''}`,
                  testid: `language-${option.value}`,
                  text: option.label,
                  onClick: option.onClick,
                  attrs: { type: 'button', 'aria-pressed': String(option.selected) },
                },
              ),
            ),
          ),
          h('h3', { class: 'label', text: view.pad.label }),
          h('ul', { class: 'pad-map' }, [
            h('li', {}, [h('span', { class: 'pad pad-stick', text: '✥' }), h('span', { text: view.pad.move })]),
            ...view.pad.rows.map(row => h('li', {}, [glyph(row.pad, ''), h('span', { text: row.label })])),
          ]),
        ]),
        h('section', { class: 'glass options-col keys' }, [
          h('h3', { class: 'label', text: view.keyboard.label }),
          h(
            'ul',
            { class: 'key-rows' },
            view.keyboard.rows.map(row =>
              h('li', { class: `key-row${row.waiting ? ' waiting' : ''}`, testid: `bind-${row.action}` }, [
                h('span', { class: 'key-action', text: row.label }),
                h('kbd', { text: row.key, testid: `bind-${row.action}-key` }),
                button({ label: row.changeLabel, testid: `change-${row.action}`, onClick: row.onChange, class: 'small' }),
              ]),
            ),
          ),
          button({ ...view.keyboard.reset, class: 'ghost' }),
        ]),
      ]),
      h('footer', { class: 'screen-foot' }, [button({ ...view.back, back: true }), hintBar(view.hints)]),
    ]),
  );
}
