// Throwing a ball, as in the games: the ball arcs in, the Pokémon turns into red light and is drawn inside, the ball
// drops, and then the suspense: it wobbles once, twice, three times… and clicks shut (a green light, stars: caught),
// or bursts open and the Pokémon breaks out. A skips to the end; once it has played, A goes on.
// The timing is here; the CSS ("Capture") animates each state.

import { h } from '../dom';
import { mount } from '../focus';
import { button, hintBar, picture, pokemonSprite, screen, type Hint } from '../kit';

export interface CaptureView {
  sprite: string;
  ball: string;
  /** Wobbles before the end (0–3). */
  shakes: number;
  caught: boolean;
  /** "You threw a Poké Ball!" */
  start: string;
  /** "Gotcha! Pidgey was caught!" or "Aargh! Almost had it!" */
  end: string;
  next: string;
  hints: Hint[];
  onMoment?: (moment: 'throw' | 'open' | 'shake' | 'caught' | 'escape') => void;
  onDone: () => void;
}

/** Milliseconds: the throw, the Pokémon drawn in, the drop, each wobble, and the pause before the end. */
export const CAPTURE_TIMING = { throw: 650, absorb: 600, drop: 550, shake: 800, settle: 450 } as const;

/** When each step starts, for a throw with this many wobbles. */
export function captureSchedule(shakes: number) {
  const t = CAPTURE_TIMING;
  const absorb = t.throw;
  const drop = absorb + t.absorb;
  const shakesAt = Array.from({ length: shakes }, (_, i) => drop + t.drop + i * t.shake);
  const end = drop + t.drop + shakes * t.shake + t.settle;
  return { absorb, drop, shakesAt, end };
}

const testMode = () => document.documentElement.dataset.test !== undefined;

export function renderCapture(root: HTMLElement, view: CaptureView) {
  const text = h('p', { class: 'capture-text', testid: 'capture-text', text: view.start });
  const ball = h('span', { class: 'capture-ball' }, [picture(view.ball, 'capture-ball-image'), h('span', { class: 'capture-light' })]);
  const stage = h('div', { class: 'capture-stage' }, [
    h('span', { class: 'capture-ground' }),
    pokemonSprite(view.sprite, 'sprite capture-mon'),
    ball,
    h('span', { class: 'capture-stars' }, Array.from({ length: 6 }, (_, i) => h('i', { style: { '--a': `${-150 + i * 24}deg` } }))),
  ]);
  const timers: number[] = [];
  let finished = false;
  const set = (state: string) => {
    stage.dataset.state = state;
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    set(view.caught ? 'caught' : 'escaped');
    text.textContent = view.end;
    text.classList.add(view.caught ? 'good' : 'bad');
    view.onMoment?.(view.caught ? 'caught' : 'escape');
  };
  const next = button({
    label: view.next,
    testid: 'capture-done',
    primary: true,
    icon: 'arrow',
    onClick: () => (finished ? view.onDone() : finish()),
  });

  mount(root, screen('capture', 'capture-screen', view.start, [stage, h('div', { class: 'capture-footer glass' }, [text, next]), hintBar(view.hints)]));
  set('ready');
  if (testMode()) return finish();

  const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
  const plan = captureSchedule(view.shakes);
  // Next frame, so the ball starts from its place off screen.
  requestAnimationFrame(() => set('thrown'));
  view.onMoment?.('throw');
  at(plan.absorb, () => {
    set('absorb');
    view.onMoment?.('open');
  });
  at(plan.drop, () => set('drop'));
  plan.shakesAt.forEach((ms, i) =>
    at(ms, () => {
      // The same animation again: drop the class, let the browser notice, add it back.
      ball.classList.remove('wobble');
      void ball.offsetWidth;
      ball.classList.add('wobble');
      text.textContent = `${view.start} ${'…'.repeat(i + 1)}`;
      view.onMoment?.('shake');
    }),
  );
  at(plan.end, finish);
}
