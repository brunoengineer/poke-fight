// The app: the save, the language, the scenes (title, the Professor's story, starter choice, fights, the city and
// its menus) and the menus over fights (results, party), tied together. A fight only runs while no menu is open over it.

import { BALLS, ITEMS, type BallId, type ItemId, type PotionId } from './data/items';
import { move, species } from './data/pokedex';
import { city, isUnlocked, KANTO, type HuntKind } from './data/regions/kanto';
import { readFirstPad } from './engine/input/gamepad';
import { attachKeyboard } from './engine/input/keyboard';
import { createKeyLatch } from './engine/input/keys';
import { createFixedStep } from './engine/loop';
import { createRng } from './engine/rng';
import type { TeamMember } from './fight/battle';
import { afterBattle, type ReportLine } from './game/after-battle';
import { addCaught, canSendToBox, canTakeFromBox, sendToBox, takeFromBox } from './game/box';
import { catchValue, throwBall } from './game/capture';
import { buy, canUsePotion, countOf, MAX_MONEY, moneyAfterLoss, prizeMoney, removeItem, usePotion } from './game/economy';
import { bestRod, encounterTable, rollEncounter, wildPokemon } from './game/encounters';
import { displayHp, maxHpOf, toFighter, type Pokemon } from './game/pokemon';
import { evolve, heal, setSpecial, specialOptions } from './game/progress';
import { cleanName, createStarter, DEFAULT_NAMES, MAX_NAME_LENGTH, RIVAL_PICK, STARTERS, STARTER_GIFTS, trainingOpponents } from './game/story';
import { MAX_LEVEL, xpForLevel } from './game/xp';
import { detectLanguage, isLanguage, language, LANGUAGE_NAMES, LANGUAGES, setLanguage, t, type Language, type MessageKey } from './i18n';
import { render, renderBackdrop } from './render/renderer';
import { preloadSprites, spriteUrl } from './render/sprites';
import { createSandbox, isOpponent, type Banner, type Director, type Opponent, type Sandbox } from './screens/sandbox';
import { OPPONENT_TEAM, PLAYER_TEAM } from './screens/sandbox-teams';
import { createTutorialDirector, type TutorialDirector } from './screens/tutorial-director';
import { newSave, type Save } from './state/save';
import { createSaveStore } from './state/store';
import { installTestHooks, type TestOptions } from './test/hooks';
import { pressPrimary, renderDialog, renderMenu, renderParty, renderResults, renderStarter, renderTitle, type Button } from './ui/screens';

/** A text to show: a translation key and its values. */
type Line = { key: MessageKey; params: Record<string, string | number> };
/** A line of the story, said by someone. */
type Said = Line & { speaker: string };

/**
 * Fights: the demo (Training without a journey: Lv. 30 demo teams, no XP), trainers (the battle field: XP and prize
 * money), a wild Pokémon (hunting: XP and a chance to catch it), and the rival tutorial.
 */
type FightMode = 'demo' | 'trainer' | 'wild' | 'tutorial';
type Scene = 'title' | 'story' | 'starter' | 'fight' | 'city' | 'menu';

interface ResultsState {
  outcome: 'win' | 'loss' | 'draw';
  lines: Line[];
  /** A defeated wild Pokémon, waiting for a ball (asked first). */
  capture: { pokemon: Pokemon; playerLevel: number } | null;
  /** Party indexes ready to evolve, asked one at a time. */
  evolutions: { index: number; to: number }[];
  onContinue: () => void;
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
const typeNames = (types: readonly string[]) => types.map(type => t(`type.${type}` as MessageKey)).join(' / ');

export function startApp(canvas: HTMLCanvasElement, overlayRoot: HTMLElement, options: TestOptions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  const params = new URLSearchParams(location.search);
  const seed = options.enabled ? options.seed : Date.now() >>> 0;
  /** Encounters and catching (seeded in test mode, so the browser tests are repeatable). */
  const rng = createRng(seed);

  // ── Save and language ─────────────────────────────────────────────────────────────────────────────────────────
  const store = createSaveStore(safeStorage());
  const loaded = store.load();
  let save: Save | null = loaded.status === 'ok' ? loaded.save : null;
  let notice: MessageKey | null = null;
  if (loaded.status === 'broken') {
    console.warn(`Saved game could not be read (${loaded.reason}: ${loaded.detail}); it was kept aside.`);
    notice = 'save.problem';
  }
  const persist = () => save && store.write(save);
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
  applyLanguage(save?.settings.language ?? detectLanguage(navigator.language));
  const languagePicker = (refresh: () => void) => ({
    label: t('party.language'),
    options: LANGUAGES.map(l => ({ value: l, label: LANGUAGE_NAMES[l] })),
    value: language(),
    onChange: (value: string) => {
      if (!isLanguage(value)) return;
      applyLanguage(value);
      update(s => ({ ...s, settings: { ...s.settings, language: value } }));
      refresh();
    },
  });

  // ── Scenes ────────────────────────────────────────────────────────────────────────────────────────────────────
  let scene: Scene = 'title';
  let mode: FightMode = 'demo';
  let sandbox: Sandbox | null = null;
  let tutorial: TutorialDirector | null = null;
  /** The wild Pokémon being fought (it can be caught after the battle). */
  let wild: Pokemon | null = null;
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

  function goTitle() {
    leaveFight();
    scene = 'title';
    show();
    const buttons = [];
    if (save) buttons.push({ label: t('title.continue'), testid: 'continue-game', primary: true, onClick: continueGame });
    buttons.push({ label: t('title.new'), testid: 'new-game', primary: !save, onClick: newGame });
    buttons.push({ label: t('title.training'), testid: 'training', onClick: startDemo });
    renderTitle(overlayRoot, {
      title: 'Poké Fight',
      subtitle: t(notice ?? 'title.subtitle'),
      continueInfo: save ? t('title.continueWho', { player: save.player.name, place: t(cityKey(save.location)) }) : undefined,
      buttons,
      language: languagePicker(goTitle),
    });
  }

  /** The story, one line at a time (Next / Enter), then `then`. */
  function tell(lines: Said[], then: () => void, index = 0) {
    if (index >= lines.length) return then();
    scene = 'story';
    show();
    const line = lines[index];
    renderDialog(overlayRoot, {
      speaker: line.speaker,
      text: t(line.key, line.params),
      button: { label: t('dialog.next'), testid: 'dialog-next', onClick: () => tell(lines, then, index + 1) },
    });
  }

  /** A question with a text field (a name). */
  function ask(key: MessageKey, fallback: string, then: (answer: string) => void) {
    scene = 'story';
    show();
    renderDialog(overlayRoot, {
      speaker: t('speaker.professor'),
      text: t(key),
      input: { label: t('dialog.name'), value: fallback, maxLength: MAX_NAME_LENGTH },
      button: { label: t('dialog.ok'), testid: 'dialog-ok', onClick: typed => then(cleanName(typed, fallback)) },
    });
  }

  const professor = (key: MessageKey, values: Line['params'] = {}): Said => ({ speaker: t('speaker.professor'), key, params: values });

  // ── The prologue ──────────────────────────────────────────────────────────────────────────────────────────────
  function newGame() {
    if (save && !window.confirm(t('title.confirmNew'))) return;
    notice = null;
    // The starters' sprites load while the Professor talks.
    preloadSprites([...STARTERS]);
    tell([professor('story.welcome'), professor('story.live')], () =>
      ask('story.askName', DEFAULT_NAMES.player, player =>
        ask('story.askRival', DEFAULT_NAMES.rival, rival => chooseStarter(player, rival)),
      ),
    );
  }

  function chooseStarter(player: string, rival: string) {
    tell([professor('story.choose', { player })], () => {
      scene = 'starter';
      show();
      renderStarter(overlayRoot, {
        title: t('starter.title'),
        starters: STARTERS.map(id => ({
          id,
          name: species(id).name,
          types: typeNames(species(id).types),
          sprite: spriteUrl(id),
          testid: `starter-${species(id).slug}`,
          onClick: () => pickStarter(id, player, rival),
        })),
      });
    });
  }

  function pickStarter(id: (typeof STARTERS)[number], player: string, rival: string) {
    const starter = createStarter(id);
    const rivalId = RIVAL_PICK[id];
    save = newSave({ playerName: player, rivalName: rival, starterId: id, rivalStarterId: rivalId, party: [starter] }, Date.now(), language());
    persist();
    const gift = move(STARTER_GIFTS[id]);
    tell(
      [
        professor('story.gift', { pokemon: species(id).name, move: gift.name, type: t(`type.${gift.type}` as MessageKey) }),
        { speaker: rival, key: 'story.rivalPick', params: { pokemon: species(rivalId).name, player } },
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
    const rival = createStarter(save.rival.starterId as (typeof STARTERS)[number]);
    tutorial = createTutorialDirector(seed, save.rival.name, move(save.party[0].specials.elemental).name);
    enterFight('tutorial', save.party.map(toFighter), [toFighter(rival)], { director: tutorial });
  }

  function endPrologue(outcome: ResultsState['outcome']) {
    if (!save) return;
    const s = save;
    const lost = outcome !== 'win';
    // After the first battle the starter rests at home: full HP, whatever happened.
    update(current => ({ ...current, prologue: 'done', location: 'viridian', party: current.party.map(heal) }));
    tell(
      [
        { speaker: s.rival.name, key: lost ? 'story.rivalWon' : 'story.rivalLost', params: { player: s.player.name } },
        ...(lost ? [professor('story.rested')] : []),
        professor('story.depart'),
      ],
      goCity,
    );
  }

  // ── The city and its menus ────────────────────────────────────────────────────────────────────────────────────
  const moneyLine = (s: Save) => t('city.money', { money: s.money });
  const ownsRod = (s: Save) => bestRod(rod => countOf(s.bag, rod) > 0);

  function goCity() {
    if (!save) return goTitle();
    leaveFight();
    scene = 'city';
    show();
    const s = save;
    const here = city(s.location);
    // Everything that can appear here (and the party) starts loading now, so a hunt starts with its sprites ready.
    const rod = ownsRod(s);
    const possible = (['grass', 'cave', 'water'] as HuntKind[]).flatMap(kind => encounterTable(here, kind, rod).map(e => e.speciesId));
    preloadSprites([...new Set([...possible, ...s.party.map(p => p.speciesId)])]);
    const hunts: Button[] = (['grass', 'cave', 'water'] as HuntKind[])
      .filter(kind => here.hunts[kind])
      .map(kind => {
        if (kind === 'water') {
          return rod
            ? { label: t('hunt.water', { rod: itemName(rod) }), testid: 'hunt-water', onClick: () => startHunt('water') }
            : { label: t('hunt.waterNoRod'), testid: 'hunt-water', disabled: true, onClick: () => {} };
        }
        return { label: t(`hunt.${kind}`), testid: `hunt-${kind}`, onClick: () => startHunt(kind) };
      });
    if (hunts[0]) hunts[0].primary = true;
    renderMenu(overlayRoot, {
      title: t(cityKey(s.location)),
      testid: 'city',
      info: [moneyLine(s), t('city.dex', { seen: s.dex.seen.length, caught: s.dex.caught.length })],
      sections: [],
      buttons: [
        ...hunts,
        { label: t('city.training'), testid: 'city-training', onClick: startTrainer },
        { label: t('city.center'), testid: 'city-center', onClick: () => showCenter(null) },
        ...(here.shop ? [{ label: t('city.shop'), testid: 'city-shop', onClick: () => showShop(null) }] : []),
        { label: t('city.box'), testid: 'city-box', onClick: showBox },
        { label: t('city.party'), testid: 'city-party', onClick: toggleParty },
        { label: t('city.map'), testid: 'city-map', onClick: showMap },
        { label: t('city.title'), testid: 'to-title', onClick: goTitle },
      ],
    });
  }

  const back: () => Button = () => ({ label: t('menu.back'), testid: 'back', onClick: goCity });

  function showCenter(message: MessageKey | null) {
    if (!save) return;
    scene = 'menu';
    show();
    renderMenu(overlayRoot, {
      title: t('city.center'),
      testid: 'center',
      info: message ? [t(message)] : [],
      sections: [],
      buttons: [
        {
          label: t('center.heal'),
          testid: 'center-heal',
          primary: true,
          onClick: () => {
            update(s => ({ ...s, party: s.party.map(heal) }));
            showCenter('center.healed');
          },
        },
        back(),
      ],
    });
  }

  function showShop(message: string | null) {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    renderMenu(overlayRoot, {
      title: t('city.shop'),
      testid: 'shop',
      info: [moneyLine(s), ...(message ? [message] : [])],
      sections: [
        {
          rows: (city(s.location).shop ?? []).map(id => {
            const item = ITEMS[id];
            const owned = countOf(s.bag, id);
            const rodOwned = item.kind === 'rod' && owned > 0;
            return {
              label: itemName(id),
              detail: t('shop.owned', { count: owned }),
              testid: `item-${id}`,
              buttons: [
                {
                  label: rodOwned ? t('shop.ownedRod') : t('shop.buy', { price: item.price }),
                  testid: `buy-${id}`,
                  disabled: rodOwned,
                  onClick: () => {
                    const result = buy(s.money, s.bag, id);
                    if (!result.ok) return showShop(t('shop.noMoney'));
                    update(current => ({ ...current, money: result.money, bag: result.bag }));
                    showShop(t('shop.bought', { item: itemName(id) }));
                  },
                },
              ],
            };
          }),
        },
      ],
      buttons: [{ ...back(), primary: true }],
    });
  }

  function showBox() {
    if (!save) return;
    const s = save;
    scene = 'menu';
    show();
    const row = (p: Pokemon) => `${nameOf(p)} · ${t('party.level', { level: p.level })}`;
    renderMenu(overlayRoot, {
      title: t('city.box'),
      testid: 'box',
      info: s.box.length ? [] : [t('box.empty')],
      sections: [
        {
          title: t('box.party', { count: s.party.length }),
          rows: s.party.map((p, i) => ({
            label: row(p),
            testid: `party-${i}`,
            buttons: [
              {
                label: t('box.toBox'),
                testid: `to-box-${i}`,
                disabled: !canSendToBox(s),
                onClick: () => {
                  update(current => ({ ...current, ...sendToBox(current, i) }));
                  showBox();
                },
              },
            ],
          })),
        },
        {
          title: t('box.box', { count: s.box.length }),
          rows: s.box.map((p, i) => ({
            label: row(p),
            testid: `boxed-${i}`,
            buttons: [
              {
                label: t('box.toParty'),
                testid: `to-party-${i}`,
                disabled: !canTakeFromBox(s),
                onClick: () => {
                  update(current => ({ ...current, ...takeFromBox(current, i) }));
                  showBox();
                },
              },
            ],
          })),
        },
      ],
      buttons: [{ ...back(), primary: true }],
    });
  }

  /** The world map. Badges (milestone 8) open the cities further on. */
  function showMap() {
    if (!save) return;
    const s = save;
    const badges = 0;
    scene = 'menu';
    show();
    renderMenu(overlayRoot, {
      title: 'Kanto',
      testid: 'map',
      info: [],
      sections: [
        {
          rows: KANTO.map(c => {
            const here = c.id === s.location;
            const open = isUnlocked(c, badges);
            return {
              label: t(cityKey(c.id)),
              detail: here ? t('map.here') : open ? undefined : t('map.locked', { badges: c.badges }),
              testid: `place-${c.id}`,
              buttons: [
                {
                  label: t('map.go'),
                  testid: `go-${c.id}`,
                  disabled: here || !open,
                  onClick: () => {
                    update(current => ({ ...current, location: c.id }));
                    goCity();
                  },
                },
              ],
            };
          }),
        },
      ],
      buttons: [{ ...back(), primary: true }],
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
  }

  function enterFight(next: FightMode, player: TeamMember[], opponents: TeamMember[], setup: FightSetup = {}) {
    mode = next;
    scene = 'fight';
    modal = 'none';
    results = null;
    hide();
    sandbox = createSandbox({
      player,
      opponentTeam: opponents,
      opponent: opponentFor(setup.opponent ?? 'cpu-normal'),
      seed,
      director: setup.director,
      intro: setup.intro,
    });
    preloadSprites([...player, ...opponents].map(member => member.speciesId));
    keys.clear();
  }

  /** Before a journey fight: a party with nobody able to fight rests first (it can't happen after a loss, which heals). */
  const readyParty = () => {
    if (save?.party.every(p => p.hp === 0)) update(s => ({ ...s, party: s.party.map(heal) }));
    return save!.party;
  };

  /** Training from the title: the Lv. 30 demo teams, no XP, nothing saved. */
  function startDemo() {
    enterFight('demo', PLAYER_TEAM, OPPONENT_TEAM);
  }

  /** The battle field: trainers with your party's level (XP and prize money). */
  function startTrainer() {
    if (!save) return;
    const party = readyParty();
    const opponents = trainingOpponents(party);
    wild = null;
    update(s => ({ ...s, dex: register(s, opponents.map(p => p.speciesId)) }));
    enterFight('trainer', party.map(toFighter), opponents.map(toFighter), {
      intro: { step: null, key: 'trainer.challenge', params: {} },
    });
  }

  /** Hunting: a wild Pokémon from this city's grass, cave or water (fishing with the best rod). */
  function startHunt(kind: HuntKind) {
    if (!save) return;
    const s = save;
    const table = encounterTable(city(s.location), kind, kind === 'water' ? ownsRod(s) : null);
    if (table.length === 0) return;
    const party = readyParty();
    wild = wildPokemon(rollEncounter(table, rng), rng);
    const found = wild;
    update(current => ({ ...current, dex: register(current, [found.speciesId]) }));
    enterFight('wild', party.map(toFighter), [toFighter(found)], {
      opponent: 'cpu-easy',
      intro: { step: null, key: 'wild.appeared', params: { name: nameOf(found) } },
    });
  }

  /** Esc during a fight: back to where it was started from (running away from a wild Pokémon; not in the tutorial). */
  function leaveCurrentFight() {
    if (scene !== 'fight' || modal !== 'none' || mode === 'tutorial') return;
    if (mode === 'demo') goTitle();
    else goCity();
  }

  // ── Results ───────────────────────────────────────────────────────────────────────────────────────────────────
  const lineFor = (line: ReportLine, party: Pokemon[]): Line => {
    const name = nameOf(party[line.index]);
    if (line.kind === 'xp') return { key: 'results.xp', params: { name, xp: line.amount } };
    if (line.kind === 'level') return { key: 'results.level', params: { name, level: line.level } };
    return { key: 'results.move', params: { name, move: move(line.move).name } };
  };

  function showResults() {
    if (!results) return;
    const state = results;
    const s = save;
    const title = t(state.outcome === 'win' ? 'results.win' : state.outcome === 'loss' ? 'results.loss' : 'results.draw');
    const lines = state.lines.length ? state.lines.map(l => t(l.key, l.params)) : [t('results.noXp')];

    if (state.capture && s) {
      const target = state.capture.pokemon;
      const balls = BALLS.filter(ball => countOf(s.bag, ball) > 0);
      renderResults(overlayRoot, {
        title,
        lines,
        prompt: t('capture.prompt', { name: nameOf(target) }),
        buttons: [
          ...balls.map((ball, i) => ({
            label: t('capture.throw', { ball: itemName(ball), count: countOf(s.bag, ball) }),
            testid: `throw-${ball}`,
            primary: i === 0,
            onClick: () => throwAt(ball),
          })),
          { label: t('capture.letGo'), testid: 'let-go', onClick: letGo },
        ],
      });
      return;
    }

    const next = state.evolutions[0];
    if (next && s) {
      // The evolved form's sprite starts loading now, so it's ready when the next battle starts.
      preloadSprites([next.to]);
      renderResults(overlayRoot, {
        title,
        lines,
        prompt: t('results.evolving', { name: nameOf(s.party[next.index]) }),
        buttons: [
          { label: t('results.evolve'), testid: 'evolve', primary: true, onClick: () => decideEvolution(true) },
          { label: t('results.stop'), testid: 'stop-evolution', onClick: () => decideEvolution(false) },
        ],
      });
      return;
    }
    renderResults(overlayRoot, {
      title,
      lines,
      buttons: [{ label: t('results.continue'), testid: 'continue', primary: true, onClick: state.onContinue }],
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
      badges: 0,
    });
    const thrown = throwBall(x, rng);
    update(s => ({ ...s, bag: removeItem(s.bag, ball) }));
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
    showResults();
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
      for (const m of evolved.moves) results.lines.push({ key: 'results.move', params: { name: nameOf(evolved.pokemon), move: move(m).name } });
    } else {
      results.lines.push({ key: 'results.stopped', params: { name: nameOf(before) } });
    }
    showResults();
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
        onContinue: () => {
          closeModal();
          endPrologue(outcome);
        },
      };
    } else {
      // Trainers give 1.5× XP and prize money; a wild Pokémon can be caught. Losing costs half the money (and heals).
      const { party, report } = afterBattle(save.party, battle, finished === 'trainer');
      const lines = report.lines.map(line => lineFor(line, party));
      let next = { ...save, party };
      if (outcome === 'win' && finished === 'trainer') {
        const prize = prizeMoney(battle.teams[1].map(m => m.level));
        next = { ...next, money: Math.min(MAX_MONEY, next.money + prize) };
        lines.push({ key: 'results.prize', params: { money: prize } });
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
        onContinue: () => {
          closeModal();
          goCity();
        },
      };
    }
    modal = 'results';
    show();
    showResults();
  }

  // ── Party screen ──────────────────────────────────────────────────────────────────────────────────────────────
  function showParty() {
    if (!save) return;
    const s = save;
    const member = (p: Pokemon, index: number) => {
      const sp = species(p.speciesId);
      const atMax = p.level >= MAX_LEVEL;
      const from = xpForLevel(sp.growthRate, p.level);
      const to = atMax ? from : xpForLevel(sp.growthRate, p.level + 1);
      const choices = specialOptions(p).map(slug => ({ value: slug, label: move(slug).name }));
      const change = (slot: 'elemental' | 'big') => (value: string) => {
        update(current => ({ ...current, party: current.party.map((q, i) => (i === index ? setSpecial(q, slot, value) : q)) }));
        partyChanged = true;
      };
      const potions = (['potion', 'super-potion', 'hyper-potion'] as PotionId[]).filter(id => countOf(s.bag, id) > 0 && canUsePotion(p));
      return {
        name: sp.name,
        level: t('party.level', { level: p.level }),
        hp: p.hp === 0 ? t('party.fainted') : t('party.hp', { hp: displayHp(p.hp), max: displayHp(maxHpOf(p)) }),
        fainted: p.hp === 0,
        xpProgress: atMax ? 1 : (p.xp - from) / (to - from),
        xpText: atMax ? t('party.maxLevel') : t('party.toNext', { xp: to - p.xp }),
        specials: [
          { label: t('party.elemental'), testid: `special-elemental-${index}`, options: choices, value: p.specials.elemental, onChange: change('elemental') },
          { label: t('party.big'), testid: `special-big-${index}`, options: choices, value: p.specials.big, onChange: change('big') },
        ],
        actions: potions.map(id => ({
          label: t('party.use', { item: itemName(id), count: countOf(s.bag, id) }),
          testid: `use-${id}-${index}`,
          onClick: () => {
            update(current => ({
              ...current,
              bag: removeItem(current.bag, id),
              party: current.party.map((q, i) => (i === index ? usePotion(q, id) : q)),
            }));
            partyChanged = true;
            showParty();
          },
        })),
      };
    };
    renderParty(overlayRoot, {
      title: t('party.title'),
      members: s.party.map(member),
      language: languagePicker(showParty),
      buttons: [{ label: t('party.close'), testid: 'close-party', primary: true, onClick: toggleParty }],
    });
  }

  /**
   * P: the party, from the city or during a journey fight (it pauses). Closing it after changes during a fight starts
   * a new battle with the updated party.
   */
  function toggleParty() {
    if (!save || save.prologue !== 'done') return;
    const inFight = scene === 'fight' && (mode === 'trainer' || mode === 'wild');
    if (!inFight && scene !== 'city') return;
    if (modal === 'party') {
      modal = 'none';
      if (inFight) {
        hide();
        keys.clear();
        if (partyChanged && sandbox) sandbox.setPlayerTeam(save.party.map(toFighter));
      } else {
        goCity();
      }
      partyChanged = false;
      return;
    }
    if (modal === 'results') return;
    modal = 'party';
    show();
    showParty();
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const keys = createKeyLatch();
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
      Escape: () => (modal === 'party' ? toggleParty() : leaveCurrentFight()),
    },
    { paused: () => scene !== 'fight' || modal !== 'none', alwaysOn: ['KeyP', 'Escape'] },
  );

  // ── Loop ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // Inputs are read right before each simulated frame, so a press is used on the very next frame.
  const simulate = () => {
    if (scene !== 'fight' || modal !== 'none' || !sandbox) return;
    const events = sandbox.tick(keys.sample() | readFirstPad().mask);
    if (events.some(e => e.type === 'battleOver')) battleFinished();
  };
  const clock = createFixedStep(simulate);
  const draw = () => (sandbox ? render(ctx, sandbox.view()) : renderBackdrop(ctx));

  let startWasHeld = false;
  let last: number | undefined;
  function onAnimationFrame(now: number) {
    // A controller's Start presses the open menu's main button.
    const start = readFirstPad().start;
    if (start && !startWasHeld && !overlayRoot.hidden) pressPrimary(overlayRoot);
    startWasHeld = start;
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
        return { overlay: view.debug, opponent: view.opponent, style: view.style, infinitePp: view.infinitePp, advantage: view.advantage };
      },
      save: () => structuredClone(save) as Save,
      scene: () => ({ scene, mode: scene === 'fight' ? mode : null, tutorialStep: tutorial?.step() ?? null }),
      manualClock: options.manualClock,
      seed: options.seed,
    });
  }
}
