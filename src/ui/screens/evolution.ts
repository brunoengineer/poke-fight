// An evolution, as in the games: the Pokémon glows, its white silhouette flickers between the old and the new shape
// faster and faster, a flash, and the new Pokémon appears. All in CSS (styles: "Evolution"). A skips to the end; once
// it has played, A goes on.

import { h } from '../dom';
import { mount } from '../focus';
import { button, hintBar, pokemonSprite, screen, type Hint } from '../kit';

export interface EvolutionView {
  from: string;
  to: string;
  /** "What? Charmander is evolving!" */
  start: string;
  /** "Charmander evolved into Charmeleon!" */
  done: string;
  next: string;
  hints: Hint[];
  /** Plays the sounds at the right moments (the flash, the end). */
  onMoment?: (moment: 'start' | 'flash' | 'end') => void;
  onDone: () => void;
}

/** When the flash happens and when it's over (milliseconds; the CSS keyframes use the same timing). */
export const EVOLUTION_TIMING = { flash: 4200, end: 5000 } as const;

const testMode = () => document.documentElement.dataset.test !== undefined;

export function renderEvolution(root: HTMLElement, view: EvolutionView) {
  const text = h('p', { class: 'evolution-text', testid: 'evolution-text', text: view.start });
  let finished = false;
  const timers: number[] = [];
  const stage = h('div', { class: 'evolution-stage' }, [
    h('span', { class: 'evolution-rays' }),
    h('span', { class: 'evolution-glow' }),
    pokemonSprite(view.from, 'sprite evolution-mon evolution-from'),
    pokemonSprite(view.to, 'sprite evolution-mon evolution-to'),
    h('span', { class: 'evolution-burst' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { '--a': `${(i / 14) * 360}deg`, '--d': `${40 + (i % 3) * 14}cqh` } }))),
  ]);
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    stage.parentElement?.classList.add('done');
    text.textContent = view.done;
    view.onMoment?.('end');
  };
  const next = button({
    label: view.next,
    testid: 'evolution-done',
    primary: true,
    icon: 'arrow',
    // While it plays, A skips to the end; then it goes on.
    onClick: () => (finished ? view.onDone() : finish()),
  });

  mount(root, screen('evolution', 'evolution-screen', view.start, [stage, h('div', { class: 'evolution-footer glass' }, [text, next]), hintBar(view.hints)]));

  if (testMode()) return finish();
  view.onMoment?.('start');
  timers.push(window.setTimeout(() => view.onMoment?.('flash'), EVOLUTION_TIMING.flash));
  timers.push(window.setTimeout(finish, EVOLUTION_TIMING.end));
}
