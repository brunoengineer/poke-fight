# Poké Fight — notes for Claude

A real-time 2D fighting game (KOF / Street Fighter style) with a Pokémon journey around it. It's a **study project**:
the user is practicing building a project from zero with Claude, one small, tested step at a time. It is **never
distributed** (no deploy, no hosting); Pokémon sprites and data are used only for convenience.

- **The design lives in [plan.md](plan.md)**: vision, mechanics, architecture, roadmap, decided and open questions.
  Read the relevant section before starting a task. When a decision is made, update plan.md in the same change.
- Work one milestone (or part of one) at a time: plan → implement → tests → the user reviews → **the user commits**.
  Never commit or push; when asked for git commands, write them out for the user.

## Commands

```bash
npm run dev        # http://localhost:5173
npm test           # Vitest: rules and simulation (src/**/*.test.ts), through scripts/vitest.mjs
npm run e2e        # Playwright: the real game in Chromium (e2e/)
npm run typecheck  # src + e2e
npm run data       # rebuild src/data/generated/ from PokeAPI (committed; the game never calls PokeAPI)
```

Run all three before saying a task is done. CI (`.github/workflows/ci.yml`) runs the same on every push.

## Architecture rules

- `src/fight/` (including `fight/ai/`, the CPU) and `src/game/` are **pure**: no DOM, no `window`, no time, no `Math.random`. They never import from
  `render/`, `screens/`, `state/` or `ui/`. Randomness comes from `engine/rng.ts` (seeded, its state lives in the
  game state).
- The simulation advances in fixed 1/60 s steps (`engine/loop.ts`). Rendering only reads the state.
- Fight positions are whole numbers in sub-pixels (planned: 1 px = 256 units), never floats.
- Menus are DOM (with `data-testid` for tests); only the fight is drawn on the canvas (480×270, whole-number scale).
- Content (regions, cities, gyms, shops, encounters) is data, not code. Pokémon data comes from
  `scripts/build-data.mjs` into `src/data/generated/`; read it through `src/data/pokedex.ts` and `src/data/types.ts`.
- Layers: `data/` (generated + typed access) → `game/` (Pokémon, stats, moves: owned Pokémon → fighters) →
  `fight/` (the fight, which only knows `FighterSetup`, never species). `fight/` may read `data/types.ts` (the chart).
- Damage is never a fixed number: tests compute expected damage with `fight/damage.ts` (helpers in `fight/testing.ts`).

## Texts and saves

- **Every text a player sees goes through `t()`** (`src/i18n/`), in English (`en.ts`) and Portuguese (`pt.ts`). A test
  fails if a text is missing in either language or their `{placeholders}` differ. Pokémon and move names come from
  the data (English) and are not translated. The debug overlay may stay in English.
- **Changing the save format**: bump `SAVE_VERSION` in `src/state/save.ts`, add a migration from the old version, and
  keep a fixture of the old format in `src/state/fixtures/` (every fixture must keep loading).

## Testing rules

- Every feature adds tests: Vitest for rules and frame-exact behavior, Playwright for flows the player sees.
- Playwright opens the game with `?test=1` (see `src/test/hooks.ts`): fixed seed, **manual clock** (`window.__pf.step(n)`),
  read-only access through `window.__pf`. Use `e2e/helpers.ts` (`openGame`, `step`, `frame`); it fails a test on any
  console error and stubs requests to other sites.
- Browser tests can't import game code that loads the JSON data (Node needs an import attribute): use type imports,
  or copy small constants into `e2e/helpers.ts`. `openGame(page, params, { save })` starts from a saved game
  (`fixture('save-v2-….json')`). By default it opens Training (`scene: 'training'`, the demo without a save); pass
  `scene: 'title'` (or `'city'`, with a journey save) to start elsewhere. `window.__pf.scene()` says where the app is.
- Never use `waitForTimeout` to wait for the game to do something: step the clock, or `expect.poll` for real-clock
  tests. (Waiting is only fine to prove that nothing happens, as in `e2e/boot.spec.ts`.)
- Balance numbers (frame data, damage, catch rates) are pinned in tests on purpose. A change that breaks them is either
  a bug or a design change, and then plan.md and the test change together.

## Environment

- Windows 11, Node 24. Commands run in Git Bash or PowerShell.
- If a shell starts in `c:\…` (lowercase drive), Vitest loads itself twice and every test file fails with
  "reading 'config'". `npm test` avoids it through `scripts/vitest.mjs`, so always use `npm test`, not `npx vitest`.
- The Playwright dev server uses port 5288 (not 5173 or poke-gacha's 5199).

## Style

- TypeScript strict. Short comments that explain **why**, in plain English.
- Small files grouped by feature; names that say what things are.
