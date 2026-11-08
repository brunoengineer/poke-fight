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
```

`npx playwright test --ui` shows the browser tests running. After a failure, `npx playwright show-report` has
screenshots and a step-by-step trace.

Test mode: open `http://localhost:5173/?test=1` for a fixed seed and a manual clock. In the console,
`__pf.step(60)` advances one second of game time. Add `&clock=real` to keep the real clock, and `&seed=N` to choose the seed.

## Status

Milestone 2 (full move set) done: a 3 vs 3 battle against a training dummy, still with placeholder rectangles.
WASD or arrows move (steer jumps in the air), J tackle, K elemental special (¼ PP), I big special (full PP), L guard,
Space dash (+ back: back dash). F1 debug overlay, F2 dummy behavior, F3 infinite PP, R reset. Next: milestone 3,
the CPU. See [plan.md §9](plan.md#9-roadmap-milestones).
