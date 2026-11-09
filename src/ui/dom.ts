// A tiny helper to build DOM elements (menus are DOM; only the fight is a canvas).

export type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  /** data-testid, for the browser tests. */
  testid?: string;
  onClick?: () => void;
  attrs?: Record<string, string>;
  /** Inline styles, mostly CSS variables (`--c`: a card's color, `--ratio`: a bar's fill). */
  style?: Record<string, string | number>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.testid) element.dataset.testid = props.testid;
  if (props.onClick) element.addEventListener('click', props.onClick);
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  for (const [name, value] of Object.entries(props.style ?? {})) element.style.setProperty(name, String(value));
  for (const child of children) if (child) element.append(child);
  return element;
}

const SVG = 'http://www.w3.org/2000/svg';

/** An SVG element (icons, the world map). */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, children: SVGElement[] = []): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  for (const child of children) element.append(child);
  return element;
}

export interface Choice {
  value: string;
  label: string;
}

