# Poké Fight

A study project: a real-time 2D fighting game (in the style of KOF / Street Fighter) with a Pokémon journey around
it. Pick a starter, hunt and catch, level up, evolve, beat the gyms and the League. You control your Pokémon directly
with a keyboard or a controller.

It runs locally in the browser and is not distributed. Pokémon sprites and data are used only for convenience.

The design and the roadmap are in [plan.md](plan.md).

## Development

```bash
npm install
npx playwright install chromium   # first time only
npm run dev        # http://localhost:5173
npm test           # game logic tests (Vitest)
npm run e2e        # plays the real game in a browser (Playwright)
npm run typecheck  # type check (game + browser tests)
npm run data       # rebuild src/data/generated/ from PokeAPI (only when the data script changes)
```

Sprites are loaded from the PokeAPI sprites repository on GitHub, so playing needs an internet connection.

`npx playwright test --ui` shows the browser tests running. After a failure, `npx playwright show-report` has
screenshots and a step-by-step trace.

Test mode: open `http://localhost:5173/?test=1` for a fixed seed and a manual clock. In the console,
`__pf.step(60)` advances one second of game time. Add `&clock=real` to keep the real clock, and `&seed=N` to choose the seed.

## Status

Milestone 7 (the world) done: after the prologue (title, the Professor, your starter, a tutorial fight against
your rival), travel Kanto's cities on the world map, hunt in the grass, caves and water (with a fishing rod), catch
wild Pokémon with Poké Balls, fight trainers on the battle field for money, buy items, heal at the Pokémon Center and
organize your party in the PC box. Pokémon level up, learn moves and evolve; progress is saved in the browser.
English and Portuguese. Training (from the title) is a practice mode with Lv. 30 teams.
WASD or arrows move (steer jumps in the air), J tackle, K elemental special (¼ PP), I big special (full PP), L guard,
Space dash (+ back: back dash). F1 debug overlay, F2 player 2 (dummy behaviors, CPU easy / normal / hard), F3 infinite
PP, F4 CPU style, P party, R reset, Esc leave. `?opponent=cpu-hard` (or `stand`, `guard`…) in the URL picks player 2
in fights. Next: milestone 8, gyms (badges open the next cities), the Safari Zone and the mall's evolution stones. See [plan.md §9](plan.md#9-roadmap-milestones).
