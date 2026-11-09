// The story, visual-novel style: whoever speaks stands on the left, their words type out in a box along the bottom.
// A (Enter) first finishes the line, then goes on. A dialog can also ask for a name or offer choices (Yes / No).

import { h } from '../dom';
import { mount } from '../focus';
import { button, hintBar, picture, screen, type ButtonSpec, type Hint } from '../kit';

export interface DialogView {
  speaker: string;
  /** The speaker's sprite (a trainer picture URL); none for a narrator. */
  portrait: string | null;
  text: string;
  /** A text field (asking a name). */
  input?: { label: string; value: string; maxLength: number };
  /** The button(s): Next, OK, or a choice (Yes / No). The first one is the main one. */
  buttons: (Omit<ButtonSpec, 'onClick'> & { onClick: (typed: string) => void })[];
  hints: Hint[];
}

/** How fast the words appear (milliseconds per letter). */
const LETTER_MS = 16;

const testMode = () => document.documentElement.dataset.test !== undefined;

export function renderDialog(root: HTMLElement, view: DialogView) {
  // The text is all in the page from the start (for screen readers and tests); each letter fades in after the last.
  const text = h('p', { class: 'dialog-text', testid: 'dialog-text' });
  [...view.text].forEach((letter, i) => text.append(h('span', { text: letter, style: { '--d': `${i * LETTER_MS}ms` } })));
  let typing = !testMode() && view.text.length > 0;
  const finish = () => {
    typing = false;
    text.classList.add('done');
  };
  if (typing) window.setTimeout(finish, view.text.length * LETTER_MS + 100);

  const field = view.input
    ? h('input', {
        class: 'name-field',
        testid: 'name-input',
        attrs: {
          type: 'text',
          value: view.input.value,
          maxlength: String(view.input.maxLength),
          'aria-label': view.input.label,
          autocomplete: 'off',
          spellcheck: 'false',
          'data-autofocus': '',
        },
      })
    : null;
  const answer = (spec: DialogView['buttons'][number]) => () => {
    // The first press only finishes the line (unless there is a choice to make).
    if (typing && !field && view.buttons.length === 1) return finish();
    spec.onClick(field?.value ?? '');
  };
  field?.addEventListener('keydown', event => {
    if (event.key === 'Enter') answer(view.buttons[0])();
  });

  mount(
    root,
    screen(
      'dialog',
      'dialog-screen',
      view.speaker,
      [
        view.portrait ? h('div', { class: 'portrait' }, [h('span', { class: 'portrait-floor' }), picture(view.portrait, 'trainer portrait-sprite')]) : null,
        h('div', { class: 'dialog-box glass' }, [
          view.speaker ? h('strong', { class: 'name-plate', text: view.speaker }) : null,
          text,
          field ? h('label', { class: 'name-row' }, [h('span', { text: view.input!.label }), field]) : null,
          h(
            'div',
            { class: 'dialog-buttons' },
            view.buttons.map((spec, i) => button({ ...spec, primary: i === 0, onClick: answer(spec) })),
          ),
          view.buttons.length === 1 && !field ? h('span', { class: 'dialog-more', attrs: { 'aria-hidden': 'true' } }) : null,
        ]),
        hintBar(view.hints),
      ],
    ),
  );
}
