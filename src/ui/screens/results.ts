// After a battle: a big banner (Victory! / Defeat… / Draw), the battle report (XP, level ups, money, badges,
// captures) with an icon per line, and a card for what comes next: throwing a ball at a worn-out wild Pokémon,
// letting an evolution happen, or just continuing.

import { h } from '../dom';
import { mount } from '../focus';
import { icon, type IconName } from '../icons';
import { button, hintBar, picture, pokemonSprite, screen, type ButtonSpec, type Hint } from '../kit';

export type ReportKind = 'xp' | 'level' | 'move' | 'money' | 'badge' | 'heal' | 'ball' | 'fled' | 'evolve' | 'info';

/** A Pokémon that gained XP: its bar fills from where it was (rolling over on a level up). */
export interface XpCard {
  name: string;
  sprite: string;
  amount: string;
  levelFrom: string;
  /** The new level, if it grew. */
  levelTo: string | null;
  /** How far into the level the bar was, and is now (0–1). */
  from: number;
  to: number;
  moves: string[];
}

export interface ResultsView {
  title: string;
  outcome: 'win' | 'loss' | 'draw';
  xp: XpCard[];
  levelUp: string;
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
        view.xp.length
          ? h(
              'ul',
              { class: 'xp-cards', testid: 'results-xp' },
              view.xp.map((card, i) =>
                h('li', { class: `xp-card${card.levelTo ? ' level-up' : ''}`, testid: `xp-${i}`, style: { '--i': i, '--from': card.from.toFixed(4), '--to': card.to.toFixed(4) } }, [
                  pokemonSprite(card.sprite, 'sprite xp-sprite'),
                  h('div', { class: 'xp-info' }, [
                    h('div', { class: 'xp-line' }, [
                      h('strong', { text: card.name }),
                      h('span', { class: 'xp-levels' }, [
                        h('small', { class: 'xp-level from', text: card.levelFrom }),
                        card.levelTo ? h('small', { class: 'xp-level to', text: card.levelTo }) : null,
                      ]),
                      h('span', { class: 'xp-amount', text: card.amount }),
                    ]),
                    h('span', { class: 'bar xp xp-progress' }, [h('span', { class: 'fill' })]),
                    card.levelTo || card.moves.length
                      ? h('div', { class: 'xp-line news' }, [
                          card.levelTo ? h('span', { class: 'level-chip', text: view.levelUp }) : null,
                          ...card.moves.map(text => h('small', { class: 'xp-move', text })),
                        ])
                      : null,
                  ]),
                ]),
              ),
            )
          : null,
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
