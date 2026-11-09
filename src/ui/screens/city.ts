// The city hub: the town's name and the player's standing on top, the places to go as cards (adventure first, then
// services), and the party along the bottom. Built for a controller: everything is a big target in a grid.

import { h } from '../dom';
import { mount } from '../focus';
import { icon } from '../icons';
import { badgePicture, button, card, heading, hintBar, hpBar, picture, pokemonSprite, screen, stat, type ButtonSpec, type CardSpec, type Hint, type Pad } from '../kit';

/** What a card shows at its top. */
export interface PlaceArt {
  /** Pokémon that live there (unseen ones as silhouettes). */
  pokemon?: { url: string; seen: boolean }[];
  /** A person (trainer sprite URL). */
  people?: string[];
  /** An item sprite. */
  item?: string;
  /** A badge already won here. */
  badge?: string;
}

export interface PlaceCard extends Omit<CardSpec, 'art' | 'size'> {
  art?: PlaceArt;
}

export interface CityView {
  region: string;
  name: string;
  tagline: string;
  theme: string;
  money: string;
  /** Buttons beside the party, at the bottom: the Pokédex (X) and the bag (RB / B), as pictures (render/gear.ts). */
  tools: { label: string; detail: string; testid: string; image: string; pad: Pad; key: string; onClick: () => void }[];
  badges: { url: string; earned: boolean; name: string }[];
  badgeCount: string;
  champion: string | null;
  /** Hunting, the gym or the League, the Safari, the battle field. */
  adventure: PlaceCard[];
  /** Pokémon Center, Mart, PC box, map. */
  services: PlaceCard[];
  party: { url: string; level: string; hp: number; maxHp: number; fainted: boolean }[];
  partyLabel: string;
  onParty: () => void;
  /** Small buttons in the corner (options, title). */
  system: ButtonSpec[];
  hints: Hint[];
}

/**
 * A hunting card shows every species of its ground (4 to 22). The more there are, the smaller each one, so all of
 * them fit in the card (cqh: the frame's height).
 */
export function monSize(count: number): number {
  if (count <= 5) return 12.5;
  if (count <= 8) return 11.5;
  if (count <= 12) return 10;
  if (count <= 16) return 9;
  return 8;
}

function placeArt(art: PlaceArt | undefined) {
  if (!art) return undefined;
  return h('span', { class: 'place-art' }, [
    art.pokemon?.length
      ? h(
          'span',
          { class: 'place-pokemon', testid: 'place-pokemon', style: { '--mon': `${monSize(art.pokemon.length)}cqh` } },
          art.pokemon.map((p, i) => {
            const image = pokemonSprite(p.url, 'sprite place-mon', { silhouette: !p.seen });
            image.style.setProperty('--i', String(i));
            return image;
          }),
        )
      : null,
    ...(art.people ?? []).map((url, i) => {
      const person = picture(url, 'trainer place-person');
      person.style.setProperty('--i', String(i));
      return person;
    }),
    art.item ? picture(art.item, 'item place-item') : null,
    art.badge ? badgePicture(art.badge, 'badge place-badge') : null,
  ]);
}

const placeCard = (place: PlaceCard, size: CardSpec['size'], index: number) => {
  const element = card({ ...place, size, art: placeArt(place.art) });
  element.style.setProperty('--i', String(index));
  return element;
};

export function renderCity(root: HTMLElement, view: CityView) {
  const partyButton = h(
    'button',
    { class: 'party-strip', testid: 'city-party', onClick: view.onParty, attrs: { type: 'button', 'aria-label': view.partyLabel } },
    [
      h('span', { class: 'party-strip-label' }, [h('span', { text: view.partyLabel })]),
      ...view.party.map(member =>
        h('span', { class: `party-chip${member.fainted ? ' fainted' : ''}` }, [
          pokemonSprite(member.url, 'sprite party-chip-sprite'),
          h('span', { class: 'party-chip-info' }, [h('small', { text: member.level }), hpBar(member.hp, member.maxHp)]),
        ]),
      ),
    ],
  );

  mount(
    root,
    screen(
      'city',
      'city',
      view.name,
      [
        h('header', { class: 'topbar' }, [
          h('div', { class: 'place-name' }, [
            h('span', { class: 'region-label' }, [icon('pin'), view.region]),
            heading(view.name, 'city-heading', 'h1'),
            h('p', { class: 'tagline', text: view.tagline }),
          ]),
          h('div', { class: 'standing' }, [
            h('div', { class: 'standing-row' }, [
              stat('coin', view.money, 'city-money', 'stat money'),
              view.champion ? stat('crown', view.champion, 'city-champion', 'stat champion') : null,
            ]),
            h('div', { class: 'badge-case', testid: 'city-badges', attrs: { 'aria-label': view.badgeCount } }, [
              ...view.badges.map(b => {
                const image = badgePicture(b.url, `badge${b.earned ? ' earned' : ''}`);
                image.title = b.name;
                return image;
              }),
              h('span', { class: 'badge-count', text: view.badgeCount }),
            ]),
          ]),
          h('nav', { class: 'system' }, view.system.map(spec => button({ ...spec, class: `icon-only ${spec.class ?? ''}` }))),
        ]),
        h('main', { class: 'places' }, [
          // More than 5 cards (a sanctuary with many legendaries): two rows.
          h(
            'div',
            { class: `adventure${view.adventure.length > 5 ? ' two-rows' : ''}`, style: { '--n': Math.min(5, Math.ceil(view.adventure.length / (view.adventure.length > 5 ? 2 : 1))) } },
            view.adventure.map((p, i) => placeCard(p, 'hero', i)),
          ),
          h('div', { class: 'services', style: { '--n': view.services.length } }, view.services.map((p, i) => placeCard(p, 'tile', i + view.adventure.length))),
        ]),
        h('footer', { class: 'city-footer' }, [
          h('div', { class: 'city-tools' }, [
            partyButton,
            ...view.tools.map(tool =>
              h(
                'button',
                {
                  class: 'tool-button',
                  testid: tool.testid,
                  onClick: tool.onClick,
                  attrs: {
                    type: 'button',
                    'aria-label': `${tool.label}: ${tool.detail}`,
                    title: `${tool.label} · ${tool.detail}`,
                    'data-pad': tool.pad,
                    'data-key': tool.key,
                  },
                },
                [h('img', { class: 'tool-image', attrs: { src: tool.image, alt: '', draggable: 'false' } })],
              ),
            ),
          ]),
          hintBar(view.hints),
        ]),
      ],
      view.theme,
    ),
  );
}
