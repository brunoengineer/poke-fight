// The menu screens shown over the fight: battle results and the party. They only draw what they are given and call
// back on clicks; the logic is in app.ts.

import { h, select, type Choice } from './dom';

export interface Button {
  label: string;
  testid: string;
  /** The button Enter / Start press (one per screen). */
  primary?: boolean;
  /** The button a controller's B presses (leaving the screen). */
  back?: boolean;
  disabled?: boolean;
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
  sprite?: string;
  specials: { label: string; testid: string; options: Choice[]; value: string; onChange: (value: string) => void }[];
  /** Items to use on it (potions). */
  actions: Button[];
}

export interface PartyView {
  title: string;
  members: PartyMemberView[];
  language: { label: string; options: Choice[]; value: string; onChange: (value: string) => void };
  buttons: Button[];
}

const button = (b: Button) =>
  h('button', {
    text: b.label,
    testid: b.testid,
    class: b.primary ? 'primary' : undefined,
    onClick: b.onClick,
    attrs: {
      ...(b.primary ? { 'data-primary': '' } : {}),
      ...(b.back ? { 'data-back': '' } : {}),
      ...(b.disabled ? { disabled: '' } : {}),
    },
  });

/** A Pokémon's picture in a menu (the same sprite the fight draws). */
const sprite = (url: string | undefined) => (url ? h('img', { class: 'sprite', attrs: { src: url, alt: '', crossorigin: 'anonymous', loading: 'lazy' } }) : null);

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
            h('div', { class: 'member-head' }, [sprite(m.sprite), h('strong', { text: m.name }), h('span', { text: m.level }), h('span', { text: m.hp })]),
            h('div', { class: 'xp-bar', attrs: { 'aria-hidden': 'true' } }, [h('div', { attrs: { style: `width: ${Math.round(m.xpProgress * 100)}%` } })]),
            h('small', { text: m.xpText }),
            ...m.specials.map(s => h('label', { class: 'special' }, [h('span', { text: s.label }), select(s.options, s.value, s.testid, s.label, s.onChange)])),
            m.actions.length ? h('div', { class: 'buttons' }, m.actions.map(button)) : null,
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

// ── Title, story and city ──────────────────────────────────────────────────────────────────────────────────────────

export interface TitleView {
  title: string;
  subtitle: string;
  /** Under the Continue button: who and where. */
  continueInfo?: string;
  buttons: Button[];
  language: PartyView['language'];
}

export function renderTitle(root: HTMLElement, view: TitleView) {
  root.replaceChildren(
    h('section', { class: 'panel title', testid: 'title', attrs: { role: 'dialog', 'aria-label': view.title } }, [
      h('h1', { text: view.title }),
      h('p', { class: 'subtitle', text: view.subtitle }),
      h('div', { class: 'buttons column' }, view.buttons.map(button)),
      view.continueInfo ? h('small', { text: view.continueInfo, testid: 'continue-info' }) : null,
      h('label', { class: 'language' }, [
        h('span', { text: view.language.label }),
        select(view.language.options, view.language.value, 'language', view.language.label, view.language.onChange),
      ]),
    ]),
  );
  focusPrimary(root);
}

export interface DialogView {
  speaker: string;
  text: string;
  /** A text field (asking a name). */
  input?: { label: string; value: string; maxLength: number };
  button: Omit<Button, 'onClick'> & { onClick: (typed: string) => void };
}

export function renderDialog(root: HTMLElement, view: DialogView) {
  const field = view.input
    ? h('input', {
        testid: 'name-input',
        attrs: { type: 'text', value: view.input.value, maxlength: String(view.input.maxLength), 'aria-label': view.input.label, autocomplete: 'off' },
      })
    : null;
  const submit = () => view.button.onClick(field?.value ?? '');
  const ok = h('button', { text: view.button.label, testid: view.button.testid, class: 'primary', onClick: submit, attrs: { 'data-primary': '' } });
  field?.addEventListener('keydown', event => {
    if (event.key === 'Enter') submit();
  });
  root.replaceChildren(
    h('section', { class: 'panel dialog', testid: 'dialog', attrs: { role: 'dialog', 'aria-label': view.speaker } }, [
      h('strong', { class: 'speaker', text: view.speaker }),
      h('p', { text: view.text, testid: 'dialog-text' }),
      field,
      h('div', { class: 'buttons' }, [ok]),
    ]),
  );
  if (field) {
    field.focus();
    field.select();
  } else {
    ok.focus();
  }
}

export interface StarterView {
  title: string;
  starters: { id: number; name: string; types: string; sprite: string; testid: string; onClick: () => void }[];
}

export function renderStarter(root: HTMLElement, view: StarterView) {
  root.replaceChildren(
    h('section', { class: 'panel starters', testid: 'starters', attrs: { role: 'dialog', 'aria-label': view.title } }, [
      h('h2', { text: view.title }),
      h(
        'div',
        { class: 'cards' },
        view.starters.map(s =>
          h('button', { class: 'card', testid: s.testid, onClick: s.onClick }, [
            // crossorigin: the same request as the fight's sprites, so the browser reuses the download.
            h('img', { attrs: { src: s.sprite, alt: '', width: '96', height: '96', crossorigin: 'anonymous' } }),
            h('strong', { text: s.name }),
            h('small', { text: s.types }),
          ]),
        ),
      ),
    ]),
  );
  root.querySelector<HTMLButtonElement>('.card')?.focus();
}

export interface CityView {
  name: string;
  info: string;
  buttons: Button[];
}

export function renderCity(root: HTMLElement, view: CityView) {
  root.replaceChildren(
    h('section', { class: 'panel city', testid: 'city', attrs: { role: 'dialog', 'aria-label': view.name } }, [
      h('h2', { text: view.name, testid: 'city-name' }),
      h('p', { text: view.info }),
      h('div', { class: 'buttons column' }, view.buttons.map(button)),
    ]),
  );
  focusPrimary(root);
}

// ── Menus: the city, the shop, the Pokémon Center, the box, the world map ─────────────────────────────────────────

export interface MenuRow {
  label: string;
  detail?: string;
  testid?: string;
  /** A Pokémon's sprite URL, shown before the label. */
  sprite?: string;
  /** A keyboard key, shown as a key cap (the Controls screen). */
  key?: string;
  /** Highlighted (the Controls screen waiting for a key). */
  active?: boolean;
  buttons: Button[];
}

export interface MenuView {
  title: string;
  testid: string;
  /** Lines under the title (money, Pokédex, the last thing that happened…). */
  info: string[];
  sections: { title?: string; rows: MenuRow[] }[];
  buttons: Button[];
}

export function renderMenu(root: HTMLElement, view: MenuView) {
  root.replaceChildren(
    h('section', { class: 'panel menu', testid: view.testid, attrs: { role: 'dialog', 'aria-label': view.title } }, [
      h('h2', { text: view.title, testid: `${view.testid}-heading` }),
      ...view.info.map((line, i) => h('p', { class: 'info', text: line, testid: `${view.testid}-info-${i}` })),
      ...view.sections.map(section =>
        h('div', { class: 'section' }, [
          section.title ? h('h3', { text: section.title }) : null,
          h(
            'ul',
            { class: 'rows' },
            section.rows.map(row =>
              h('li', { class: row.active ? 'row waiting' : 'row', testid: row.testid }, [
                h('div', { class: 'who' }, [
                  sprite(row.sprite),
                  h('div', {}, [h('strong', { text: row.label }), row.detail ? h('small', { text: row.detail }) : null]),
                ]),
                h('div', { class: 'buttons' }, [
                  row.key ? h('kbd', { text: row.key, testid: row.testid ? `${row.testid}-key` : undefined }) : null,
                  ...row.buttons.map(button),
                ]),
              ]),
            ),
          ),
        ]),
      ),
      h('div', { class: 'buttons column' }, view.buttons.map(button)),
    ]),
  );
  focusPrimary(root);
}
