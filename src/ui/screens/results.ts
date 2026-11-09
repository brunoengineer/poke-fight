// After a battle: a big banner (Victory! / Defeat… / Draw), the battle report (XP, level ups, money, badges,
// captures) with an icon per line, and a card for what comes next: throwing a ball at a worn-out wild Pokémon,
// letting an evolution happen, or just continuing.

import { h } from '../dom';
import { mount } from '../focus';
import { icon, type IconName } from '../icons';
import { button, hintBar, picture, pokemonSprite, screen, type ButtonSpec, type Hint } from '../kit';

export type ReportKind = 'xp' | 'level' | 'move' | 'money' | 'badge' | 'heal' | 'ball' | 'fled' | 'evolve' | 'info';

export interface ResultsView {
  title: string;
  outcome: 'win' | 'loss' | 'draw';
  lines: { text: string; kind: ReportKind; image?: string }[];
  /** A question with a picture: the wild Pokémon to catch, or the one evolving. */
  prompt: { text: string; sprite: string; evolving: boolean } | null;
  buttons: ButtonSpec[];
  hints: Hint[];
}

const ICONS: Record<ReportKind, IconName> = {
  xp: 'star',
  level: 'arrow',
  move: 'battle',
  money: 'coin',
  badge: 'trophy',
  heal: 'heal',
  ball: 'ball',
  fled: 'exit',
  evolve: 'star',
  info: 'dex',
};

export function renderResults(root: HTMLElement, view: ResultsView) {
  mount(
    root,
    screen('results', `results-screen ${view.outcome}`, view.title, [
      h('header', { class: 'banner' }, [h('span', { class: 'banner-stripe' }), h('h2', { class: 'display banner-title', text: view.title })]),
      h('section', { class: 'report glass' }, [
        h(
          'ul',
          { class: 'report-lines', testid: 'results-lines' },
          view.lines.map((line, i) =>
            h('li', { class: `report-line ${line.kind}`, style: { '--i': i } }, [
              line.image ? picture(line.image, 'badge report-badge') : h('span', { class: 'report-icon' }, [icon(ICONS[line.kind])]),
              h('span', { text: line.text }),
            ]),
          ),
        ),
      ]),
      h('section', { class: `next-card glass${view.prompt ? ' asking' : ''}` }, [
        view.prompt
          ? h('div', { class: `prompt${view.prompt.evolving ? ' evolving' : ''}` }, [
              h('span', { class: 'prompt-stage' }, [pokemonSprite(view.prompt.sprite, 'sprite prompt-sprite')]),
              h('p', { class: 'prompt-text', testid: 'results-prompt', text: view.prompt.text }),
            ])
          : null,
        h(
          'div',
          { class: 'next-buttons' },
          view.buttons.map((spec, i) => button({ ...spec, primary: spec.primary ?? i === 0, class: `wide ${spec.class ?? ''}` })),
        ),
      ]),
      hintBar(view.hints),
    ]),
  );
}
