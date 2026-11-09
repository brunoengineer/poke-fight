// The menus' building blocks: buttons, cards, bars, type pills, sprites, the hint bar. Screens (ui/screens/*) put
// them together; the look is in styles/main.css. Every interactive piece is a <button> (focus, Enter and the
// controller's A work the same), with a data-testid for the browser tests.

import { typeColor } from '../render/colors';
import { h, type Child } from './dom';
import { icon, type IconName } from './icons';

/** A controller button a hint or a shortcut refers to. */
export type Pad = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'start' | 'view';

export interface ButtonSpec {
  label: string;
  testid: string;
  onClick: () => void;
  /** The button Enter / Start press, and where the focus starts. */
  primary?: boolean;
  /** The button B / Esc press (leaving the screen). */
  back?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** A small picture instead of an icon (an item sprite). */
  image?: string;
  /** A controller shortcut (and a keyboard key for it, as a KeyboardEvent.code). */
  pad?: Pad;
  key?: string;
  /** Extra classes ('ghost', 'danger', 'wide'…). */
  class?: string;
  autofocus?: boolean;
}

/** Shortcut attributes shared by buttons and cards. */
function shortcutAttrs(spec: { primary?: boolean; back?: boolean; pad?: Pad; key?: string; autofocus?: boolean; disabled?: boolean }) {
  return {
    ...(spec.primary ? { 'data-primary': '' } : {}),
    ...(spec.back ? { 'data-back': '' } : {}),
    ...(spec.pad ? { 'data-pad': spec.pad } : {}),
    ...(spec.key ? { 'data-key': spec.key } : {}),
    ...(spec.autofocus ? { 'data-autofocus': '' } : {}),
    ...(spec.disabled ? { disabled: '' } : {}),
  };
}

export function button(spec: ButtonSpec) {
  return h(
    'button',
    {
      class: ['btn', spec.primary ? 'primary' : '', spec.class ?? ''].filter(Boolean).join(' '),
      testid: spec.testid,
      onClick: spec.onClick,
      attrs: { type: 'button', ...shortcutAttrs(spec) },
    },
    [spec.image ? picture(spec.image, 'item btn-image') : spec.icon ? icon(spec.icon) : null, h('span', { text: spec.label })],
  );
}

export interface CardSpec {
  testid: string;
  title: string;
  subtitle?: string;
  /** The card's own color (a gradient is made from it). */
  color: string;
  /** Pictures shown at the top (sprites pop out of the card). */
  art?: Child;
  icon?: IconName;
  /** A small tag in the corner: "Locked", "Beaten"… */
  chip?: { text: string; icon?: IconName; tone?: 'gold' | 'ok' | 'lock' };
  /** Shown but not usable (it can still get the focus, so a controller can read why). */
  locked?: boolean;
  onClick: () => void;
  primary?: boolean;
  pad?: Pad;
  key?: string;
  size?: 'hero' | 'tile' | 'small';
  extra?: Child;
}

/** A big focusable card (the city's places, the starters…). */
export function card(spec: CardSpec) {
  const size = spec.size ?? 'tile';
  const element = h(
    'button',
    {
      class: `card card-${size}${spec.locked ? ' locked' : ''}`,
      testid: spec.testid,
      style: { '--c': spec.color },
      attrs: {
        type: 'button',
        ...shortcutAttrs({ ...spec, disabled: false }),
        // Locked cards stay focusable (aria-disabled), so a controller can land on them and read why.
        ...(spec.locked ? { 'aria-disabled': 'true', 'data-focusable': '' } : {}),
      },
    },
    [
      spec.art ? h('span', { class: 'card-art' }, [spec.art]) : null,
      h('span', { class: 'card-body' }, [
        spec.icon ? icon(spec.icon, 'icon card-icon') : null,
        h('span', { class: 'card-text' }, [
          h('strong', { class: 'card-title', text: spec.title }),
          spec.subtitle ? h('small', { class: 'card-subtitle', text: spec.subtitle }) : null,
        ]),
      ]),
      spec.chip ? h('span', { class: `chip chip-${spec.chip.tone ?? 'gold'}` }, [spec.chip.icon ? icon(spec.chip.icon) : null, spec.chip.text]) : null,
      spec.extra ?? null,
    ],
  );
  if (!spec.locked) element.addEventListener('click', spec.onClick);
  return element;
}

/** A Pokémon sprite (the same files as the fight: crossorigin so the download is shared). */
export function pokemonSprite(url: string, className = 'sprite', options: { silhouette?: boolean } = {}) {
  return h('img', {
    class: `${className}${options.silhouette ? ' silhouette' : ''}`,
    attrs: { src: url, alt: '', crossorigin: 'anonymous', draggable: 'false', loading: 'lazy' },
  });
}

/** A trainer, an item or a badge: plain images (their host sends no CORS header, so no crossorigin here). */
export function picture(url: string, className: string) {
  const image = h('img', { class: className, attrs: { src: url, alt: '', draggable: 'false' } });
  // An image that can't load (offline) disappears instead of showing a broken icon.
  image.addEventListener('error', () => image.classList.add('missing'));
  return image;
}

export function typePill(type: string, label: string) {
  return h('span', { class: 'type-pill', text: label, style: { '--c': typeColor(type) } });
}

/** An HP bar: green, then yellow under half, red under a fifth. */
export function hpBar(hp: number, max: number, text?: string) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const level = ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'warn' : 'low';
  return h('span', { class: `bar hp ${level}`, style: { '--ratio': ratio.toFixed(4) }, attrs: { role: 'meter', 'aria-valuenow': String(Math.round(ratio * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' } }, [
    h('span', { class: 'fill' }),
    text ? h('span', { class: 'bar-text', text }) : null,
  ]);
}

export function xpBar(ratio: number) {
  return h('span', { class: 'bar xp', style: { '--ratio': Math.max(0, Math.min(1, ratio)).toFixed(4) } }, [h('span', { class: 'fill' })]);
}

export interface Hint {
  pad: Pad;
  /** The keyboard key shown instead when the player uses a keyboard. */
  key: string;
  label: string;
}

const PAD_LABELS: Record<Pad, string> = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', start: '≡', view: '⧉' };

/** The glyph of a controller button and of its keyboard key; CSS shows the one for the device in use. */
export function glyph(pad: Pad, key: string) {
  return h('span', { class: 'glyph' }, [h('span', { class: `pad pad-${pad}`, text: PAD_LABELS[pad] }), h('kbd', { class: 'key', text: key })]);
}

/** The bar at the bottom of a screen: what each button does here. */
export function hintBar(hints: readonly Hint[]) {
  return h(
    'footer',
    { class: 'hints', attrs: { 'aria-hidden': 'true' } },
    hints.map(hint => h('span', { class: 'hint' }, [glyph(hint.pad, hint.key), h('span', { text: hint.label })])),
  );
}

/** The root of a screen: a full-frame layer with a name for screen readers and a test id. */
export function screen(testid: string, className: string, label: string, children: Child[], theme?: string) {
  return h('section', { class: `screen ${className}`, testid, style: theme ? { '--theme': theme } : {}, attrs: { role: 'dialog', 'aria-label': label } }, children);
}

/** A big title in the display font. */
export const heading = (text: string, testid?: string, level: 'h1' | 'h2' = 'h2') => h(level, { class: 'display', text, testid });

export function stat(iconName: IconName, text: string, testid?: string, className = 'stat') {
  return h('span', { class: className, testid }, [icon(iconName), h('span', { text })]);
}
