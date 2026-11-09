// The app: the save, the language, the scenes (title, the Professor's story, starter choice, fights, the city and
// its menus) and the menus over fights (results, party), tied together. A fight only runs while no menu is open over it.

import { BALLS, EVOLUTION_ITEMS, ITEMS, type BallId, type EvolutionItemId, type ItemId, type PotionId } from './data/items';
import { move, species, speciesBySlug } from './data/pokedex';
import { city, gymByBadge, gymIn, hasRegion, isSanctuary, isUnlocked, nextRegion, placeArt, region, regionOpen, REGION_IDS, type Gym, type HuntKind, type Legendary, type Region, type RegionId } from './data/regions';
import { backdropUrl, badgeUrl, CHANSEY, HUNT_BACKDROPS, trainerClassFor, itemUrl, PEOPLE, trainerUrl, typeBackdrop } from './data/art';
import { createSilentAudio, createWebAudio } from './audio/audio';
import { fightCues, freshCues, type SoundId } from './audio/cues';
import type { SongId } from './audio/music';
import { readFirstPad, type MenuPad, NO_MENU_PAD } from './engine/input/gamepad';
import { attachKeyboard } from './engine/input/keyboard';
import { createKeyLatch } from './engine/input/keys';
import { createFixedStep } from './engine/loop';
import { createRng } from './engine/rng';
import type { Style } from './fight/ai/profiles';
import type { TeamMember } from './fight/battle';
import { afterBattle, type ReportLine, type XpGain } from './game/after-battle';
import { addCaught, canPlace, canRelease, canSendToBox, canTakeFromBox, place, release, sendToBox, swapInParty, takeFromBox, type Place, type Spot } from './game/box';
import { catchValue, throwBall } from './game/capture';
import { buy, canUsePotion, countOf, MAX_MONEY, moneyAfterLoss, prizeMoney, removeItem, usePotion } from './game/economy';
import { cpuProfile, type Controller } from './game/ai';
import {
  dexNumbers,
  dexRanges,
  dexStatus,
  dexTypes,
  evolutionChain,
  filterDex,
  isFiltered,
  NO_FILTER,
  ownedCount,
  whereToFind,
  type DexFilter,
  type EvolveBy,
  type FoundAt,
} from './game/pokedex';
import { dexText } from './data/dex-text';
import { bestRod, chances, encounterTable, huntTable, rollEncounter, tableForAreas, wildPokemon } from './game/encounters';
import { canChallenge, gymTeam, leaderPrize } from './game/gym';
import { canEnterLeague, LEAGUE_SIZE, leagueOpponent, leaguePrize, type LeagueOpponent } from './game/league';
import { bigShape, elementalShape } from './game/moves';
import { displayHp, maxHpOf, statsOf, toFighter, type Pokemon } from './game/pokemon';
import { evolve, heal, itemEvolution, setSpecial, specialOptions } from './game/progress';
import { SAFARI_BALLS, SAFARI_ENTRANCE, SAFARI_SECONDS } from './game/safari';
import { cleanName, createStarter, DEFAULT_NAMES, MAX_NAME_LENGTH, trainingOpponents } from './game/story';
import { MAX_LEVEL, xpForLevel } from './game/xp';
import { detectLanguage, language, LANGUAGE_NAMES, LANGUAGES, setKeyNames, setLanguage, t, type Language, type MessageKey } from './i18n';
import { createRenderer } from './render/renderer';
import type { StageSpec } from './render/stage';
import type { Direction } from './ui/spatial';
import { typeColor } from './render/colors';
import { leaderLook, LOOKS, type TrainerLook } from './screens/entrance';
import { preloadImages } from './render/images';
import { preloadSprites, spriteUrl } from './render/sprites';
import { createSandbox, isOpponent, type Banner, type Director, type Opponent, type Sandbox } from './screens/sandbox';
import { OPPONENT_TEAM, PLAYER_TEAM } from './screens/sandbox-teams';
import { createTutorialDirector, type TutorialDirector } from './screens/tutorial-director';
import { newSave, startRegion, switchRegion, type Save } from './state/save';
import { ACTIONS, bindingsOf, createSettingsStore, DEFAULT_KEYS, keyLabel, keyNames, MAX_VOLUME, rebind, stepVolume, VOLUME_KINDS, type Action, type Settings } from './state/settings';
import { endgameSave, ENDGAME_SAVE_KEY } from './state/endgame';
import { createSaveStore, SAVE_KEY } from './state/store';
import { installTestHooks, type TestOptions } from './test/hooks';
import { createBackdrop } from './ui/backdrop';
import type { IconName } from './ui/icons';
import type { Hint, Pad } from './ui/kit';
import { renderCenter } from './ui/screens/center';
import { renderBox, type BoxMon } from './ui/screens/box';
import { renderCity, type PlaceCard } from './ui/screens/city';
import { renderMap } from './ui/screens/map';
import { renderMart } from './ui/screens/mart';
import { renderStarter } from './ui/screens/starter';
import { renderDialog } from './ui/screens/dialog';
import { renderCapture } from './ui/screens/capture';
import { renderBag, type BagTarget } from './ui/screens/bag';
import { renderFlight, renderTravel } from './ui/screens/travel';
import { regionPicture } from './render/region-map';
import { canThrowAt, legendaryFighter, legendaryPokemon } from './game/legendary';
import { gearPicture } from './render/gear';
import { bagContents, checkUse, usableFromBag, type Pocket } from './game/bag';
import { renderDexEntry, renderDexList } from './ui/screens/pokedex';
import { renderEvolution } from './ui/screens/evolution';
import { renderOptions } from './ui/screens/options';
import { renderTitle, type TitleOption } from './ui/screens/title';
import { moveFocus, pressBack, pressFocused, pressShortcut, trackInput } from './ui/focus';
import { renderHallOfFame, renderLeague, renderPage, renderSafari } from './ui/screens/journey';
import { renderResults, type ReportKind, type XpCard } from './ui/screens/results';
import { renderParty, type MoveInfo, type PartyMember } from './ui/screens/party';

/** A text to show: a translation key and its values. */
type Line = { key: MessageKey; params: Record<string, string | number> };
/** A line of the story, said by someone. */
type Said = Line & { speaker: string; /** The speaker's sprite (Showdown name). */ portrait?: string };

/**
 * Fights: the demo (Training without a journey: Lv. 30 demo teams, no XP), trainers (the battle field: XP and prize
 * money), a gym leader (a badge), a wild Pokémon (hunting: XP and a chance to catch it), a Safari Zone Pokémon
 * (30 seconds, Safari Balls), and the rival tutorial.
 */
type FightMode = 'demo' | 'trainer' | 'gym' | 'wild' | 'safari' | 'league' | 'tutorial' | 'legendary';
type Scene = 'title' | 'story' | 'starter' | 'fight' | 'city' | 'menu';

interface ResultsState {
  outcome: 'win' | 'loss' | 'draw';
  lines: Line[];
  /** A defeated wild Pokémon, waiting for a ball (asked first). A legendary only takes a Master Ball. */
  capture: { pokemon: Pokemon; playerLevel: number; legendary?: boolean } | null;
  /** Party indexes ready to evolve, asked one at a time. */
  evolutions: { index: number; to: number }[];
  /** The Pokémon that gained XP, for the cards (made when the battle ends, before any evolution). */
  xp: XpCard[];
  onContinue: () => void;
  /** Another encounter in the same place (hunting, the Safari). */
  again?: () => void;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const nameOf = (p: Pokemon) => species(p.speciesId).name;
const cityKey = (location: string) => `city.${location}` as MessageKey;
const itemName = (id: ItemId) => t(`item.${id}` as MessageKey);

/** The page's parts (index.html): the 16:9 frame, the fight canvas, the menus' layer and the backdrop. */
export interface AppElements {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  backdrop: HTMLElement;
}

/** What the player hears at each moment of a throw. */
const CAPTURE_SOUND = { throw: 'ballThrow', open: 'ballOpen', shake: 'shake', caught: 'caught', escape: 'ballOpen' } as const satisfies Record<string, SoundId>;
/**
 * What to say when a Pokémon breaks free, by how many times the ball wobbled first. After the games' lines, but
 * each one says plainly that it got away (the games' "It appeared to be caught!" read like a catch).
 */
const ESCAPE_TEXT = ['capture.escape0', 'capture.escape1', 'capture.escape2', 'capture.escape3'] as const;

export function startApp(elements: AppElements, options: TestOptions) {
  const { frame, canvas, overlay: overlayRoot } = elements;
  const backdrop = createBackdrop(elements.backdrop);
  const input = trackInput(frame, overlayRoot);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  const renderer = createRenderer(ctx);
  const params = new URLSearchParams(location.search);
  const seed = options.enabled ? options.seed : Date.now() >>> 0;
  /** Encounters and catching (seeded in test mode, so the browser tests are repeatable). */
  const rng = createRng(seed);
  /** The CPU's seeds and personalities: their own sequence, so they never change which Pokémon appear. */
  const fightRng = createRng(seed ^ 0x5bd1e995);

  // ── Save and language ─────────────────────────────────────────────────────────────────────────────────────────
  // `npm run endgame`: a build that plays from the endgame save (every League won, state/endgame.ts), kept under its
  // own key so the real save is never touched. The script opens it with ?fresh, which starts that save over.
  const endgame = import.meta.env.MODE === 'endgame' && !options.enabled;
  const store = createSaveStore(safeStorage(), endgame ? ENDGAME_SAVE_KEY : SAVE_KEY);
  if (endgame) {
    if (params.has('fresh') || store.load().status !== 'ok') store.write(endgameSave(Date.now(), detectLanguage(navigator.language)));
    params.delete('fresh');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    document.title = `${document.title} · Endgame`;
    document.body.append(Object.assign(document.createElement('div'), { className: 'build-tag', textContent: 'Endgame build' }));
  }
  const loaded = store.load();
  let save: Save | null = loaded.status === 'ok' ? loaded.save : null;
  let notice: MessageKey | null = null;
  if (loaded.status === 'broken') {
    console.warn(`Saved game could not be read (${loaded.reason}: ${loaded.detail}); it was kept aside.`);
    notice = 'save.problem';
  }
  const persist = () => save && store.write(save);

  // ── Settings and sound ────────────────────────────────────────────────────────────────────────────────────────
  const settingsStore = createSettingsStore(safeStorage());
  let settings: Settings = settingsStore.load();
  setKeyNames(keyNames(settings.keys));
  // The browser tests stay silent (and never fetch cries).
  const audio = options.enabled ? createSilentAudio() : createWebAudio(settings.muted, settings.volumes);
  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
  // Every menu button clicks.
  overlayRoot.addEventListener('click', event => {
    if (event.target instanceof HTMLElement && event.target.closest('button')) audio.play('confirm');
  });
  const applySettings = (next: Settings) => {
    settings = next;
    settingsStore.write(next);
    keys.setBindings(bindingsOf(next.keys));
    setKeyNames(keyNames(next.keys));
    audio.setMuted(next.muted);
    audio.setVolumes(next.volumes);
  };
  const toggleMute = () => {
    applySettings({ ...settings, muted: !settings.muted });
    // The Options screen shows the sound setting: redraw it.
    overlayRoot.querySelector<HTMLButtonElement>('[data-testid="sound"]')?.classList.toggle('on', !settings.muted);
  };
  const update = (change: (s: Save) => Save) => {
    if (!save) return;
    save = change(save);
    persist();
  };
  /** Adds species to the Pokédex. */
  const register = (s: Save, seen: number[], caught: number[] = []): Save['dex'] => ({
    seen: [...new Set([...s.dex.seen, ...seen, ...caught])],
    caught: [...new Set([...s.dex.caught, ...caught])],
  });

  const applyLanguage = (next: Language) => {
    setLanguage(next);
    document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en';
  };
  applyLanguage(save?.settings.language ?? settings.language ?? detectLanguage(navigator.language));
  const chooseLanguage = (next: Language) => {
    applyLanguage(next);
    applySettings({ ...settings, language: next });
    update(s => ({ ...s, settings: { ...s.settings, language: next } }));
  };

  // ── Scenes ────────────────────────────────────────────────────────────────────────────────────────────────────
  let scene: Scene = 'title';
  let mode: FightMode = 'demo';
  let sandbox: Sandbox | null = null;
  let tutorial: TutorialDirector | null = null;
  /** The wild Pokémon being fought (it can be caught after the battle). */
  let wild: Pokemon | null = null;
  /** The gym being challenged. */
  let gym: Gym | null = null;
  /** The Safari Game in progress (its balls are not in the bag). */
  let safari: { balls: number } | null = null;
  /** A League run in progress: which of the five battles comes next. */
  let league: { stage: number } | null = null;
  /** Where the party screen goes back to when it closes. */
  let partyFrom: 'city' | 'league' | 'fight' = 'city';
  /** A menu over the fight (which pauses it). */
  let modal: 'none' | 'results' | 'party' = 'none';
  let results: ResultsState | null = null;
  let partyChanged = false;

  const show = () => (overlayRoot.hidden = false);
  const hide = () => {
    overlayRoot.hidden = true;
    overlayRoot.replaceChildren();
  };
  const leaveFight = () => {
    sandbox = null;
    tutorial = null;
    wild = null;
    modal = 'none';
    results = null;
  };

  /** The hint bar's usual entries. */
  const hints = {
    get select(): Hint {
      return { pad: 'a', key: 'Enter', label: t('hint.select') };
    },
    get back(): Hint {
      return { pad: 'b', key: 'Esc', label: t('hint.back') };
    },
    get party(): Hint {
      return { pad: 'y', key: 'P', label: t('hint.party') };
    },
  };

  /** Two Pokémon facing off on the title screen (a different pair each visit; always the first in tests). */
  const DUELS: [number, number][] = [
    [6, 9],
    [25, 150],
    [3, 149],
    [94, 65],
    [130, 59],
    [68, 143],
  ];
  const duel = DUELS[options.enabled ? 0 : Math.floor(Math.random() * DUELS.length)];

  function goTitle() {
    leaveFight();
    scene = 'title';
    show();
    backdrop.set({ image: 'space', theme: '#8f6bff', mode: 'scene' });
    const choices: TitleOption[] = [];
    if (save) {
      choices.push({ label: t('title.continue'), description: t('title.continueText'), testid: 'continue-game', icon: 'arrow', primary: true, onClick: continueGame });
    }
    choices.push({ label: t('title.new'), description: t('title.newText'), testid: 'new-game', icon: 'star', primary: !save, onClick: () => newGame() });
    choices.push({ label: t('title.training'), description: t('title.trainingText'), testid: 'training', icon: 'battle', onClick: startDemo });
    choices.push({ label: t('title.options'), description: t('title.optionsText'), testid: 'options', icon: 'gear', onClick: () => showOptions(goTitle) });
    renderTitle(overlayRoot, {
      subtitle: t(notice ?? 'title.subtitle'),
      duel: [spriteUrl(duel[0]), spriteUrl(duel[1])],
      options: choices,
      journey: save
        ? {
            label: t('title.continue'),
            player: save.player.name,
            place: t(cityKey(save.location)),
            badges: t('city.badgesLabel', { count: save.badges.length }),
            party: save.party.map(p => spriteUrl(p.speciesId)),
            trainer: trainerUrl(PEOPLE.player),
          }
        : null,
      footer: t('title.footer'),
      hints: [hints.select],
    });
  }

  /** The story, one line at a time (Next / Enter), then `then`. */
  function tell(lines: Said[], then: () => void, index = 0) {
    if (index >= lines.length) return then();
    scene = 'story';
    // After a fight, the place shows clearly again behind the words.
    backdrop.mode('scene');
    show();
    const line = lines[index];
    renderDialog(overlayRoot, {
      speaker: line.speaker,
      portrait: line.portrait ? trainerUrl(line.portrait) : null,
      text: t(line.key, line.params),
      buttons: [{ label: t('dialog.next'), testid: 'dialog-next', onClick: () => tell(lines, then, index + 1) }],
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
    });
  }

  /** A question with a text field (a name). */
  function ask(key: MessageKey, fallback: string, then: (answer: string) => void) {
    scene = 'story';
    show();
    renderDialog(overlayRoot, {
      speaker: t('speaker.professor'),
      portrait: trainerUrl(regionNow().people.professor),
      text: t(key),
      input: { label: t('dialog.name'), value: fallback, maxLength: MAX_NAME_LENGTH },
      buttons: [{ label: t('dialog.ok'), testid: 'dialog-ok', onClick: typed => then(cleanName(typed, fallback)) }],
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.ok') }],
    });
  }

  /** A yes / no question (B / Esc answers no). */
  function confirm(speaker: string, portrait: string | null, key: MessageKey, yes: () => void, no: () => void) {
    scene = 'story';
    show();
    renderDialog(overlayRoot, {
      speaker,
      portrait: portrait ? trainerUrl(portrait) : null,
      text: t(key),
      buttons: [
        { label: t('dialog.yes'), testid: 'dialog-yes', onClick: yes },
        { label: t('dialog.no'), testid: 'dialog-no', back: true, onClick: no },
      ],
      hints: [hints.select, hints.back],
    });
  }

  const professor = (key: MessageKey, values: Line['params'] = {}): Said => ({
    speaker: t('speaker.professor'),
    portrait: regionNow().people.professor,
    key,
    params: values,
  });

  // ── The prologue ──────────────────────────────────────────────────────────────────────────────────────────────
  function newGame(confirmed = false) {
    const kanto = region('kanto');
    if (save && !confirmed) return confirm(t('speaker.professor'), kanto.people.professor, 'title.confirmNew', () => newGame(true), goTitle);
    notice = null;
    const pallet = placeArt('pallet');
    backdrop.set({ image: pallet.backdrop, town: 'pallet', theme: pallet.color, mode: 'scene' });
    // The starters' sprites load while the Professor talks.
    preloadSprites([...kanto.starters]);
    tell([professor('story.welcome'), professor('story.live')], () =>
      ask('story.askName', DEFAULT_NAMES.player, player =>
        ask('story.askRival', DEFAULT_NAMES.rival, rival => chooseStarter(player, rival)),
      ),
    );
  }

  function chooseStarter(player: string, rival: string) {
    tell([professor('story.choose', { player })], () => showStarters(region('kanto'), id => pickStarter(id, player, rival)));
  }

  /** The three starters of a region, side by side; `pick` gets the chosen one. */
  function showStarters(r: Region, pick: (id: number) => void) {
    {
      scene = 'starter';
      show();
      const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
      renderStarter(overlayRoot, {
        title: t('starter.title'),
        subtitle: t('starter.subtitle'),
        professor: trainerUrl(r.people.professor),
        starters: r.starters.map(id => {
          const sp = species(id);
          return {
            name: sp.name,
            sprite: spriteUrl(id),
            color: typeColor(sp.types[0]),
            types: sp.types.map(type => ({ type, label: t(`type.${type}` as MessageKey) })),
            stats: stats.map(stat => ({ label: t(`stat.${stat}`), value: sp.stats[stat] })),
            testid: `starter-${sp.slug}`,
            onClick: () => pick(id),
          };
        }),
        hints: [hints.select],
      });
    }
  }

  function pickStarter(id: number, player: string, rival: string) {
    const kanto = region('kanto');
    const starter = createStarter(kanto, id);
    const rivalId = kanto.rivalPick[id];
    save = newSave({ playerName: player, rivalName: rival, starterId: id, rivalStarterId: rivalId, party: [starter] }, Date.now(), language());
    persist();
    const gift = move(kanto.starterGifts[id]);
    tell(
      [
        professor('story.gift', { pokemon: species(id).name, move: gift.name, type: t(`type.${gift.type}` as MessageKey) }),
        { speaker: rival, portrait: kanto.people.rival, key: 'story.rivalPick', params: { pokemon: species(rivalId).name, player } },
        professor('story.tutorial'),
      ],
      startTutorial,
    );
  }

  function continueGame() {
    if (!save) return;
    notice = null;
    if (save.prologue === 'tutorial') tell([professor('story.tutorial')], startTutorial);
    else goCity();
  }

  function startTutorial() {
    if (!save) return;
    const rival = createStarter(region('kanto'), save.rival.starterId);
    tutorial = createTutorialDirector(seed, save.rival.name, move(save.party[0].specials.elemental).name);
    enterFight('tutorial', save.party.map(toFighter), [toFighter(rival)], {
      director: tutorial,
      stage: { id: 'route', backdrop: 'route' },
      rivalLook: LOOKS.rival,
    });
  }

  function endPrologue(outcome: ResultsState['outcome']) {
    if (!save) return;
    const s = save;
    const lost = outcome !== 'win';
    // After the first battle the starter rests at home: full HP, whatever happened.
    // The journey starts at home, in Pallet Town (Route 1's grass is right there).
    update(current => ({ ...current, prologue: 'done', location: 'pallet', party: current.party.map(heal) }));
    tell(
      [
        { speaker: s.rival.name, portrait: regionNow().people.rival, key: lost ? 'story.rivalWon' : 'story.rivalLost', params: { player: s.player.name } },
        ...(lost ? [professor('story.rested')] : []),
        professor('story.depart'),
      ],
      goCity,
    );
  }

  // ── The city and its menus ────────────────────────────────────────────────────────────────────────────────────
/** The region the player is in (Kanto before a journey starts). */
  const regionNow = (): Region => region(save?.region ?? 'kanto');
  /** A badge's picture (each region's gyms number theirs). */
  const badgeArt = (badge: string) => badgeUrl(gymByBadge(badge)?.badgeSprite ?? 1);

  const ownsRod = (s: Save) => bestRod(rod => countOf(s.bag, rod) > 0);

  function goCity() {
    if (!save) return goTitle();
    leaveFight();
    scene = 'city';
    show();
    const s = save;
    const here = city(s.location);
    const art = placeArt(here.id);
    backdrop.set({ image: art.backdrop, town: here.id, theme: art.color, mode: 'scene' });
    // Everything that can appear here (and the party) starts loading now, so a hunt starts with its sprites ready.
    const rod = ownsRod(s);
    const possible = (['grass', 'cave', 'water'] as HuntKind[]).flatMap(kind => encounterTable(here, kind, rod).map(e => e.speciesId));
    preloadSprites([...new Set([...possible, ...s.party.map(p => p.speciesId)])]);

    const huntColors: Record<HuntKind, string> = { grass: '#3fae5a', cave: '#9a6b45', water: '#2f8fe0' };
    const huntIcons: Record<HuntKind, IconName> = { grass: 'grass', cave: 'cave', water: 'rod' };
    const adventure: PlaceCard[] = (['grass', 'cave', 'water'] as HuntKind[])
      .filter(kind => here.hunts[kind])
      .map(kind => {
        // Water shows what the best rod could catch; without a rod, what an Old Rod would.
        // What you'd meet here (the variety rules: locals first), the most likely first.
        const table = huntTable(here, encounterTable(here, kind, kind === 'water' ? (rod ?? 'old-rod') : null), s.dex.caught);
        const ids = chances(table).map(c => c.speciesId);
        const min = Math.min(...table.map(e => e.minLevel));
        const max = Math.max(...table.map(e => e.maxLevel));
        const noRod = kind === 'water' && !rod;
        return {
          testid: `hunt-${kind}`,
          title: t(`place.${kind}`),
          subtitle: noRod ? t('place.noRod') : kind === 'water' ? `${t('place.rod', { rod: itemName(rod!) })} · ${t('place.levels', { min, max, count: ids.length })}` : t('place.levels', { min, max, count: ids.length }),
          color: huntColors[kind],
          icon: huntIcons[kind],
          locked: noRod,
          chip: noRod ? { text: t('place.needsRod'), icon: 'lock', tone: 'lock' } : undefined,
          // Every species of this ground, the most common first (unseen ones as silhouettes).
          art: { pokemon: ids.map(id => ({ url: spriteUrl(id), seen: s.dex.seen.includes(id) })) },
          onClick: () => startHunt(kind),
        } satisfies PlaceCard;
      });
    const g = gymIn(here.id);
    if (g) {
      const beaten = s.badges.includes(g.badge);
      const open = !beaten && canChallenge(g, s.badges);
      adventure.push({
        testid: 'city-gym',
        title: t('place.gym'),
        subtitle: t('place.gymLeader', { leader: g.leader, type: t(`type.${g.type}` as MessageKey) }),
        color: typeColor(g.type),
        icon: 'gym',
        locked: !open,
        chip: beaten
          ? { text: t('place.beaten'), icon: 'check', tone: 'ok' }
          : open
            ? undefined
            : { text: t('place.badgesNeeded', { badges: g.badges }), icon: 'lock', tone: 'lock' },
        art: { people: [trainerUrl(g.sprite)], badge: beaten ? badgeArt(g.badge) : undefined },
        onClick: () => startGym(g),
      });
    }
    if (here.id === regionNow().league.city) {
      const open = canEnterLeague(s.badges);
      adventure.push({
        testid: 'city-league',
        title: t('place.league'),
        subtitle: t('place.leagueText'),
        color: '#7b5cff',
        icon: 'crown',
        locked: !open,
        chip: open ? undefined : { text: t('place.badgesNeeded', { badges: 8 }), icon: 'lock', tone: 'lock' },
        art: { people: regionNow().league.eliteFour.slice(-2).reverse().map(member => trainerUrl(member.sprite)) },
        onClick: startLeague,
      });
    }
    if (here.safari) {
      adventure.push({
        testid: 'city-safari',
        title: t('place.safari'),
        subtitle: t('place.safariText', { price: SAFARI_ENTRANCE }),
        color: '#8fae3a',
        icon: 'safari',
        locked: s.money < SAFARI_ENTRANCE,
        art: { item: itemUrl('safari-ball') },
        onClick: enterSafari,
      });
    }
    // The sanctuary: a card for each legendary instead of the battle field.
    const sanctuary = isSanctuary(here.id) ? regionNow().sanctuary : null;
    for (const l of sanctuary?.legendaries ?? []) {
      const id = speciesBySlug(l.species).id;
      const caught = s.dex.caught.includes(id);
      adventure.push({
        testid: `legend-${l.species}`,
        title: species(id).name,
        subtitle: t(species(id).mythical ? 'legend.cardMythical' : 'legend.card', { level: l.level }),
        color: typeColor(species(id).types[0]),
        icon: 'star',
        locked: caught,
        chip: caught ? { text: t('legend.caught'), icon: 'check', tone: 'ok' } : undefined,
        art: { pokemon: [{ url: spriteUrl(id), seen: s.dex.seen.includes(id) }] },
        onClick: () => startLegendary(l),
      });
    }
    if (!sanctuary) adventure.push({
      testid: 'city-training',
      title: t('place.training'),
      subtitle: t('place.trainingText'),
      color: '#e8573f',
      icon: 'battle',
      art: { people: [trainerUrl('acetrainer'), trainerUrl('acetrainerf')] },
      onClick: startTrainer,
    });
    // The first open adventure is where the focus starts.
    const first = adventure.find(place => !place.locked);
    if (first) first.primary = true;

    const services: PlaceCard[] = [
      {
        testid: 'city-center',
        title: t('place.center'),
        subtitle: t('place.centerText'),
        color: '#ef6f9b',
        icon: 'heal',
        art: { people: [trainerUrl(PEOPLE.nurse)] },
        onClick: () => showCenter(null),
      },
      ...(here.shop
        ? [
            {
              testid: 'city-shop',
              title: t(here.id === 'saffron' ? 'place.mall' : 'place.shop'),
              subtitle: t('place.shopText', { count: here.shop.length }),
              color: '#3f7cf0',
              icon: 'mart',
              art: { people: [trainerUrl(PEOPLE.clerk)] },
              onClick: () => showShop(null),
            } satisfies PlaceCard,
          ]
        : []),
      { testid: 'city-box', title: t('place.box'), subtitle: t('place.boxText', { count: s.box.length }), color: '#2fa9a0', icon: 'pc', onClick: openBox },
      // Select (View) on a controller, Tab on the keyboard: the map from anywhere in the city, to change cities quickly.
      { testid: 'city-map', title: t('place.map'), subtitle: t('place.mapText'), color: '#c99b4a', icon: 'map', pad: 'view', key: 'Tab', onClick: showMap },
    ];

    renderCity(overlayRoot, {
      region: t(`region.${regionNow().id}`),
      name: t(cityKey(s.location)),
      tagline: t(`city.${s.location}.tagline` as MessageKey),
      theme: art.color,
      money: t('city.money', { money: s.money }),
      tools: [
        {
          label: t('dex.title'),
          detail: t('city.dex', { seen: s.dex.seen.length, caught: s.dex.caught.length }),
          testid: 'city-dex',
          image: gearPicture('pokedex'),
          pad: 'x',
          key: 'KeyX',
          onClick: () => showPokedex(),
        },
        {
          label: t('bag.title'),
          detail: t('bag.count', { count: Object.values(s.bag).reduce((sum, n) => sum + (n ?? 0), 0) }),
          testid: 'city-bag',
          image: gearPicture('bag'),
          pad: 'rb',
          key: 'KeyB',
          onClick: () => showBag(),
        },
        {
          label: t('travel.title'),
          detail: t('travel.detail', { count: REGION_IDS.filter(id => regionOpen(id, s.champions)).length }),
          testid: 'city-travel',
          image: gearPicture('plane'),
          pad: 'lb',
          key: 'KeyT',
          onClick: () => showTravel(),
        },
      ],
      badges: regionNow().gyms.map(({ badge }) => ({ url: badgeArt(badge), earned: s.badges.includes(badge), name: t(`badge.${badge}` as MessageKey) })),
      badgeCount: t('city.badges', { count: s.badges.length }),
      champion: s.champion ? t('city.champion') : null,
      adventure,
      services,
      party: s.party.map(p => ({ url: spriteUrl(p.speciesId), level: t('party.level', { level: p.level }), hp: p.hp, maxHp: maxHpOf(p), fainted: p.hp === 0 })),
      partyLabel: t('city.party'),
      onParty: toggleParty,
      system: [
        { label: t('city.options'), testid: 'city-options', icon: 'gear', onClick: () => showOptions(goCity) },
        { label: t('city.title'), testid: 'to-title', icon: 'exit', onClick: goTitle },
      ],
      hints: [
        hints.select,
        hints.party,
        { pad: 'view', key: 'Tab', label: t('place.map') },
        { pad: 'x', key: 'X', label: t('dex.title') },
        { pad: 'rb', key: 'B', label: t('bag.title') },
        { pad: 'lb', key: 'T', label: t('travel.title') },
      ],
    });
  }

  // ── The bag ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** The bag: every item by pocket; potions and evolution items are used on a Pokémon from here. */
  function showBag(start?: ItemId) {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    indoors('#d0883a');
    const contents = bagContents(s.bag);
    const ELSEWHERE: Partial<Record<Pocket, MessageKey>> = { balls: 'bag.ballsUse', key: 'bag.rodsUse' };
    const target = (id: ItemId, p: Pokemon, index: number): BagTarget => {
      const check = checkUse(id, p, regionNow().lastSpecies);
      const item = ITEMS[id];
      const note = check.ok
        ? item.kind === 'potion'
          ? t('bag.heals', { hp: Math.min(item.heal, displayHp(maxHpOf(p) - p.hp)) })
          : t('bag.canEvolve')
        : t(`bag.${check.reason}`);
      return {
        testid: `use-${id}-${index}`,
        name: nameOf(p),
        level: t('party.level', { level: p.level }),
        sprite: spriteUrl(p.speciesId),
        hp: p.hp,
        maxHp: maxHpOf(p),
        note,
        ok: check.ok,
        onUse: () => useFromBag(id, index),
      };
    };
    renderBag(overlayRoot, {
      title: t('bag.title'),
      money: t('city.money', { money: s.money }),
      pockets: contents.map(pocket => ({
        label: t(`bag.pocket.${pocket.pocket}`),
        testid: `pocket-${pocket.pocket}`,
        items: pocket.items.map(({ id, count }) => ({
          id,
          name: itemName(id),
          count: `×${count}`,
          image: itemUrl(id),
          text: t(`item.${id}.text` as MessageKey),
          usedElsewhere: usableFromBag(id) ? null : t(ELSEWHERE[pocket.pocket] ?? 'bag.ballsUse'),
          targets: usableFromBag(id) ? s.party.map((p, i) => target(id, p, i)) : [],
        })),
      })),
      empty: t('bag.empty'),
      useOn: t('bag.useOn'),
      start: start ?? null,
      back: { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: [{ pad: 'a', key: 'Enter', label: t('bag.use') }, hints.back],
    });
  }

  /** Uses an item from the bag on a party Pokémon: a potion heals it; a stone or the Link Cable evolves it. */
  function useFromBag(id: ItemId, index: number) {
    if (!save) return;
    const p = save.party[index];
    if (!p || !checkUse(id, p, regionNow().lastSpecies).ok) return;
    const item = ITEMS[id];
    if (item.kind === 'potion') {
      const healed = usePotion(p, id);
      update(current => ({ ...current, bag: removeItem(current.bag, id), party: current.party.map((q, i) => (i === index ? healed : q)) }));
      audio.play('levelUp');
      showBag(id);
      toast(t('bag.healed', { name: nameOf(p), hp: displayHp(healed.hp - p.hp) }));
      return;
    }
    const to = itemEvolution(p, id as EvolutionItemId)!.to;
    preloadSprites([to]);
    const evolved = evolve(p, to).pokemon;
    update(current => ({
      ...current,
      bag: removeItem(current.bag, id),
      party: current.party.map((q, i) => (i === index ? evolve(q, to).pokemon : q)),
      dex: register(current, [], [to]),
    }));
    playEvolution(p, evolved, () => showBag(id));
  }

  // ── The Pokédex ───────────────────────────────────────────────────────────────────────────────────────────────
  /** The Pokédex's filters (kept while the game runs, so going back to the list keeps them). */
  let dexFilter: DexFilter = NO_FILTER;
  const dexNumber = (id: number) => `#${String(id).padStart(3, '0')}`;
  /** One decimal, written the language's way (1.3 / 1,3). */
  const decimal = (n: number) => n.toLocaleString(language() === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  /** The species in the list, with the filters on ("Owned", as in the games' Pokédex: caught at some point). */
  const dexList = (s: Save) => filterDex(dexNumbers(regionNow().lastSpecies), dexFilter, id => s.dex.caught.includes(id));

  function showPokedex(focusId?: number) {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    indoors('#e04a40');
    const ids = dexList(s);
    const status = (id: number) => dexStatus(s.dex, id);
    const setFilter = (change: Partial<DexFilter>, focus?: number) => {
      dexFilter = { ...dexFilter, ...change };
      showPokedex(focus);
    };
    const rangeLabel = ([a, b]: readonly [number, number]) => `${dexNumber(a)}–${dexNumber(b)}`;
    const typeName = (type: string) => t(`type.${type}` as MessageKey);
    // Back from a species' page: on that species. Opened from the city: on the first filter (Owned), at the top, so
    // the filters are right there instead of a few rows above some species.
    const start = focusId ?? null;
    renderDexList(overlayRoot, {
      title: t('dex.title'),
      counts: t('dex.counts', { seen: s.dex.seen.length, caught: s.dex.caught.length, total: dexNumbers(regionNow().lastSpecies).length }),
      filters: [
        { kind: 'toggle', label: t('dex.filterOwned'), testid: 'filter-owned', on: dexFilter.owned, onToggle: () => setFilter({ owned: !dexFilter.owned }) },
        {
          kind: 'choice',
          label: t('dex.filterType'),
          value: dexFilter.type ? typeName(dexFilter.type) : t('dex.all'),
          testid: 'filter-type',
          active: dexFilter.type !== null,
          title: t('dex.filterType'),
          choices: [
            { label: t('dex.all'), testid: 'type-all', selected: dexFilter.type === null, onPick: () => setFilter({ type: null }) },
            ...dexTypes(regionNow().lastSpecies)
              .map(type => ({ type, label: typeName(type) }))
              .sort((a, b) => a.label.localeCompare(b.label, language()))
              .map(({ type, label }) => ({ label, testid: `type-${type}`, selected: dexFilter.type === type, onPick: () => setFilter({ type }) })),
          ],
        },
        { kind: 'toggle', label: t('dex.filterLegendary'), testid: 'filter-legendary', on: dexFilter.legendary, onToggle: () => setFilter({ legendary: !dexFilter.legendary }) },
        { kind: 'toggle', label: t('dex.filterMythical'), testid: 'filter-mythical', on: dexFilter.mythical, onToggle: () => setFilter({ mythical: !dexFilter.mythical }) },
        {
          kind: 'choice',
          label: t('dex.filterNumber'),
          value: dexFilter.range ? rangeLabel(dexFilter.range) : t('dex.all'),
          testid: 'filter-range',
          active: dexFilter.range !== null,
          title: t('dex.filterNumber'),
          choices: [
            { label: t('dex.all'), testid: 'range-all', selected: dexFilter.range === null, onPick: () => setFilter({ range: null }) },
            ...dexRanges(regionNow().lastSpecies).map((range, i) => ({
              label: rangeLabel(range),
              testid: `range-${i}`,
              selected: dexFilter.range?.[0] === range[0],
              // Jump to the start of the range.
              onPick: () => setFilter({ range }, range[0]),
            })),
          ],
        },
      ],
      clear: isFiltered(dexFilter) ? { label: t('dex.clear'), testid: 'filter-clear', onClick: () => setFilter(NO_FILTER, start ?? undefined) } : null,
      shown: t('dex.shown', { count: ids.length }),
      empty: t('dex.empty'),
      tiles: ids.map(id => ({
        id,
        number: dexNumber(id),
        name: status(id) === 'unseen' ? t('dex.unknown') : species(id).name,
        sprite: spriteUrl(id),
        status: status(id),
      })),
      start,
      onOpen: id => showDexEntry(id),
      cancel: t('party.cancel'),
      back: { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: [{ pad: 'a', key: 'Enter', label: t('dex.open') }, hints.back],
    });
  }

  /** A species' page (from the list; LB / RB walk through the list as it is filtered). */
  function showDexEntry(id: number) {
    if (!save) return;
    const s = save;
    const list = dexList(s);
    const at = list.indexOf(id);
    const status = (n: number) => dexStatus(s.dex, n);
    const st = status(id);
    const sp = species(id);
    const known = st !== 'unseen';
    const caught = st === 'caught';
    const owned = ownedCount(s, id);
    const text = dexText(id, language());
    const evolveText = (by: EvolveBy) => (by.kind === 'level' ? t('dex.level', { level: by.level }) : itemName(by.item));
    const placeName = (f: FoundAt) => t(f.where === 'safari' ? 'place.safari' : (`place.${f.where}` as MessageKey));
    const stats = sp.stats;
    const neighbour = (n: number | undefined, key: 'dex.previous' | 'dex.next', testid: string) =>
      n === undefined ? null : { label: t(key, { number: dexNumber(n) }), testid, onClick: () => showDexEntry(n) };
    renderDexEntry(overlayRoot, {
      page: {
        id,
        number: dexNumber(id),
        name: known ? sp.name : t('dex.unknown'),
        sprite: spriteUrl(id),
        status: st,
        statusText: caught ? (owned > 0 ? t('dex.caughtOwned', { count: owned }) : t('dex.caughtNone')) : t(known ? 'dex.seen' : 'dex.unseen'),
        color: known ? typeColor(sp.types[0]) : '#5d6385',
        genus: known ? text.genus : null,
        types: known ? sp.types.map(type => ({ type, label: t(`type.${type}` as MessageKey) })) : [],
        legend: known && sp.legendary ? t('dex.legendary') : known && sp.mythical ? t('dex.mythical') : null,
        size: caught ? t('dex.size', { height: decimal(sp.dex.heightM), weight: decimal(sp.dex.weightKg) }) : null,
        entry: caught ? text.entry : null,
        chain: known
          ? evolutionChain(id).map(stage =>
              stage.map(mon => ({
                sprite: spriteUrl(mon.speciesId),
                name: status(mon.speciesId) === 'unseen' ? t('dex.unknown') : species(mon.speciesId).name,
                known: status(mon.speciesId) !== 'unseen',
                how: mon.by ? evolveText(mon.by) : null,
                current: mon.speciesId === id,
              })),
            )
          : [],
        where: known
          ? whereToFind(id, regionNow()).map(f => {
              const params = { city: t(cityKey(f.cityId)), place: placeName(f), min: f.minLevel, max: f.maxLevel };
              return f.rod ? t('dex.whereRod', { ...params, rod: itemName(f.rod) }) : t('dex.where', params);
            })
          : [],
        stats: caught
          ? (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(stat => ({ label: t(`stat.${stat}`), value: stats[stat] }))
          : null,
        catchRate: caught ? t('dex.catchRate', { rate: sp.captureRate }) : null,
      },
      labels: {
        entry: t('dex.entry'),
        family: t('dex.family'),
        where: t('dex.whereTitle'),
        stats: t('dex.stats'),
        nowhere: t('dex.nowhere'),
        unknown: t('dex.unknownText'),
      },
      previous: at > 0 ? neighbour(list[at - 1], 'dex.previous', 'dex-previous') : null,
      next: at >= 0 && at < list.length - 1 ? neighbour(list[at + 1], 'dex.next', 'dex-next') : null,
      back: { label: t('dex.backToList'), testid: 'back', onClick: () => showPokedex(id) },
      hints: [
        { pad: 'lb', key: 'Q', label: t('dex.previousHint') },
        { pad: 'rb', key: 'E', label: t('dex.nextHint') },
        { pad: 'b', key: 'Esc', label: t('dex.backToList') },
      ],
    });
  }

  /** Options: sound, language, keys. `from` is where Back goes; `waiting` is the action waiting for a new key. */
  function showOptions(from: () => void, waiting: Action | null = null, notice: MessageKey | null = null) {
    scene = 'menu';
    show();
    const pads: { pad: Pad; label: MessageKey }[] = [
      { pad: 'a', label: 'action.up' },
      { pad: 'x', label: 'action.physical' },
      { pad: 'y', label: 'action.special' },
      { pad: 'b', label: 'action.big' },
      { pad: 'rb', label: 'action.guard' },
      { pad: 'lb', label: 'action.dash' },
      { pad: 'view', label: 'action.switch' },
    ];
    renderOptions(overlayRoot, {
      title: t('options.title'),
      info: t(waiting ? 'controls.waiting' : (notice ?? 'controls.info')),
      motion: t('motion.info'),
      sound: { label: t('options.sound'), value: t(settings.muted ? 'options.off' : 'options.on'), on: !settings.muted, onClick: () => {
        applySettings({ ...settings, muted: !settings.muted });
        showOptions(from);
      } },
      volumes: {
        label: t('options.volume'),
        rows: VOLUME_KINDS.map(kind => ({
          kind,
          label: t(`options.volume.${kind}`),
          level: settings.volumes[kind],
          max: MAX_VOLUME,
          downLabel: t('options.quieter'),
          upLabel: t('options.louder'),
          onStep: (by: number) => {
            applySettings({ ...settings, volumes: stepVolume(settings.volumes, kind, by) });
            // A taste of the new level.
            if (kind === 'sounds') audio.play('select');
            if (kind === 'cries' && save?.party[0]) audio.cry(save.party[0].speciesId);
            showOptions(from);
          },
        })),
      },
      language: {
        label: t('party.language'),
        options: LANGUAGES.map(l => ({
          value: l,
          label: LANGUAGE_NAMES[l],
          selected: l === language(),
          onClick: () => {
            chooseLanguage(l);
            showOptions(from);
          },
        })),
      },
      keyboard: {
        label: t('options.keyboard'),
        rows: ACTIONS.map(action => ({
          action,
          label: t(`action.${action}` as MessageKey),
          key: keyLabel(settings.keys[action]),
          waiting: waiting === action,
          changeLabel: t('controls.change'),
          onChange: () => waitForKey(from, action),
        })),
        reset: {
          label: t('controls.reset'),
          testid: 'controls-reset',
          onClick: () => {
            applySettings({ ...settings, keys: DEFAULT_KEYS });
            showOptions(from);
          },
        },
      },
      pad: { label: t('options.controller'), rows: pads.map(p => ({ pad: p.pad, label: t(p.label) })), move: t('options.padMove') },
      back: { label: t('menu.back'), testid: 'back', onClick: from },
      hints: [hints.select, hints.back],
    });
  }

  function waitForKey(from: () => void, action: Action) {
    showOptions(from, action);
    // Before the game's own key handling, so the key only rebinds.
    const listener = (event: KeyboardEvent) => {
      window.removeEventListener('keydown', listener, true);
      // The player left the screen without pressing a key.
      if (!overlayRoot.querySelector('[data-testid="options"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') return showOptions(from);
      const next = rebind(settings.keys, action, event.code);
      if (!next) return showOptions(from, null, 'controls.reserved');
      applySettings({ ...settings, keys: next });
      showOptions(from);
    };
    window.addEventListener('keydown', listener, true);
  }

  /** An indoor screen: the city's picture, blurred, in the room's color. */
  const indoors = (color: string) => {
    const location = save?.location ?? 'pallet';
    backdrop.set({ image: placeArt(location).backdrop, town: location, theme: color, mode: 'interior' });
  };

  function showCenter(message: MessageKey | null) {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    indoors('#ff7fb0');
    renderCenter(overlayRoot, {
      title: t('place.center'),
      nurseName: t('center.nurse'),
      nurse: trainerUrl(PEOPLE.nurse),
      helper: spriteUrl(CHANSEY),
      message: t(message ?? 'center.welcome'),
      healed: message === 'center.healed',
      partyLabel: t('center.party'),
      party: s.party.map(p => ({
        name: nameOf(p),
        sprite: spriteUrl(p.speciesId),
        level: t('party.level', { level: p.level }),
        hp: p.hp,
        maxHp: maxHpOf(p),
        hpText: t('party.hp', { hp: displayHp(p.hp), max: displayHp(maxHpOf(p)) }),
      })),
      heal: {
        label: t('center.heal'),
        testid: 'center-heal',
        icon: 'heal',
        onClick: () => {
          update(current => ({ ...current, party: current.party.map(heal) }));
          audio.play('levelUp');
          showCenter('center.healed');
        },
      },
      back: { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: [hints.select, hints.back],
    });
  }

  function showShop(message: string | null, bought: ItemId | null = null) {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    indoors('#4f8dff');
    const here = city(s.location);
    renderMart(overlayRoot, {
      title: t(here.id === 'saffron' ? 'place.mall' : 'place.shop'),
      clerkName: t('shop.clerk'),
      clerk: trainerUrl(PEOPLE.clerk),
      message: message ?? t('shop.welcome'),
      money: t('city.money', { money: s.money }),
      focus: bought,
      items: (here.shop ?? []).map(id => {
        const item = ITEMS[id];
        const owned = countOf(s.bag, id);
        return {
          id,
          name: itemName(id),
          price: t('shop.price', { price: item.price }),
          owned: t('shop.owned', { count: owned }),
          sprite: itemUrl(id === 'link-cable' ? 'linking-cord' : id),
          description: t(`item.${id}.text` as MessageKey),
          soldOut: item.kind === 'rod' && owned > 0 ? t('shop.ownedRod') : null,
          onBuy: () => {
            const result = buy(s.money, s.bag, id);
            if (!result.ok) return showShop(t('shop.noMoney'), id);
            update(current => ({ ...current, money: result.money, bag: result.bag }));
            showShop(t('shop.bought', { item: itemName(id) }), id);
          },
        };
      }),
      back: { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: [{ pad: 'a', key: 'Enter', label: t('shop.buyHint') }, hints.back],
    });
  }

  /** The Pokémon picked up in the box (A), until it is put down. */
  let boxHeld: Spot | null = null;

  function openBox() {
    boxHeld = null;
    showBox();
  }

  function showBox() {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    indoors('#2fc4b2');
    if (boxHeld && !s[boxHeld.where][boxHeld.index]) boxHeld = null;
    const held = boxHeld;
    const redraw = (change: (current: Save) => Partial<Save>) => {
      update(current => ({ ...current, ...change(current) }));
      showBox();
    };
    const releaser = (where: Place, index: number) =>
      canRelease(s, where)
        ? () => {
            const name = nameOf(s[where][index]);
            boxHeld = null;
            update(current => ({ ...current, ...release(current, where, index) }));
            audio.play('ballOpen');
            showBox();
            toast(t('box.released', { name }));
          }
        : null;
    /** A on a Pokémon: pick it up; holding one, put it here (they swap) or back (itself). */
    const pick = (spot: Spot) => () => {
      if (!held) {
        boxHeld = spot;
        audio.play('select');
        showBox();
        return;
      }
      boxHeld = null;
      if (held.where !== spot.where || held.index !== spot.index) {
        audio.play('ballOpen');
        redraw(current => place(current, held, spot));
      } else showBox();
    };
    const send = (spot: Spot): BoxMon['send'] =>
      spot.where === 'party'
        ? { label: t('box.toBox'), blocked: canSendToBox(s) ? null : t('box.keepOne'), onSend: () => ((boxHeld = null), redraw(current => sendToBox(current, spot.index))) }
        : { label: t('box.toParty'), blocked: canTakeFromBox(s) ? null : t('box.partyFull'), onSend: () => ((boxHeld = null), redraw(current => takeFromBox(current, spot.index))) };
    const mon = (p: Pokemon, spot: Spot): BoxMon => ({
      name: nameOf(p),
      level: t('party.level', { level: p.level }),
      sprite: spriteUrl(p.speciesId),
      hp: p.hp,
      maxHp: maxHpOf(p),
      types: species(p.speciesId).types.map(type => ({ type, label: t(`type.${type}` as MessageKey) })),
      held: held?.where === spot.where && held.index === spot.index,
      onPick: pick(spot),
      send: send(spot),
      onRelease: releaser(spot.where, spot.index),
    });
    /** The empty place after a list, if the held Pokémon can move there (not where it already is at the end). */
    const dropAt = (where: Place) => {
      const end = { where, index: s[where].length };
      if (!held || (held.where === where && held.index === end.index - 1) || !canPlace(s, held, end)) return null;
      return () => {
        boxHeld = null;
        audio.play('ballOpen');
        redraw(current => place(current, held, end));
      };
    };
    renderBox(overlayRoot, {
      title: t('place.box'),
      partyLabel: t('box.party', { count: s.party.length }),
      boxLabel: t('box.box', { count: s.box.length }),
      empty: t('box.empty'),
      party: s.party.map((p, i) => mon(p, { where: 'party', index: i })),
      box: s.box.map((p, i) => mon(p, { where: 'box', index: i })),
      holding: held ? { text: t('box.holding', { name: nameOf(s[held.where][held.index]) }), toParty: dropAt('party'), toBox: dropAt('box'), drop: t('box.moveHere') } : null,
      release: {
        label: t('box.release'),
        ask: m => t('box.releaseAsk', { name: m.name, level: m.level }),
        yes: t('box.releaseYes'),
        no: t('box.releaseNo'),
        blocked: t('box.releaseLast'),
      },
      // Holding a Pokémon, B puts it back instead of leaving.
      back: held
        ? { label: t('party.cancel'), testid: 'back', onClick: () => ((boxHeld = null), showBox()) }
        : { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: held
        ? [{ pad: 'a', key: 'Enter', label: t('box.putHint') }, { pad: 'y', key: 'S', label: t('box.sendHint') }, { pad: 'b', key: 'Esc', label: t('party.cancel') }]
        : [{ pad: 'a', key: 'Enter', label: t('box.pickHint') }, { pad: 'y', key: 'S', label: t('box.sendHint') }, { pad: 'x', key: 'Del', label: t('box.release') }, hints.back],
    });
  }

  /** The world map. Badges (milestone 8) open the cities further on. */
  function showMap() {
    if (!save) return;
    const s = save;
    const badges = s.badges.length;
    scene = 'menu';
    show();
    backdrop.set({ image: 'beach', theme: '#4fa3ff', mode: 'interior' });
    renderMap(overlayRoot, {
      title: t(`region.${regionNow().id}`),
      region: regionNow(),
      routes: regionNow().map.routes,
      cities: [...regionNow().cities, city(regionNow().sanctuary.id)].map(c => {
        const here = c.id === s.location;
        const holy = isSanctuary(c.id);
        const open = holy ? s.champion : isUnlocked(c, badges);
        const g = gymIn(c.id);
        return {
          id: c.id,
          name: t(cityKey(c.id)),
          tagline: t(`city.${c.id}.tagline` as MessageKey),
          ...regionNow().map.places[c.id],
          here,
          open,
          status: here ? t('map.here') : open ? t('map.open') : holy ? t('map.sanctuaryLocked') : t('map.locked', { badges: c.badges }),
          gym: g
            ? {
                label: t('place.gym'),
                leader: g.leader,
                sprite: trainerUrl(g.sprite),
                type: g.type,
                typeLabel: t(`type.${g.type}` as MessageKey),
                beaten: s.badges.includes(g.badge),
              }
            : null,
          onGo: () => {
            update(current => ({ ...current, location: c.id }));
            goCity();
          },
        };
      }),
      // Select (View) / Tab opened the map from the city, and closes it again.
      back: { label: t('menu.back'), testid: 'back', pad: 'view', key: 'Tab', onClick: goCity },
      hints: [{ pad: 'a', key: 'Enter', label: t('map.go') }, hints.back],
    });
  }

  // ── Fights ────────────────────────────────────────────────────────────────────────────────────────────────────
  // `?opponent=stand` (or jump, attack, guard, special, cpu-easy, cpu-hard…) replaces the CPU in every fight but the
  // tutorial: the browser tests use it to choose a predictable opponent.
  const opponentParam = params.get('opponent');
  const opponentFor = (fallback: Opponent): Opponent => (opponentParam && isOpponent(opponentParam) ? opponentParam : fallback);

  interface FightSetup {
    director?: Director;
    intro?: Banner;
    opponent?: Opponent;
    style?: Style;
    /** Who plays the opponent's Pokémon: each gets its own CPU profile (game/ai.ts). */
    cpu?: Controller;
    /** Wild fights: show by the opponent's name whether the player has that species already. */
    showOwned?: boolean;
    roundFrames?: number;
    stage?: StageSpec;
    /** Who stands on the opponent's side (none for a wild Pokémon, which leaps in by itself). */
    rivalLook?: TrainerLook | null;
  }

  /** `?entrance=0` (the browser tests' default) skips the trainers throwing their Poké Balls. */
  const entranceOn = params.get('entrance') !== '0';

  function enterFight(next: FightMode, player: TeamMember[], opponents: TeamMember[], setup: FightSetup = {}) {
    const stage: StageSpec = setup.stage ?? { id: 'stadium', backdrop: 'spl' };
    const trainers: [TrainerLook, TrainerLook | null] = [LOOKS.player, setup.rivalLook === undefined ? LOOKS.trainer : setup.rivalLook];
    backdrop.set({ image: stage.backdrop ?? 'spl', theme: stage.tint ?? '#6c8cff', mode: 'fight' });
    preloadImages([
      ...(stage.backdrop ? [backdropUrl(stage.backdrop)] : []),
      ...trainers.flatMap(look => (look?.sprite ? [trainerUrl(look.sprite)] : [])),
    ]);
    mode = next;
    scene = 'fight';
    modal = 'none';
    results = null;
    hide();
    sandbox = createSandbox({
      player,
      opponentTeam: opponents,
      opponent: opponentFor(setup.opponent ?? 'cpu-normal'),
      // A new seed for every fight: the CPU never plays the same fight twice.
      seed: fightRng.int(2 ** 31),
      // (`?opponent=` in the tests replaces the CPU entirely.)
      profiles: setup.cpu && !opponentParam ? opponents.map(o => cpuProfile(o, setup.cpu!, fightRng)) : undefined,
      // Caught at some point (the Pokédex's caught list, as the games mark it): evolving or releasing it never undoes that.
      owned: setup.showOwned && save ? opponents.map(o => o.speciesId !== null && save!.dex.caught.includes(o.speciesId)) : undefined,
      director: setup.director,
      intro: setup.intro,
      style: setup.style,
      roundFrames: setup.roundFrames,
      entrance: entranceOn,
      stage,
      trainers,
      // The training tools (infinite PP, switching the opponent…) are for the practice demo only, never the journey.
      tools: next === 'demo',
    });
    preloadSprites([...player, ...opponents].map(member => member.speciesId));
    renderer.reset();
    keys.clear();
  }

  /** Before a journey fight: a party with nobody able to fight rests first (it can't happen after a loss, which heals). */
  const readyParty = () => {
    if (save?.party.every(p => p.hp === 0)) update(s => ({ ...s, party: s.party.map(heal) }));
    return save!.party;
  };

  /** Training from the title: the Lv. 30 demo teams, no XP, nothing saved. */
  function startDemo() {
    enterFight('demo', PLAYER_TEAM, OPPONENT_TEAM, { stage: { id: 'stadium', backdrop: 'spl' } });
  }

  /** The battle field: a trainer with three of this city's Pokémon at your party's level (XP and prize money). */
  function startTrainer() {
    if (!save) return;
    const party = readyParty();
    const opponents = trainingOpponents(regionNow(), city(save.location), party, rng);
    wild = null;
    gym = null;
    update(s => ({ ...s, dex: register(s, opponents.map(p => p.speciesId)) }));
    enterFight('trainer', party.map(toFighter), opponents.map(toFighter), {
      cpu: { kind: 'trainer', difficulty: 'normal' },
      stage: { id: 'stadium', backdrop: placeArt(save.location).backdrop },
      rivalLook: { ...LOOKS.trainer, sprite: trainerClassFor(opponents.map(p => p.speciesId)) },
      intro: { step: null, key: 'trainer.challenge', params: {} },
    });
  }

  /** Where a hunt happens: the grass (Viridian Forest's trees around Pewter), a cave, or the sea. */
  const huntStage = (location: string, kind: HuntKind): StageSpec =>
    kind === 'cave'
      ? { id: 'cave', backdrop: HUNT_BACKDROPS.cave }
      : kind === 'water'
        ? { id: 'sea', backdrop: location === 'cerulean' ? 'river' : HUNT_BACKDROPS.water }
        : location === 'pewter'
          ? { id: 'forest', backdrop: HUNT_BACKDROPS.forest }
          : { id: 'route', backdrop: HUNT_BACKDROPS.grass };

  /** Hunting: a wild Pokémon from this city's grass, cave or water (fishing with the best rod). */
  /** The last hunting ground (for "Hunt again" on the results screen). */
  let lastHunt: HuntKind | null = null;
  const huntAgain = () => {
    closeModal();
    if (lastHunt) startHunt(lastHunt);
  };

  function startHunt(kind: HuntKind) {
    if (!save) return;
    lastHunt = kind;
    const s = save;
    const here = city(s.location);
    const table = huntTable(here, encounterTable(here, kind, kind === 'water' ? ownsRod(s) : null), s.dex.caught);
    if (table.length === 0) return;
    const party = readyParty();
    wild = wildPokemon(rollEncounter(table, rng), rng);
    gym = null;
    const found = wild;
    update(current => ({ ...current, dex: register(current, [found.speciesId]) }));
    enterFight('wild', party.map(toFighter), [toFighter(found)], {
      opponent: 'cpu-easy',
      cpu: { kind: 'wild' },
      showOwned: true,
      stage: huntStage(s.location, kind),
      rivalLook: null,
      intro: { step: null, key: 'wild.appeared', params: { name: nameOf(found) } },
    });
  }

  /** A gym: the leader's words, then their whole team, one Pokémon at a time, with a CPU style that suits the type. */
  function startGym(g: Gym) {
    if (!save || !canChallenge(g, save.badges)) return;
    backdrop.set({ image: typeBackdrop(g.type), theme: typeColor(g.type), mode: 'scene' });
    tell([{ speaker: g.leader, portrait: g.sprite, key: `leader.${g.badge}.intro` as MessageKey, params: {} }], () => {
      const party = readyParty();
      const team = gymTeam(g);
      gym = g;
      wild = null;
      update(s => ({ ...s, dex: register(s, team.map(p => p.speciesId)) }));
      enterFight('gym', party.map(toFighter), team.map(toFighter), {
        opponent: `cpu-${g.ai.difficulty}`,
        style: g.ai.style,
        cpu: { kind: 'trainer', ...g.ai },
        stage: { id: 'gym', tint: typeColor(g.type), backdrop: typeBackdrop(g.type) },
        rivalLook: leaderLook(typeColor(g.type), false, g.sprite),
        intro: { step: null, key: 'gym.challenge', params: { leader: g.leader } },
      });
    });
  }

  /** The Safari Zone: pay, get 30 Safari Balls, and meet its Pokémon until the balls run out or you leave. */
  function enterSafari() {
    if (!save || save.money < SAFARI_ENTRANCE) return;
    update(s => ({ ...s, money: s.money - SAFARI_ENTRANCE }));
    safari = { balls: SAFARI_BALLS };
    showSafari();
  }

  function showSafari() {
    if (!save || !safari) return goCity();
    leaveFight();
    scene = 'menu';
    show();
    const over = safari.balls === 0;
    backdrop.set({ image: HUNT_BACKDROPS.safari, theme: '#8fae3a', mode: 'scene' });
    renderSafari(overlayRoot, {
      title: t('safari.title'),
      info: [t('safari.balls', { count: safari.balls }), t(over ? 'safari.over' : 'safari.rule')],
      ball: itemUrl('safari-ball'),
      balls: safari.balls,
      buttons: [
        ...(over ? [] : [{ label: t('safari.search'), testid: 'safari-search', icon: 'grass' as const, primary: true, onClick: searchSafari }]),
        { label: t('safari.leave'), testid: 'safari-leave', icon: 'exit' as const, back: true, primary: over, onClick: leaveSafari },
      ],
      hints: [hints.select, hints.back],
    });
  }

  function searchSafari() {
    if (!save || !safari) return;
    const here = city(save.location);
    const table = huntTable(here, tableForAreas(here.safari ?? [], 'walk'), save.dex.caught);
    if (table.length === 0) return;
    const found = wildPokemon(rollEncounter(table, rng), rng);
    gym = null;
    update(s => ({ ...s, dex: register(s, [found.speciesId]) }));
    enterFight('safari', save.party.map(toFighter), [toFighter(found)], {
      opponent: 'cpu-easy',
      cpu: { kind: 'wild' },
      showOwned: true,
      roundFrames: SAFARI_SECONDS * 60,
      stage: { id: 'safari', backdrop: HUNT_BACKDROPS.safari },
      rivalLook: null,
      intro: { step: null, key: 'wild.appeared', params: { name: nameOf(found) } },
    });
    wild = found;
  }

  function leaveSafari() {
    safari = null;
    goCity();
  }

  // ── The Pokémon League ────────────────────────────────────────────────────────────────────────────────────────
  const whoIs = (opponent: LeagueOpponent) =>
    opponent.kind === 'elite'
      ? t('league.elite', { name: opponent.name, type: t(`type.${opponent.type}` as MessageKey) })
      : t('league.champion', { name: opponent.name });
  const leagueLine = (opponent: LeagueOpponent, moment: 'intro' | 'beaten'): Said => ({
    speaker: opponent.name,
    portrait: opponent.sprite,
    key: (opponent.id === 'champion' ? `champion.${moment}` : `elite.${opponent.id}.${moment}`) as MessageKey,
    params: { player: save?.player.name ?? '' },
  });

  function startLeague() {
    if (!save || !canEnterLeague(save.badges)) return;
    league = { stage: 0 };
    showLeague();
  }

  /** Between League battles: who's next, the party (potions), or giving up. No Pokémon Center here. */
  function showLeague() {
    if (!save || !league) return goCity();
    leaveFight();
    scene = 'menu';
    show();
    const next = leagueOpponent(regionNow(), league.stage, save.rival);
    const stage = league.stage;
    backdrop.set({ image: 'spl', theme: '#8f7bff', mode: 'scene' });
    const champion = leagueOpponent(regionNow(), LEAGUE_SIZE - 1, save.rival);
    renderLeague(overlayRoot, {
      title: t('league.title'),
      info: [t('league.progress', { n: stage + 1, total: LEAGUE_SIZE }), t('league.next', { who: whoIs(next) }), t('league.hint')],
      seats: [
        ...regionNow().league.eliteFour.map((member, i) => ({
          name: member.name,
          title: t('league.eliteTitle'),
          sprite: trainerUrl(member.sprite),
          type: member.type ? { type: member.type, label: t(`type.${member.type}` as MessageKey) } : null,
          state: i < stage ? ('beaten' as const) : i === stage ? ('next' as const) : ('waiting' as const),
        })),
        {
          name: champion.name,
          title: t('league.championTitle'),
          sprite: trainerUrl(champion.sprite),
          type: champion.type ? { type: champion.type, label: t(`type.${champion.type}` as MessageKey) } : null,
          state: stage === LEAGUE_SIZE - 1 ? ('next' as const) : ('waiting' as const),
        },
      ],
      buttons: [
        { label: t('league.challenge'), testid: 'league-next', icon: 'battle', primary: true, onClick: fightLeague },
        { label: t('place.party'), testid: 'league-party', icon: 'party', pad: 'y', onClick: toggleParty },
        { label: t('league.giveUp'), testid: 'league-leave', icon: 'exit', back: true, onClick: leaveLeague },
      ],
      hints: [hints.select, hints.party, { pad: 'b', key: 'Esc', label: t('league.giveUp') }],
    });
  }

  function fightLeague() {
    if (!save || !league) return;
    const opponent = leagueOpponent(regionNow(), league.stage, save.rival);
    tell([leagueLine(opponent, 'intro')], () => {
      if (!save) return;
      gym = null;
      wild = null;
      update(s => ({ ...s, dex: register(s, opponent.team.map(p => p.speciesId)) }));
      enterFight('league', save.party.map(toFighter), opponent.team.map(toFighter), {
        opponent: `cpu-${opponent.ai.difficulty}`,
        style: opponent.ai.style,
        cpu: { kind: 'trainer', ...opponent.ai },
        stage: { id: 'league', tint: opponent.type ? typeColor(opponent.type) : undefined, backdrop: typeBackdrop(opponent.type) },
        rivalLook:
          opponent.kind === 'champion'
            ? { ...LOOKS.champion, sprite: opponent.sprite }
            : leaderLook(typeColor(opponent.type), true, opponent.sprite),
        intro: { step: null, key: 'league.wants', params: { who: whoIs(opponent) } },
      });
    });
  }

  function leaveLeague() {
    league = null;
    goCity();
  }

  /** The Champion is beaten: the Professor, the Hall of Fame, the credits, and the next region (later). */
  function championEnding() {
    if (!save) return;
    league = null;
    const team = save.party.map(p => ({ speciesId: p.speciesId, level: p.level }));
    update(s => ({
      ...s,
      champion: true,
      champions: s.champions.includes(s.region) ? s.champions : [...s.champions, s.region],
      hallOfFame: [...s.hallOfFame, { at: Date.now(), team, region: s.region }],
    }));
    tell([professor('story.champion', { player: save.player.name })], showHallOfFame);
  }

  function showHallOfFame() {
    if (!save) return;
    scene = 'menu';
    show();
    backdrop.set({ image: 'spl', theme: '#ffcf4a', mode: 'scene' });
    const entry = save.hallOfFame[save.hallOfFame.length - 1];
    renderHallOfFame(overlayRoot, {
      title: t('hof.title'),
      entry: t('hof.entry', { n: save.hallOfFame.length }),
      team: entry.team.map(m => ({ name: species(m.speciesId).name, level: t('party.level', { level: m.level }), sprite: spriteUrl(m.speciesId) })),
      next: { label: t('dialog.next'), testid: 'hof-next', icon: 'arrow', onClick: showCredits },
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
    });
  }

  function showCredits() {
    scene = 'menu';
    show();
    backdrop.set({ image: 'space', theme: '#8f6bff', mode: 'scene' });
    renderPage(overlayRoot, {
      testid: 'credits',
      title: t('credits.title'),
      lines: [t('credits.study'), t('credits.data'), t('credits.art'), t('credits.rights')],
      buttons: [{ label: t('dialog.next'), testid: 'credits-next', icon: 'arrow', primary: true, onClick: showNextRegion }],
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
    });
  }

  /** After the credits: the next region is open now (fly there, or stay), and so is this region's sanctuary. */
  function showNextRegion() {
    if (!save) return;
    scene = 'menu';
    show();
    const here = t(`region.${save.region}`);
    const next = nextRegion(save.region);
    const there = next ? t(`region.${next}`) : '';
    renderPage(overlayRoot, {
      testid: 'next-region',
      title: next ? t('next.title', { region: there }) : t('next.lastTitle'),
      lines: [next ? t('next.text', { region: there }) : t('next.lastText'), t('next.sanctuary', { region: here })],
      buttons: [
        ...(next ? [{ label: t('next.go', { region: there }), testid: 'next-region-go', icon: 'map' as const, primary: true, onClick: () => flyTo(next) }] : []),
        { label: t('next.stay', { region: here }), testid: 'next-region-stay', icon: 'pin', primary: !next, onClick: goCity },
      ],
      hints: [hints.select],
    });
  }

  // ── Travelling between regions ─────────────────────────────────────────────────────────────────────────────────
  /** The plane: every region, what the player has there, and which ones are open. */
  /** Generations in Roman numerals, as the games number them. */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

  function showTravel() {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    backdrop.set({ image: 'space', theme: '#6fb8ff', mode: 'interior' });
    renderTravel(overlayRoot, {
      title: t('travel.title'),
      info: t('travel.info'),
      regions: REGION_IDS.map((id, i) => {
        const exists = hasRegion(id);
        const open = regionOpen(id, s.champions);
        const journey = id === s.region ? s : s.away[id];
        const state = !exists ? 'soon' : id === s.region ? 'here' : !open ? 'locked' : journey ? 'open' : 'new';
        const status =
          state === 'here'
            ? t('travel.here')
            : state === 'open'
              ? t('travel.continue')
              : state === 'new'
                ? t('travel.new')
                : state === 'locked'
                  ? t('travel.locked', { region: t(`region.${REGION_IDS[i - 1]}`) })
                  : t('travel.soon');
        const r = exists ? region(id) : null;
        return {
          id,
          name: t(`region.${id}`),
          map: r ? regionPicture(r, [], []) : null,
          color: r?.color ?? '#5d6385',
          status,
          state,
          onFly: () => flyTo(id),
          generation: t('travel.gen', { n: ROMAN[(r?.generation ?? i + 1) - 1] }),
          species: r ? t('travel.species', { count: r.lastSpecies }) : '',
          legends: r ? r.cover.map(slug => spriteUrl(speciesBySlug(slug).id)) : [],
          journey:
            r && journey
              ? {
                  badgesLabel: t('travel.badges'),
                  badges: r.gyms.map(g => ({ url: badgeArt(g.badge), earned: journey.badges.includes(g.badge) })),
                  dexLabel: t('dex.title'),
                  caught: journey.dex.caught.filter(n => n <= r.lastSpecies).length,
                  total: r.lastSpecies,
                }
              : null,
          partners: r && state === 'new' ? { label: t('travel.partners'), sprites: r.starters.map(spriteUrl) } : null,
        };
      }),
      back: { label: t('menu.back'), testid: 'back', onClick: goCity },
      hints: [hints.select, hints.back],
    });
  }

  /** The flight, then the journey there: it goes on where it was, or a new one starts. */
  function flyTo(to: RegionId) {
    if (!save || !regionOpen(to, save.champions) || to === save.region) return;
    const from = region(save.region);
    scene = 'menu';
    show();
    audio.play('dash');
    renderFlight(overlayRoot, {
      text: t('travel.flying', { region: t(`region.${to}`) }),
      plane: gearPicture('plane'),
      from: from.color,
      to: region(to).color,
      skip: t('dialog.next'),
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
      onArrive: () => arriveIn(to),
    });
  }

  function arriveIn(to: RegionId) {
    if (!save) return;
    if (save.away[to]) {
      save = switchRegion(save, to);
      persist();
      return goCity();
    }
    // A new journey there: its Professor, a starter of its own, a new Pokédex.
    const r = region(to);
    const first = placeArt(r.cities[0].id);
    backdrop.set({ image: first.backdrop, town: r.cities[0].id, theme: first.color, mode: 'scene' });
    preloadSprites([...r.starters]);
    const say = (key: MessageKey, params: Line['params'] = {}): Said => ({ speaker: t('speaker.professor'), portrait: r.people.professor, key, params });
    const player = save.player.name;
    tell([say(`region.${to}.welcome` as MessageKey, { player })], () =>
      tell([say(`region.${to}.choose` as MessageKey, { player })], () =>
        showStarters(r, id => {
          if (!save) return;
          const rivalId = r.rivalPick[id];
          save = startRegion(save, to, { starterId: id, rivalStarterId: rivalId, party: [createStarter(r, id)] });
          persist();
          const gift = r.starterGifts[id] ? move(r.starterGifts[id]) : null;
          tell(
            [
              ...(gift ? [say('story.gift', { pokemon: species(id).name, move: gift.name, type: t(`type.${gift.type}` as MessageKey) })] : []),
              say(`region.${to}.depart` as MessageKey, { player }),
            ],
            goCity,
          );
        }),
      ),
    );
  }

  // ── The Legendary Sanctuary ────────────────────────────────────────────────────────────────────────────────────
  /** A legendary battle: the whole party against one legendary with four times the HP and its own attacks. */
  function startLegendary(l: Legendary) {
    if (!save) return;
    const party = readyParty();
    const boss = legendaryPokemon(l);
    wild = boss;
    gym = null;
    lastHunt = null;
    update(s => ({ ...s, dex: register(s, [boss.speciesId]) }));
    enterFight('legendary', party.map(toFighter), [legendaryFighter(l)], {
      opponent: 'cpu-hard',
      cpu: { kind: 'trainer', difficulty: 'hard' },
      stage: { id: 'league', backdrop: l.backdrop },
      rivalLook: null,
      intro: { step: null, key: 'legend.appeared', params: { name: nameOf(boss) } },
    });
  }

  /** Esc during a fight: back to where it was started from (running away; not in the tutorial or the League). */
  function leaveCurrentFight() {
    if (scene !== 'fight' || modal !== 'none' || mode === 'tutorial' || mode === 'league') return;
    if (mode === 'demo') goTitle();
    else if (mode === 'safari') showSafari();
    else goCity();
  }

  // ── Results ───────────────────────────────────────────────────────────────────────────────────────────────────
  const lineFor = (line: ReportLine, party: Pokemon[]): Line => {
    const name = nameOf(party[line.index]);
    if (line.kind === 'xp') return { key: 'results.xp', params: { name, xp: line.amount } };
    if (line.kind === 'level') return { key: 'results.level', params: { name, level: line.level } };
    return { key: 'results.move', params: { name, move: move(line.move).name } };
  };

  /** The XP cards on the results screen. */
  const xpCards = (gains: readonly XpGain[], party: readonly Pokemon[]): XpCard[] =>
    gains.map(gain => ({
      name: nameOf(party[gain.index]),
      sprite: spriteUrl(party[gain.index].speciesId),
      amount: t('results.gain', { xp: gain.amount }),
      levelFrom: t('party.level', { level: gain.levelFrom }),
      levelTo: gain.levelTo > gain.levelFrom ? t('party.level', { level: gain.levelTo }) : null,
      from: gain.progressFrom,
      to: gain.progressTo,
      moves: gain.moves.map(slug => t('results.learned', { move: move(slug).name })),
    }));

  /** Which icon a report line gets (by its text). */
  const reportKind = (key: MessageKey): ReportKind => {
    if (key === 'results.xp') return 'xp';
    if (key === 'results.level') return 'level';
    if (key === 'results.move' || key === 'evolution.move') return 'move';
    if (key === 'results.prize' || key === 'results.whiteout') return 'money';
    if (key === 'gym.badgeEarned') return 'badge';
    if (key === 'capture.caught' || key === 'capture.toBox' || key === 'capture.shakes') return 'ball';
    if (key === 'capture.fled' || key === 'capture.letGone') return 'fled';
    if (key === 'results.evolved') return 'evolve';
    return 'info';
  };

  function showResults() {
    if (!results) return;
    const state = results;
    const s = save;
    const title = t(state.outcome === 'win' ? 'results.win' : state.outcome === 'loss' ? 'results.loss' : 'results.draw');
    const ON_CARDS = new Set<MessageKey>(['results.xp', 'results.level', 'results.move']);
    const rest = state.xp.length ? state.lines.filter(l => !ON_CARDS.has(l.key)) : state.lines;
    const lines = rest.length
      ? rest.map(l => ({
          text: t(l.key, l.params),
          kind: reportKind(l.key),
          image: l.key === 'gym.badgeEarned' && gym ? badgeArt(gym.badge) : undefined,
        }))
      : state.xp.length
        ? []
        : [{ text: t('results.noXp'), kind: 'info' as const }];
    const base = { title, outcome: state.outcome, lines, xp: state.xp, levelUp: t('results.levelUp') };

    if (state.capture && s) {
      const target = state.capture.pokemon;
      // In the Safari Zone only Safari Balls can be thrown; elsewhere, the bag's balls.
      const ballsLeft = (ball: BallId) => (ball === 'safari-ball' ? (safari?.balls ?? 0) : countOf(s.bag, ball));
      // A legendary takes a Master Ball, and nothing else can even be tried.
      const legendary = state.capture.legendary === true;
      const balls = (mode === 'safari' ? (['safari-ball'] as BallId[]) : BALLS.filter(ball => ballsLeft(ball) > 0)).filter(ball => canThrowAt(ball, legendary));
      const prompt = !legendary ? t('capture.prompt', { name: nameOf(target) }) : balls.length ? t('legend.capturePrompt', { name: nameOf(target) }) : t('legend.needMaster', { name: nameOf(target) });
      renderResults(overlayRoot, {
        ...base,
        prompt: { text: prompt, sprite: spriteUrl(target.speciesId), evolving: false },
        buttons: [
          ...balls.map((ball, i) => ({
            label: t('capture.throw', { ball: itemName(ball), count: ballsLeft(ball) }),
            testid: `throw-${ball}`,
            image: itemUrl(ball),
            primary: i === 0,
            onClick: () => throwAt(ball),
          })),
          { label: t('capture.letGo'), testid: 'let-go', back: true, primary: false, onClick: letGo },
        ],
        hints: [{ pad: 'a', key: 'Enter', label: t('capture.throwHint') }, { pad: 'b', key: 'Esc', label: t('capture.letGo') }],
      });
      return;
    }

    const next = state.evolutions[0];
    if (next && s) {
      // The evolved form's sprite starts loading now, so it's ready when the next battle starts.
      preloadSprites([next.to]);
      renderResults(overlayRoot, {
        ...base,
        prompt: { text: t('results.evolving', { name: nameOf(s.party[next.index]) }), sprite: spriteUrl(s.party[next.index].speciesId), evolving: true },
        buttons: [
          { label: t('results.evolve'), testid: 'evolve', icon: 'star', primary: true, onClick: () => decideEvolution(true) },
          { label: t('results.stop'), testid: 'stop-evolution', back: true, primary: false, onClick: () => decideEvolution(false) },
        ],
        hints: [{ pad: 'a', key: 'Enter', label: t('results.evolve') }, { pad: 'b', key: 'Esc', label: t('results.stop') }],
      });
      return;
    }
    const again = state.again;
    renderResults(overlayRoot, {
      ...base,
      prompt: null,
      buttons: again
        ? [
            { label: t('results.huntAgain'), testid: 'hunt-again', icon: 'grass', primary: true, onClick: again },
            { label: t(mode === 'safari' ? 'results.toSafari' : 'results.toCity'), testid: 'continue', icon: 'arrow', primary: false, back: true, onClick: state.onContinue },
          ]
        : [{ label: t('results.continue'), testid: 'continue', icon: 'arrow', primary: true, onClick: state.onContinue }],
      hints: again
        ? [{ pad: 'a', key: 'Enter', label: t('results.huntAgain') }, { pad: 'b', key: 'Esc', label: t(mode === 'safari' ? 'results.toSafari' : 'results.toCity') }]
        : [{ pad: 'a', key: 'Enter', label: t('results.continue') }],
    });
  }

  function throwAt(ball: BallId) {
    if (!results?.capture || !save) return;
    const { pokemon, playerLevel } = results.capture;
    const x = catchValue({
      catchRate: species(pokemon.speciesId).captureRate,
      ball: ITEMS[ball].kind === 'ball' ? ITEMS[ball].bonus : 1,
      wildLevel: pokemon.level,
      playerLevel,
      badges: save.badges.length,
    });
    const thrown = throwBall(x, rng);
    if (ball === 'safari-ball' && safari) safari.balls--;
    else update(s => ({ ...s, bag: removeItem(s.bag, ball) }));
    const name = nameOf(pokemon);
    if (thrown.caught) {
      // A caught Pokémon arrives rested (it was knocked out in the battle).
      const team = addCaught(save, heal(pokemon));
      update(s => ({ ...s, party: team.party, box: team.box, dex: register(s, [], [pokemon.speciesId]) }));
      results.lines.push({ key: 'capture.caught', params: { name } });
      if (team.where === 'box') results.lines.push({ key: 'capture.toBox', params: { name } });
    } else {
      results.lines.push({ key: 'capture.shakes', params: { shakes: thrown.shakes } });
      results.lines.push({ key: 'capture.fled', params: { name } });
    }
    results.capture = null;
    // The throw itself, with its suspense; then the results.
    renderCapture(overlayRoot, {
      sprite: spriteUrl(pokemon.speciesId),
      ball: itemUrl(ball),
      shakes: thrown.shakes,
      caught: thrown.caught,
      start: t('capture.thrown', { ball: itemName(ball) }),
      end: thrown.caught ? t('capture.caught', { name }) : t(ESCAPE_TEXT[Math.min(3, thrown.shakes)], { name }),
      next: t('dialog.next'),
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
      onMoment: moment => audio.play(CAPTURE_SOUND[moment]),
      onDone: showResults,
    });
  }

  function letGo() {
    if (!results?.capture) return;
    results.lines.push({ key: 'capture.letGone', params: { name: nameOf(results.capture.pokemon) } });
    results.capture = null;
    showResults();
  }

  function decideEvolution(accept: boolean) {
    if (!results || !save) return;
    const { index, to } = results.evolutions.shift()!;
    const before = save.party[index];
    if (accept) {
      const evolved = evolve(before, to);
      update(s => ({ ...s, party: s.party.map((p, i) => (i === index ? evolved.pokemon : p)), dex: register(s, [], [to]) }));
      results.lines.push({ key: 'results.evolved', params: { name: nameOf(before), species: nameOf(evolved.pokemon) } });
      for (const m of evolved.moves) results.lines.push({ key: 'evolution.move', params: { name: nameOf(evolved.pokemon), move: move(m).name } });
      return playEvolution(before, evolved.pokemon, showResults);
    }
    results.lines.push({ key: 'results.stopped', params: { name: nameOf(before) } });
    showResults();
  }

  /** The evolution animation (after a battle, or an evolution item from the party), then `then`. */
  function playEvolution(before: Pokemon, after: Pokemon, then: () => void) {
    renderEvolution(overlayRoot, {
      from: spriteUrl(before.speciesId),
      to: spriteUrl(after.speciesId),
      start: t('results.evolving', { name: nameOf(before) }),
      done: t('evolution.done', { name: nameOf(before), species: nameOf(after) }),
      next: t('dialog.next'),
      hints: [{ pad: 'a', key: 'Enter', label: t('dialog.next') }],
      onMoment: moment => audio.play(moment === 'start' ? 'charge' : moment === 'flash' ? 'ballOpen' : 'levelUp'),
      onDone: then,
    });
  }

  function closeModal() {
    modal = 'none';
    results = null;
    hide();
    keys.clear();
  }

  function battleFinished() {
    if (!sandbox) return;
    const battle = sandbox.view().battle;
    const outcome = battle.winner === 0 ? 'win' : battle.winner === 1 ? 'loss' : 'draw';
    const finished = mode;
    const opponent = wild;

    if (finished === 'demo' || !save) {
      results = {
        outcome,
        lines: [{ key: 'results.practice', params: {} }],
        capture: null,
        evolutions: [],
        xp: [],
        onContinue: () => {
          closeModal();
          sandbox?.reset();
        },
      };
    } else if (finished === 'tutorial') {
      // The tutorial only gives XP for a win (losing it is part of the story).
      const { party, report } = afterBattle(save.party, battle, true);
      const won = outcome === 'win';
      if (won) update(s => ({ ...s, party }));
      results = {
        outcome,
        lines: won ? report.lines.map(line => lineFor(line, party)) : [],
        capture: null,
        evolutions: [],
        xp: won ? xpCards(report.gains, party) : [],
        onContinue: () => {
          closeModal();
          endPrologue(outcome);
        },
      };
    } else if (finished === 'league' && league) {
      // HP carries over to the next battle; a win pays and moves on, anything else ends the run.
      const run = league;
      const opponent = leagueOpponent(regionNow(), run.stage, save.rival);
      const { party, report } = afterBattle(save.party, battle, true);
      const lines = report.lines.map(line => lineFor(line, party));
      let next = { ...save, party };
      const won = outcome === 'win';
      if (won) {
        const prize = leaguePrize(opponent.team);
        next = { ...next, money: Math.min(MAX_MONEY, next.money + prize) };
        lines.push({ key: 'results.prize', params: { money: prize } });
      } else {
        const kept = moneyAfterLoss(next.money);
        lines.push({ key: 'results.whiteout', params: { money: next.money - kept } });
        next = { ...next, money: kept, party: next.party.map(heal) };
        league = null;
      }
      save = next;
      persist();
      results = {
        outcome,
        lines,
        capture: null,
        evolutions: won ? report.evolutions : [],
        xp: xpCards(report.gains, party),
        onContinue: () => {
          closeModal();
          if (!won) return goCity();
          tell([leagueLine(opponent, 'beaten')], () => {
            run.stage++;
            if (run.stage >= LEAGUE_SIZE) championEnding();
            else showLeague();
          });
        },
      };
    } else if (finished === 'legendary' && opponent) {
      // Every party Pokémon gets the full XP (times LEGENDARY_XP), fainted or not; a loss is a loss like any other.
      const { party, report } = afterBattle(save.party, battle, true, true);
      const lines = report.lines.map(line => lineFor(line, party));
      let next = { ...save, party };
      if (outcome === 'loss') {
        const kept = moneyAfterLoss(next.money);
        lines.push({ key: 'results.whiteout', params: { money: next.money - kept } });
        next = { ...next, money: kept, party: next.party.map(heal) };
      }
      save = next;
      persist();
      const winner = battle.teams[0][battle.active[0]];
      results = {
        outcome,
        lines,
        capture: outcome === 'win' ? { pokemon: opponent, playerLevel: winner.level, legendary: true } : null,
        evolutions: outcome === 'loss' ? [] : report.evolutions,
        xp: xpCards(report.gains, party),
        onContinue: () => {
          closeModal();
          goCity();
        },
      };
    } else if (finished === 'safari') {
      // Nothing in the Safari Zone hurts for long: the party recovers after every encounter, and losing costs nothing.
      // A Pokémon that isn't knocked out in time flees.
      const { party, report } = afterBattle(save.party, battle, false);
      const lines = report.lines.map(line => lineFor(line, party));
      const fled = outcome !== 'win' || battle.round.timeOver;
      update(s => ({ ...s, party: party.map(heal) }));
      if (fled && opponent) lines.push({ key: 'safari.fled', params: { name: nameOf(opponent) } });
      const winner = battle.teams[0][battle.active[0]];
      results = {
        outcome: fled ? 'draw' : 'win',
        lines,
        capture: !fled && opponent && safari && safari.balls > 0 ? { pokemon: opponent, playerLevel: winner.level } : null,
        evolutions: report.evolutions,
        xp: xpCards(report.gains, party),
        onContinue: () => {
          closeModal();
          showSafari();
        },
        again: () => {
          closeModal();
          if (safari && safari.balls > 0) searchSafari();
          else showSafari();
        },
      };
    } else {
      // Trainers and leaders give 1.5× XP and prize money (leaders also a badge); a wild Pokémon can be caught.
      // Losing costs half the money (and heals).
      const { party, report } = afterBattle(save.party, battle, finished !== 'wild');
      const lines = report.lines.map(line => lineFor(line, party));
      let next = { ...save, party };
      const leader = finished === 'gym' ? gym : null;
      if (outcome === 'win' && (finished === 'trainer' || leader)) {
        const prize = leader ? leaderPrize(leader) : prizeMoney(battle.teams[1].map(m => m.level));
        next = { ...next, money: Math.min(MAX_MONEY, next.money + prize) };
        lines.push({ key: 'results.prize', params: { money: prize } });
      }
      if (outcome === 'win' && leader) {
        next = { ...next, badges: [...next.badges, leader.badge] };
        lines.push({ key: 'gym.badgeEarned', params: { badge: t(`badge.${leader.badge}` as MessageKey) } });
      }
      if (outcome === 'loss') {
        const kept = moneyAfterLoss(next.money);
        lines.push({ key: 'results.whiteout', params: { money: next.money - kept } });
        next = { ...next, money: kept, party: next.party.map(heal) };
      }
      save = next;
      persist();
      const hasBall = BALLS.some(ball => countOf(save!.bag, ball) > 0);
      const winner = battle.teams[0][battle.active[0]];
      results = {
        outcome,
        lines,
        capture: outcome === 'win' && finished === 'wild' && opponent && hasBall ? { pokemon: opponent, playerLevel: winner.level } : null,
        evolutions: outcome === 'loss' ? [] : report.evolutions,
        xp: xpCards(report.gains, party),
        again: finished === 'wild' && lastHunt ? () => huntAgain() : undefined,
        onContinue: () => {
          closeModal();
          if (!leader) return goCity();
          // The leader has the last word.
          const key = (outcome === 'win' ? `leader.${leader.badge}.beaten` : 'gym.lost') as MessageKey;
          tell([{ speaker: leader.leader, portrait: leader.sprite, key, params: {} }], goCity);
        },
      };
    }
    // Nothing evolves past the region's Pokédex (a Gen 4 evolution doesn't exist in Hoenn).
    if (results) results.evolutions = results.evolutions.filter(e => e.to <= regionNow().lastSpecies);
    modal = 'results';
    show();
    if (results?.lines.some(line => line.key === 'results.level')) window.setTimeout(() => audio.play('levelUp'), 300);
    showResults();
  }

  // ── Party screen ──────────────────────────────────────────────────────────────────────────────────────────────
  /** The party screen's own state: whose summary shows, and the slot picked up to reorder. */
  let partySelected = 0;
  let partyMoving: number | null = null;

  function showParty(focus?: string, swapped?: [number, number]) {
    if (!save) return;
    const s = save;
    partySelected = Math.min(partySelected, s.party.length - 1);
    const moveInfo = (slug: string, slot: 'elemental' | 'big'): MoveInfo => {
      const m = move(slug);
      return {
        slug,
        name: m.name,
        type: m.type,
        typeLabel: t(`type.${m.type}` as MessageKey),
        color: typeColor(m.type),
        power: t('party.power', { power: m.power ?? '—' }),
        shape: t(`shape.${slot === 'big' ? bigShape(slug) : elementalShape(slug)}` as MessageKey),
      };
    };
    const member = (p: Pokemon, index: number): PartyMember => {
      const sp = species(p.speciesId);
      const atMax = p.level >= MAX_LEVEL;
      const from = xpForLevel(sp.growthRate, p.level);
      const to = atMax ? from : xpForLevel(sp.growthRate, p.level + 1);
      const stats = statsOf(p);
      const choose = (slot: 'elemental' | 'big') => (slug: string) => {
        update(current => ({ ...current, party: current.party.map((q, i) => (i === index ? setSpecial(q, slot, slug) : q)) }));
        partyChanged = true;
        partySelected = index;
        showParty(`special-${slot}-${index}`);
      };
      const potions = (['potion', 'super-potion', 'hyper-potion'] as PotionId[]).filter(id => countOf(s.bag, id) > 0 && canUsePotion(p));
      // Nothing evolves past the region's Pokédex.
      const evolvers = EVOLUTION_ITEMS.filter(id => countOf(s.bag, id) > 0 && (itemEvolution(p, id)?.to ?? Infinity) <= regionNow().lastSpecies);
      return {
        name: sp.name,
        sprite: spriteUrl(p.speciesId),
        level: t('party.level', { level: p.level }),
        color: typeColor(sp.types[0]),
        types: sp.types.map(type => ({ type, label: t(`type.${type}` as MessageKey) })),
        hp: p.hp,
        maxHp: maxHpOf(p),
        hpText: t('party.hp', { hp: displayHp(p.hp), max: displayHp(maxHpOf(p)) }),
        fainted: p.hp === 0,
        xp: atMax ? 1 : (p.xp - from) / (to - from),
        xpText: atMax ? t('party.maxLevel') : t('party.toNext', { xp: to - p.xp }),
        stats: (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map(stat => ({ label: t(`stat.${stat}`), value: stats[stat] })),
        specials: (['elemental', 'big'] as const).map(slot => ({
          label: t(`party.${slot}`),
          testid: `special-${slot}-${index}`,
          move: moveInfo(p.specials[slot], slot),
          options: specialOptions(p).map(slug => moveInfo(slug, slot)),
          onChoose: choose(slot),
        })),
        actions: [
          ...potions.map(id => ({
            label: t('party.use', { item: itemName(id), count: countOf(s.bag, id) }),
            testid: `use-${id}-${index}`,
            icon: 'heal' as const,
            onClick: () => {
              update(current => ({
                ...current,
                bag: removeItem(current.bag, id),
                party: current.party.map((q, i) => (i === index ? usePotion(q, id) : q)),
              }));
              partyChanged = true;
              partySelected = index;
              showParty(`member-${index}`);
            },
          })),
          ...evolvers.map(id => ({
            label: t('party.evolveWith', { item: itemName(id) }),
            testid: `evolve-${id}-${index}`,
            icon: 'star' as const,
            onClick: () => {
              const to = itemEvolution(p, id)!.to;
              preloadSprites([to]);
              const evolved = evolve(p, to).pokemon;
              update(current => ({
                ...current,
                bag: removeItem(current.bag, id),
                party: current.party.map((q, i) => (i === index ? evolve(q, to).pokemon : q)),
                dex: register(current, [], [to]),
              }));
              partyChanged = true;
              partySelected = index;
              playEvolution(p, evolved, () => showParty(`member-${index}`));
            },
          })),
        ],
      };
    };
    const moving = partyMoving;
    renderParty(overlayRoot, {
      title: t('party.title'),
      members: s.party.map(member),
      selected: partySelected,
      moving,
      swapped,
      focus: focus ?? `member-${partySelected}`,
      labels: {
        lead: t('party.lead'),
        fainted: t('party.fainted'),
        stats: t('party.stats'),
        specials: t('party.specials'),
        items: t('party.items'),
        noItems: t('party.noItems'),
        moving: moving !== null ? t('party.moving', { name: nameOf(s.party[moving]) }) : '',
        pick: t('party.pick'),
        cancel: t('party.cancel'),
      },
      onPick: index => {
        // Picking up only makes sense with someone to swap with.
        if (s.party.length < 2) return;
        partyMoving = index;
        partySelected = index;
        showParty(`member-${index}`);
      },
      onPlace: index => {
        const from = partyMoving;
        if (from !== null && from !== index) {
          update(current => ({ ...current, party: swapInParty(current.party, from, index) }));
          partyChanged = true;
          audio.play('confirm');
        }
        partyMoving = null;
        partySelected = index;
        showParty(`member-${index}`, from !== null && from !== index ? [from, index] : undefined);
      },
      onCancel: () => {
        const index = partyMoving ?? partySelected;
        partyMoving = null;
        showParty(`member-${index}`);
      },
      close: { label: t('party.close'), testid: 'close-party', onClick: toggleParty },
      hints:
        moving !== null
          ? [{ pad: 'a', key: 'Enter', label: t('party.place') }, { pad: 'b', key: 'Esc', label: t('party.cancel') }]
          : [{ pad: 'a', key: 'Enter', label: t('hint.move') }, { pad: 'b', key: 'Esc', label: t('party.close') }],
    });
  }

  /**
   * P: the party, from the city or during a journey fight (it pauses). Closing it after changes during a fight starts
   * a new battle with the updated party.
   */
  function toggleParty() {
    if (!save || save.prologue !== 'done') return;
    if (modal === 'party') {
      modal = 'none';
      if (partyFrom === 'fight') {
        hide();
        keys.clear();
        if (partyChanged && sandbox) sandbox.setPlayerTeam(save.party.map(toFighter));
      } else if (partyFrom === 'league') {
        showLeague();
      } else {
        goCity();
      }
      partyChanged = false;
      return;
    }
    if (modal === 'results') return;
    const inFight = scene === 'fight' && (mode === 'trainer' || mode === 'wild' || mode === 'gym');
    const inLeagueMenu = scene === 'menu' && league !== null && !sandbox;
    if (!inFight && !inLeagueMenu && scene !== 'city') return;
    partyFrom = inFight ? 'fight' : inLeagueMenu ? 'league' : 'city';
    modal = 'party';
    partySelected = 0;
    partyMoving = null;
    if (partyFrom !== 'fight') backdrop.mode('interior');
    show();
    showParty();
  }

  /** Tab / the View button during a fight: switch Pokémon, if the rules allow it now (else say why). */
  function trySwitch() {
    if (scene !== 'fight' || modal !== 'none' || !sandbox) return;
    const result = sandbox.trySwitch();
    if (result === 'ok') audio.play('select');
    else if (result === 'used') toast(t('switch.used'));
    else if (result === 'alone') toast(t('switch.alone'));
  }

  /** A short message over the fight that fades by itself. */
  const toastLayer = frame.appendChild(document.createElement('div'));
  toastLayer.className = 'toast-layer';
  toastLayer.setAttribute('aria-live', 'polite');
  function toast(text: string) {
    const note = document.createElement('div');
    note.className = 'toast';
    note.dataset.testid = 'toast';
    note.textContent = text;
    toastLayer.replaceChildren(note);
    window.setTimeout(() => note.remove(), 2600);
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const keys = createKeyLatch(bindingsOf(settings.keys));
  const tool = (action: (s: Sandbox) => void) => () => {
    if (sandbox && sandbox.view().tools) action(sandbox);
  };
  attachKeyboard(
    window,
    keys,
    {
      F1: tool(s => s.toggleDebug()),
      F2: tool(s => s.cycleOpponent()),
      F3: tool(s => s.toggleInfinitePp()),
      F4: tool(s => s.cycleStyle()),
      KeyR: tool(s => s.reset()),
      KeyP: toggleParty,
      // In a menu, Esc is its Back button; in a fight, it runs away.
      Escape: () => {
        if (!overlayRoot.hidden && pressBack(overlayRoot)) return;
        // On the switch menu, Esc goes back to the fight (not out of it).
        if (scene === 'fight' && modal === 'none' && sandbox?.cancelSwitch()) return;
        if (modal === 'party') toggleParty();
        else leaveCurrentFight();
      },
      KeyM: toggleMute,
      Tab: trySwitch,
    },
    { paused: () => scene !== 'fight' || modal !== 'none', alwaysOn: ['KeyP', 'Escape', 'KeyM'] },
  );
  // In menus, the arrow keys move on screen (Enter presses the focused button, as browsers do), and buttons can have
  // their own keys (data-key).
  const ARROWS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  window.addEventListener('keydown', event => {
    if (overlayRoot.hidden || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) return;
    const direction = ARROWS[event.code];
    if (direction) {
      event.preventDefault();
      moveFocus(overlayRoot, direction);
      audio.play('select');
    } else if (!event.repeat && pressShortcut(overlayRoot, `[data-key~="${event.code}"]`)) {
      event.preventDefault();
    }
  });

  // ── Loop ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // Inputs are read right before each simulated frame, so a press is used on the very next frame.
  let cueMemory = freshCues();
  const simulate = () => {
    if (scene !== 'fight' || modal !== 'none' || !sandbox) return;
    const pad = readFirstPad().mask;
    // The fight's own hints (the switch menu) follow the device in use.
    if (pad !== 0) input.usePad();
    const events = sandbox.tick(keys.sample() | pad);
    const view = sandbox.view();
    renderer.onTick(view, events);
    const cues = fightCues(cueMemory, { fighters: view.battle.round.fighters, entrance: view.entrance, trainers: view.trainers }, events);
    cueMemory = cues.memory;
    cues.sounds.forEach(sound => audio.play(sound));
    cues.cries.forEach(id => audio.cry(id));
    if (events.some(e => e.type === 'battleOver')) battleFinished();
  };
  const clock = createFixedStep(simulate);
  // The canvas only draws fights; menus show the backdrop (the frame's data-scene hides the canvas).
  const draw = () => {
    const next = scene === 'fight' && sandbox ? 'fight' : 'menu';
    if (frame.dataset.scene !== next) frame.dataset.scene = next;
    if (sandbox && next === 'fight') renderer.draw(sandbox.view(), { pad: input.device() === 'pad' });
  };

  /** The music for where the player is. */
  const songNow = (): SongId => {
    if (scene === 'title') return 'title';
    if (scene === 'fight' && sandbox) {
      const { battle } = sandbox.view();
      if (battle.phase === 'over' && battle.winner === 0) return 'victory';
      return mode === 'gym' ? 'gym' : mode === 'league' || mode === 'legendary' ? 'league' : 'battle';
    }
    return league ? 'league' : 'town';
  };

  const pressFocusedOrPrimary = () => pressShortcut(overlayRoot, '[data-primary]') || pressFocused(overlayRoot);
  let startWasHeld = false;
  let viewWasHeld = false;
  let padBefore: MenuPad = NO_MENU_PAD;
  let last: number | undefined;
  function onAnimationFrame(now: number) {
    const pad = readFirstPad();
    // In menus: the d-pad moves on screen, A presses, B goes back, X / Y / LB / RB are the screen's shortcuts (Y: party).
    if (!overlayRoot.hidden) {
      const pressed = (button: keyof MenuPad) => pad.menu[button] && !padBefore[button];
      const any = (Object.keys(pad.menu) as (keyof MenuPad)[]).some(pressed) || (pad.start && !startWasHeld);
      if (any) input.usePad();
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        if (pressed(direction)) {
          moveFocus(overlayRoot, direction);
          audio.play('select');
        }
      }
      if (pressed('a')) pressFocused(overlayRoot);
      if (pressed('b')) pressBack(overlayRoot);
      for (const shortcut of ['x', 'lb', 'rb'] as const) if (pressed(shortcut)) pressShortcut(overlayRoot, `[data-pad="${shortcut}"]`);
      if (pressed('y') && !pressShortcut(overlayRoot, '[data-pad="y"]')) toggleParty();
    }
    // In a fight: the View button switches Pokémon. In menus it is the screen's View shortcut (the city: the map).
    if (pad.view && !viewWasHeld) {
      input.usePad();
      if (overlayRoot.hidden) trySwitch();
      else pressShortcut(overlayRoot, '[data-pad="view"]');
    }
    viewWasHeld = pad.view;
    padBefore = pad.menu;
    // A controller's Start presses the open menu's main button.
    if (pad.start && !startWasHeld && !overlayRoot.hidden) pressFocusedOrPrimary();
    startWasHeld = pad.start;
    audio.music(songNow());
    if (!options.manualClock && last !== undefined) clock.advance(now - last);
    last = now;
    draw();
    requestAnimationFrame(onAnimationFrame);
  }
  requestAnimationFrame(onAnimationFrame);

  // `?scene=training` (the browser tests) goes straight to a fight: the battle field with a journey, else the demo;
  // `?scene=city` goes to the city (with a journey).
  const startScene = params.get('scene');
  const journeyOn = save?.prologue === 'done';
  if (startScene === 'training') {
    if (journeyOn) startTrainer();
    else startDemo();
  } else if (startScene === 'city' && journeyOn) goCity();
  else goTitle();

  if (options.enabled) {
    const fight = () => {
      if (!sandbox) throw new Error('no fight is running');
      return sandbox.view();
    };
    installTestHooks({
      frame: () => sandbox?.view().battle.round.frame ?? 0,
      step(frames) {
        if (!options.manualClock) throw new Error('step() needs the manual clock (remove &clock=real)');
        for (let i = 0; i < frames; i++) simulate();
        draw();
        return sandbox?.view().battle.round.frame ?? 0;
      },
      snapshot: () => structuredClone(fight().battle.round),
      battle: () => structuredClone(fight().battle),
      debug: () => {
        const view = fight();
        return { overlay: view.debug, opponent: view.opponent, style: view.style, infinitePp: view.infinitePp, advantage: view.advantage, owned: view.owned };
      },
      save: () => structuredClone(save) as Save,
      scene: () => ({ scene, mode: scene === 'fight' ? mode : null, tutorialStep: tutorial?.step() ?? null }),
      manualClock: options.manualClock,
      seed: options.seed,
    });
  }
}
