// A tiny helper to build DOM elements (menus are DOM; only the fight is a canvas).

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  /** data-testid, for the browser tests. */
  testid?: string;
  onClick?: () => void;
  attrs?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.testid) element.dataset.testid = props.testid;
  if (props.onClick) element.addEventListener('click', props.onClick);
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  for (const child of children) if (child) element.append(child);
  return element;
}

export interface Choice {
  value: string;
  label: string;
}

export function select(options: Choice[], value: string, testid: string, label: string, onChange: (value: string) => void) {
  const element = h('select', { testid, attrs: { 'aria-label': label } }, options.map(o => h('option', { text: o.label, attrs: { value: o.value } })));
  element.value = value;
  element.addEventListener('change', () => onChange(element.value));
  return element;
}
