// The menu screens shown over the fight: battle results and the party. They only draw what they are given and call
// back on clicks; the logic is in app.ts.

import { h, select, type Choice } from './dom';

export interface Button {
  label: string;
  testid: string;
  /** The button Enter / Start press (one per screen). */
  primary?: boolean;
  onClick: () => void;
}

export interface ResultsView {
  title: string;
  lines: string[];
  /** A question shown under the lines (an evolution), if any. */
  prompt?: string;
  buttons: Button[];
}

export interface PartyMemberView {
  name: string;
  level: string;
  hp: string;
  fainted: boolean;
  /** 0–1: how far to the next level. */
  xpProgress: number;
  xpText: string;
  specials: { label: string; testid: string; options: Choice[]; value: string; onChange: (value: string) => void }[];
}

export interface PartyView {
  title: string;
  members: PartyMemberView[];
  language: { label: string; options: Choice[]; value: string; onChange: (value: string) => void };
  buttons: Button[];
}

const button = (b: Button) =>
  h('button', { text: b.label, testid: b.testid, class: b.primary ? 'primary' : undefined, onClick: b.onClick, attrs: b.primary ? { 'data-primary': '' } : {} });

export function renderResults(root: HTMLElement, view: ResultsView) {
  root.replaceChildren(
    h('section', { class: 'panel', testid: 'results', attrs: { role: 'dialog', 'aria-label': view.title } }, [
      h('h2', { text: view.title }),
      h(
        'ul',
        { class: 'lines', testid: 'results-lines' },
        view.lines.map(line => h('li', { text: line })),
      ),
      view.prompt ? h('p', { class: 'prompt', text: view.prompt, testid: 'results-prompt' }) : null,
      h('div', { class: 'buttons' }, view.buttons.map(button)),
    ]),
  );
  focusPrimary(root);
}

export function renderParty(root: HTMLElement, view: PartyView) {
  root.replaceChildren(
    h('section', { class: 'panel party', testid: 'party', attrs: { role: 'dialog', 'aria-label': view.title } }, [
      h('h2', { text: view.title }),
      h(
        'ol',
        { class: 'members' },
        view.members.map((m, i) =>
          h('li', { class: m.fainted ? 'member fainted' : 'member', testid: `member-${i}` }, [
            h('div', { class: 'member-head' }, [h('strong', { text: m.name }), h('span', { text: m.level }), h('span', { text: m.hp })]),
            h('div', { class: 'xp-bar', attrs: { 'aria-hidden': 'true' } }, [h('div', { attrs: { style: `width: ${Math.round(m.xpProgress * 100)}%` } })]),
            h('small', { text: m.xpText }),
            ...m.specials.map(s => h('label', { class: 'special' }, [h('span', { text: s.label }), select(s.options, s.value, s.testid, s.label, s.onChange)])),
          ]),
        ),
      ),
      h('label', { class: 'language' }, [
        h('span', { text: view.language.label }),
        select(view.language.options, view.language.value, 'language', view.language.label, view.language.onChange),
      ]),
      h('div', { class: 'buttons' }, view.buttons.map(button)),
    ]),
  );
  focusPrimary(root);
}

function focusPrimary(root: HTMLElement) {
  root.querySelector<HTMLElement>('[data-primary]')?.focus();
}

/** Enter / Start on a screen: its primary button. */
export function pressPrimary(root: HTMLElement) {
  root.querySelector<HTMLButtonElement>('[data-primary]')?.click();
}
