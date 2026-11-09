// The picture behind the menus (and around the fight): the place's background art, color-graded with its theme, with
// a slow drift. A new place cross-fades over the old one. Interiors (the Pokémon Center, the Mart…) blur it.

import { backdropUrl, type Backdrop } from '../data/art';

export interface BackdropSpec {
  image: Backdrop;
  /** The theme color the picture is graded with. */
  theme: string;
  /** scene: the place itself; interior: blurred behind a room; fight: dimmed around the fight canvas. */
  mode: 'scene' | 'interior' | 'fight';
}

export function createBackdrop(root: HTMLElement) {
  let current: BackdropSpec | null = null;
  return {
    set(spec: BackdropSpec) {
      // On the whole frame, so every screen picks up the place's color.
      (root.parentElement ?? root).style.setProperty('--theme', spec.theme);
      root.dataset.mode = spec.mode;
      if (current?.image === spec.image) {
        current = spec;
        return;
      }
      current = spec;
      const layer = document.createElement('div');
      layer.className = 'backdrop-image';
      layer.style.backgroundImage = `url("${backdropUrl(spec.image)}")`;
      // On top of the old picture (the tint and vignette are the root's ::after, above every layer).
      root.append(layer);
      // Fade in over the old picture, then drop the old ones.
      requestAnimationFrame(() => layer.classList.add('shown'));
      const old = [...root.querySelectorAll('.backdrop-image')].filter(element => element !== layer);
      window.setTimeout(() => old.forEach(element => element.remove()), 700);
    },
    /** Keeps the picture, changes how it shows (a menu opening over the place blurs it). */
    mode(mode: BackdropSpec['mode']) {
      root.dataset.mode = mode;
    },
  };
}

export type BackdropControl = ReturnType<typeof createBackdrop>;
