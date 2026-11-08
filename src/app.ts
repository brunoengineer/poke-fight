// The app: the save, the language, the fight sandbox and the menu screens (results, party), tied together.
// The fight only runs while no menu is open.

import { move, species } from './data/pokedex';
import { readFirstPad } from './engine/input/gamepad';
import { attachKeyboard } from './engine/input/keyboard';
import { createKeyLatch } from './engine/input/keys';
import { createFixedStep } from './engine/loop';
import { afterBattle, type ReportLine } from './game/after-battle';
import { displayHp, maxHpOf, toFighter, type Pokemon } from './game/pokemon';
import { evolve, heal, setSpecial, specialOptions } from './game/progress';
import { MAX_LEVEL, xpForLevel } from './game/xp';
import { detectLanguage, isLanguage, LANGUAGE_NAMES, LANGUAGES, setLanguage, t, type Language, type MessageKey } from './i18n';
import { render } from './render/renderer';
import { preloadSprites } from './render/sprites';
import { createSandbox, isOpponent } from './screens/sandbox';
import { sandboxParty } from './screens/sandbox-teams';
import { newSave, type Save } from './state/save';
import { createSaveStore } from './state/store';
import { installTestHooks, type TestOptions } from './test/hooks';
import { pressPrimary, renderParty, renderResults } from './ui/screens';

/** Sandbox battles count as trainer battles (1.5× XP). */
const TRAINER_BATTLE = true;

type Line = { key: MessageKey; params: Record<string, string | number> };

interface ResultsState {
  outcome: 'win' | 'loss' | 'draw';
  lines: Line[];
  /** Party indexes ready to evolve, asked one at a time. */
  evolutions: { index: number; to: number }[];
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const nameOf = (p: Pokemon) => species(p.speciesId).name;

export function startApp(canvas: HTMLCanvasElement, overlayRoot: HTMLElement, options: TestOptions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');

  // ── Save and language ──
  const store = createSaveStore(safeStorage());
  const loaded = store.load();
  const freshSave = (language: Language) => newSave(sandboxParty(), Date.now(), language);
  let save: Save = loaded.status === 'ok' ? loaded.save : freshSave(detectLanguage(navigator.language));
  if (loaded.status === 'broken') console.warn(`Saved game could not be read (${loaded.reason}: ${loaded.detail}); it was kept aside.`);
  if (loaded.status !== 'ok') store.write(save);
  const persist = () => store.write(save);

  const applyLanguage = (language: Language) => {
    setLanguage(language);
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  };
  applyLanguage(save.settings.language);

  // ── The fight ──
  const teamOf = (party: Pokemon[]) => party.map(toFighter);
  // Player 2: the CPU (normal) by default; `?opponent=stand` (or jump, attack, guard, special, cpu-easy, cpu-hard…)
  // picks another one. The browser tests use it to choose a predictable opponent.
  const opponentParam = new URLSearchParams(location.search).get('opponent') ?? 'cpu-normal';
  const sandbox = createSandbox({
    player: teamOf(save.party),
    opponent: isOpponent(opponentParam) ? opponentParam : 'cpu-normal',
    seed: options.enabled ? options.seed : Date.now() >>> 0,
  });
  // Both teams' sprites start loading now, so a Pokémon coming in later doesn't flash as a placeholder.
  const preload = () => preloadSprites(sandbox.view().battle.teams.flat().map(member => member.speciesId));
  preload();

  // ── Menus ──
  let screen: 'none' | 'results' | 'party' = 'none';
  let results: ResultsState | null = null;
  let partyChanged = false;

  const close = () => {
    screen = 'none';
    overlayRoot.hidden = true;
    overlayRoot.replaceChildren();
    keys.clear();
  };
  const startNextBattle = () => {
    sandbox.setPlayerTeam(teamOf(save.party));
    preload();
  };

  const lineFor = (line: ReportLine, party: Pokemon[]): Line => {
    const name = nameOf(party[line.index]);
    if (line.kind === 'xp') return { key: 'results.xp', params: { name, xp: line.amount } };
    if (line.kind === 'level') return { key: 'results.level', params: { name, level: line.level } };
    return { key: 'results.move', params: { name, move: move(line.move).name } };
  };

  function showResults() {
    if (!results) return;
    const state = results;
    const outcomeKey = state.outcome === 'win' ? 'results.win' : state.outcome === 'loss' ? 'results.loss' : 'results.draw';
    const lines = state.lines.length ? state.lines.map(l => t(l.key, l.params)) : [t('results.noXp')];
    const next = state.evolutions[0];
    if (next) {
      const p = save.party[next.index];
      // The evolved form's sprite starts loading now, so it's ready when the next battle starts.
      preloadSprites([next.to]);
      renderResults(overlayRoot, {
        title: t(outcomeKey),
        lines,
        prompt: t('results.evolving', { name: nameOf(p) }),
        buttons: [
          { label: t('results.evolve'), testid: 'evolve', primary: true, onClick: () => decideEvolution(true) },
          { label: t('results.stop'), testid: 'stop-evolution', onClick: () => decideEvolution(false) },
        ],
      });
      return;
    }
    renderResults(overlayRoot, {
      title: t(outcomeKey),
      lines,
      buttons: [
        {
          label: t('results.continue'),
          testid: 'continue',
          primary: true,
          onClick: () => {
            results = null;
            close();
            startNextBattle();
          },
        },
      ],
    });
  }

  function decideEvolution(accept: boolean) {
    if (!results) return;
    const { index, to } = results.evolutions.shift()!;
    const before = save.party[index];
    if (accept) {
      const evolved = evolve(before, to);
      save = { ...save, party: save.party.map((p, i) => (i === index ? evolved.pokemon : p)) };
      results.lines.push({ key: 'results.evolved', params: { name: nameOf(before), species: nameOf(evolved.pokemon) } });
      for (const m of evolved.moves) results.lines.push({ key: 'results.move', params: { name: nameOf(evolved.pokemon), move: move(m).name } });
      persist();
    } else {
      results.lines.push({ key: 'results.stopped', params: { name: nameOf(before) } });
    }
    showResults();
  }

  function battleFinished() {
    const { party, report } = afterBattle(save.party, sandbox.view().battle, TRAINER_BATTLE);
    const lines = report.lines.map(line => lineFor(line, party));
    let next = party;
    // Sandbox only: nobody left standing → everyone is healed for the next battle (the Pokémon Center comes later).
    if (next.every(p => p.hp === 0)) {
      next = next.map(heal);
      lines.push({ key: 'results.healed', params: {} });
    }
    save = { ...save, party: next };
    persist();
    results = { outcome: report.outcome, lines, evolutions: report.evolutions };
    screen = 'results';
    overlayRoot.hidden = false;
    showResults();
  }

  function showParty() {
    const member = (p: Pokemon, index: number) => {
      const s = species(p.speciesId);
      const atMax = p.level >= MAX_LEVEL;
      const from = xpForLevel(s.growthRate, p.level);
      const to = atMax ? from : xpForLevel(s.growthRate, p.level + 1);
      const options = specialOptions(p).map(slug => ({ value: slug, label: move(slug).name }));
      const change = (slot: 'elemental' | 'big') => (value: string) => {
        save = { ...save, party: save.party.map((q, i) => (i === index ? setSpecial(q, slot, value) : q)) };
        partyChanged = true;
        persist();
      };
      return {
        name: s.name,
        level: t('party.level', { level: p.level }),
        hp: p.hp === 0 ? t('party.fainted') : t('party.hp', { hp: displayHp(p.hp), max: displayHp(maxHpOf(p)) }),
        fainted: p.hp === 0,
        xpProgress: atMax ? 1 : (p.xp - from) / (to - from),
        xpText: atMax ? t('party.maxLevel') : t('party.toNext', { xp: to - p.xp }),
        specials: [
          { label: t('party.elemental'), testid: `special-elemental-${index}`, options, value: p.specials.elemental, onChange: change('elemental') },
          { label: t('party.big'), testid: `special-big-${index}`, options, value: p.specials.big, onChange: change('big') },
        ],
      };
    };
    renderParty(overlayRoot, {
      title: t('party.title'),
      members: save.party.map(member),
      language: {
        label: t('party.language'),
        options: LANGUAGES.map(l => ({ value: l, label: LANGUAGE_NAMES[l] })),
        value: save.settings.language,
        onChange: value => {
          if (!isLanguage(value)) return;
          save = { ...save, settings: { ...save.settings, language: value } };
          applyLanguage(value);
          persist();
          showParty();
        },
      },
      buttons: [
        { label: t('party.close'), testid: 'close-party', primary: true, onClick: toggleParty },
        {
          label: t('party.heal'),
          testid: 'heal',
          onClick: () => {
            save = { ...save, party: save.party.map(heal) };
            partyChanged = true;
            persist();
            showParty();
          },
        },
        {
          label: t('party.reset'),
          testid: 'reset-save',
          onClick: () => {
            if (!window.confirm(t('party.resetConfirm'))) return;
            save = freshSave(save.settings.language);
            partyChanged = true;
            persist();
            showParty();
          },
        },
      ],
    });
  }

  /** P: open the party (the fight pauses) or close it; changes start a new battle. */
  function toggleParty() {
    if (screen === 'results') return;
    if (screen === 'party') {
      close();
      if (partyChanged) startNextBattle();
      partyChanged = false;
      return;
    }
    screen = 'party';
    overlayRoot.hidden = false;
    showParty();
  }

  // ── Input ──
  const keys = createKeyLatch();
  attachKeyboard(
    window,
    keys,
    {
      F1: () => sandbox.toggleDebug(),
      F2: () => sandbox.cycleOpponent(),
      F3: () => sandbox.toggleInfinitePp(),
      F4: () => sandbox.cycleStyle(),
      KeyR: () => sandbox.reset(),
      KeyP: toggleParty,
      Escape: () => screen === 'party' && toggleParty(),
    },
    { paused: () => screen !== 'none', alwaysOn: ['KeyP', 'Escape'] },
  );

  // ── Loop ──
  // Inputs are read right before each simulated frame, so a press is used on the very next frame.
  const simulate = () => {
    if (screen !== 'none') return;
    const events = sandbox.tick(keys.sample() | readFirstPad().mask);
    if (events.some(e => e.type === 'battleOver')) battleFinished();
  };
  const clock = createFixedStep(simulate);
  const draw = () => render(ctx, sandbox.view());

  let startWasHeld = false;
  let last: number | undefined;
  function onAnimationFrame(now: number) {
    // A controller's Start presses the open screen's main button.
    const start = readFirstPad().start;
    if (start && !startWasHeld && screen !== 'none') pressPrimary(overlayRoot);
    startWasHeld = start;
    if (!options.manualClock && last !== undefined) clock.advance(now - last);
    last = now;
    draw();
    requestAnimationFrame(onAnimationFrame);
  }
  requestAnimationFrame(onAnimationFrame);

  if (options.enabled) {
    installTestHooks({
      frame: () => sandbox.view().battle.round.frame,
      step(frames) {
        if (!options.manualClock) throw new Error('step() needs the manual clock (remove &clock=real)');
        for (let i = 0; i < frames; i++) simulate();
        draw();
        return sandbox.view().battle.round.frame;
      },
      snapshot: () => structuredClone(sandbox.view().battle.round),
      battle: () => structuredClone(sandbox.view().battle),
      debug: () => {
        const view = sandbox.view();
        return { overlay: view.debug, opponent: view.opponent, style: view.style, infinitePp: view.infinitePp, advantage: view.advantage };
      },
      save: () => structuredClone(save),
      manualClock: options.manualClock,
      seed: options.seed,
    });
  }
}
