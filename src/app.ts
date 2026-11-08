// The app: the save, the language, the scenes (title, the Professor's story, starter choice, fights, the city) and
// the menus over fights (results, party), tied together. A fight only runs while no menu is open over it.

import { move, species } from './data/pokedex';
import { readFirstPad } from './engine/input/gamepad';
import { attachKeyboard } from './engine/input/keyboard';
import { createKeyLatch } from './engine/input/keys';
import { createFixedStep } from './engine/loop';
import type { TeamMember } from './fight/battle';
import { afterBattle, type ReportLine } from './game/after-battle';
import { displayHp, maxHpOf, toFighter, type Pokemon } from './game/pokemon';
import { evolve, heal, setSpecial, specialOptions } from './game/progress';
import { cleanName, createStarter, DEFAULT_NAMES, MAX_NAME_LENGTH, RIVAL_PICK, STARTERS, STARTER_GIFTS, trainingOpponents } from './game/story';
import { MAX_LEVEL, xpForLevel } from './game/xp';
import { detectLanguage, isLanguage, language, LANGUAGE_NAMES, LANGUAGES, setLanguage, t, type Language, type MessageKey } from './i18n';
import { render, renderBackdrop } from './render/renderer';
import { preloadSprites, spriteUrl } from './render/sprites';
import { createSandbox, isOpponent, type Director, type Sandbox } from './screens/sandbox';
import { OPPONENT_TEAM, PLAYER_TEAM } from './screens/sandbox-teams';
import { createTutorialDirector, type TutorialDirector } from './screens/tutorial-director';
import { newSave, type Save } from './state/save';
import { createSaveStore } from './state/store';
import { installTestHooks, type TestOptions } from './test/hooks';
import { pressPrimary, renderCity, renderDialog, renderParty, renderResults, renderStarter, renderTitle } from './ui/screens';

/** Journey fights count as trainer battles (1.5× XP). */
const TRAINER_BATTLE = true;

/** A text to show: a translation key and its values. */
type Line = { key: MessageKey; params: Record<string, string | number> };
/** A line of the story, said by someone. */
type Said = Line & { speaker: string };

/** Fights: the demo (Training without a journey: Lv. 30 demo teams, no XP), journey training, the rival tutorial. */
type FightMode = 'demo' | 'training' | 'tutorial';
type Scene = 'title' | 'story' | 'starter' | 'fight' | 'city';

interface ResultsState {
  outcome: 'win' | 'loss' | 'draw';
  lines: Line[];
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
const typeNames = (types: readonly string[]) => types.map(type => t(`type.${type}` as MessageKey)).join(' / ');

export function startApp(canvas: HTMLCanvasElement, overlayRoot: HTMLElement, options: TestOptions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  const params = new URLSearchParams(location.search);
  const seed = options.enabled ? options.seed : Date.now() >>> 0;

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
    buttons.push({ label: t('title.training'), testid: 'training', onClick: startTraining });
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
    enterFight('tutorial', save.party.map(toFighter), [toFighter(rival)], tutorial);
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

  // ── The city (milestone 7 fills it in) ────────────────────────────────────────────────────────────────────────
  function goCity() {
    if (!save) return goTitle();
    leaveFight();
    scene = 'city';
    show();
    renderCity(overlayRoot, {
      name: t(cityKey(save.location)),
      info: t('city.soon'),
      buttons: [
        { label: t('city.training'), testid: 'city-training', primary: true, onClick: startTraining },
        { label: t('city.party'), testid: 'city-party', onClick: toggleParty },
        { label: t('city.title'), testid: 'city-title', onClick: goTitle },
      ],
    });
  }

  // ── Fights ────────────────────────────────────────────────────────────────────────────────────────────────────
  // Player 2 in training: the CPU (normal) by default; `?opponent=stand` (or jump, attack, guard, special, cpu-easy,
  // cpu-hard…) picks another one. The browser tests use it to choose a predictable opponent.
  const opponentParam = params.get('opponent') ?? 'cpu-normal';

  function enterFight(next: FightMode, player: TeamMember[], opponents: TeamMember[], director?: Director) {
    mode = next;
    scene = 'fight';
    modal = 'none';
    results = null;
    hide();
    sandbox = createSandbox({
      player,
      opponentTeam: opponents,
      opponent: isOpponent(opponentParam) ? opponentParam : 'cpu-normal',
      seed,
      director,
    });
    preloadSprites([...player, ...opponents].map(member => member.speciesId));
    keys.clear();
  }

  /** Training: with a journey, your party against opponents at its level (XP counts); without one, the demo. */
  function startTraining() {
    if (!save || save.prologue !== 'done') {
      enterFight('demo', PLAYER_TEAM, OPPONENT_TEAM);
      return;
    }
    // Nobody able to fight: they rest first (the Pokémon Center comes with milestone 7).
    if (save.party.every(p => p.hp === 0)) update(s => ({ ...s, party: s.party.map(heal) }));
    const party = save.party;
    enterFight('training', party.map(toFighter), trainingOpponents(party).map(toFighter));
  }

  /** Esc during a fight: back to where it was started from (not during the tutorial). */
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
    const title = t(state.outcome === 'win' ? 'results.win' : state.outcome === 'loss' ? 'results.loss' : 'results.draw');
    const lines = state.lines.length ? state.lines.map(l => t(l.key, l.params)) : [t('results.noXp')];
    const next = state.evolutions[0];
    if (next && save) {
      // The evolved form's sprite starts loading now, so it's ready when the next battle starts.
      preloadSprites([next.to]);
      renderResults(overlayRoot, {
        title,
        lines,
        prompt: t('results.evolving', { name: nameOf(save.party[next.index]) }),
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

  function decideEvolution(accept: boolean) {
    if (!results || !save) return;
    const { index, to } = results.evolutions.shift()!;
    const before = save.party[index];
    if (accept) {
      const evolved = evolve(before, to);
      update(s => ({ ...s, party: s.party.map((p, i) => (i === index ? evolved.pokemon : p)) }));
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

    if (finished === 'demo' || !save) {
      results = {
        outcome,
        lines: [{ key: 'results.practice', params: {} }],
        evolutions: [],
        onContinue: () => {
          closeModal();
          sandbox?.reset();
        },
      };
    } else {
      // The tutorial only gives XP for a win (losing it is part of the story).
      const { party, report } = afterBattle(save.party, battle, TRAINER_BATTLE);
      const lostTutorial = finished === 'tutorial' && outcome !== 'win';
      update(s => ({ ...s, party: lostTutorial ? s.party : party }));
      results = {
        outcome,
        lines: lostTutorial ? [] : report.lines.map(line => lineFor(line, party)),
        evolutions: finished === 'tutorial' ? [] : report.evolutions,
        onContinue: () => {
          closeModal();
          if (finished === 'tutorial') endPrologue(outcome);
          else goCity();
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
    const member = (p: Pokemon, index: number) => {
      const s = species(p.speciesId);
      const atMax = p.level >= MAX_LEVEL;
      const from = xpForLevel(s.growthRate, p.level);
      const to = atMax ? from : xpForLevel(s.growthRate, p.level + 1);
      const choices = specialOptions(p).map(slug => ({ value: slug, label: move(slug).name }));
      const change = (slot: 'elemental' | 'big') => (value: string) => {
        update(current => ({ ...current, party: current.party.map((q, i) => (i === index ? setSpecial(q, slot, value) : q)) }));
        partyChanged = true;
      };
      return {
        name: s.name,
        level: t('party.level', { level: p.level }),
        hp: p.hp === 0 ? t('party.fainted') : t('party.hp', { hp: displayHp(p.hp), max: displayHp(maxHpOf(p)) }),
        fainted: p.hp === 0,
        xpProgress: atMax ? 1 : (p.xp - from) / (to - from),
        xpText: atMax ? t('party.maxLevel') : t('party.toNext', { xp: to - p.xp }),
        specials: [
          { label: t('party.elemental'), testid: `special-elemental-${index}`, options: choices, value: p.specials.elemental, onChange: change('elemental') },
          { label: t('party.big'), testid: `special-big-${index}`, options: choices, value: p.specials.big, onChange: change('big') },
        ],
      };
    };
    renderParty(overlayRoot, {
      title: t('party.title'),
      members: save.party.map(member),
      language: languagePicker(showParty),
      buttons: [
        { label: t('party.close'), testid: 'close-party', primary: true, onClick: toggleParty },
        {
          label: t('party.heal'),
          testid: 'heal',
          onClick: () => {
            update(s => ({ ...s, party: s.party.map(heal) }));
            partyChanged = true;
            showParty();
          },
        },
      ],
    });
  }

  /**
   * P: the party, from the city or during journey training (the fight pauses). Closing it after changes during a
   * fight starts a new battle with the updated party.
   */
  function toggleParty() {
    if (!save || save.prologue !== 'done') return;
    const inFight = scene === 'fight' && mode === 'training';
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

  // `?scene=training` (the browser tests) goes straight to Training; `?scene=city` to the city (with a journey).
  const startScene = params.get('scene');
  if (startScene === 'training') startTraining();
  else if (startScene === 'city' && save?.prologue === 'done') goCity();
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
