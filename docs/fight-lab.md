# The fight lab

The fight is the core of the game, so changes to it are measured, not guessed. The lab plays thousands of fights
between CPUs, the same fights the game plays, and turns them into numbers with their margins of error. Use it before
and after any change to the fight rules, the frame data, the CPU, or the economy.

```bash
npm run sim -- report                       # the standard report: side fairness, difficulty ladder, mechanics
npm run sim -- report --baseline docs/fight-lab/baseline.json   # …compared with the accepted numbers
npm run sim -- forms                        # each big special form against the others
npm run sim -- matchup --a charizard --b blastoise --level 50
npm run sim -- economy                      # prize money and prices along a journey
npm run sim                                 # every experiment and option
```

## How it works

- **The real code.** `src/sim/` drives `fight/step.ts` with `fight/ai/cpu.ts` on both sides, exactly as a fight in
  the game does (`scripts/sim.mjs` loads the TypeScript through Vite). Nothing is modelled or simplified, so a
  result is about the game itself.
- **Deterministic.** The same sides and seed always play the same fight. A surprising result can be replayed, and
  `--seed 2` checks that it isn't luck.
- **Fast.** About 15 ms a fight. The standard report (2,800 fights) takes under a minute.
- **Fair comparisons.** Duels are **mirrors** (both sides get the same Pokémon, drawn from a pool of 24 fully evolved
  ones of every type), so what is measured is the CPU or the rule, not a species matchup. Sides alternate, so neither
  profile gets player 1's small advantage.

## The method

1. **Ask a question you can measure.** "The CPU should guard elemental specials more" becomes "what share of
   elemental specials land?" If the report doesn't have the number, add it (`src/sim/experiments.ts`).
2. **Measure before.** Run the experiment and save it: `--json docs/fight-lab/baseline.json` (or compare with the one
   already there).
3. **Change one thing.** One change at a time, or you won't know which one did what.
4. **Measure after, against the baseline:** `--baseline docs/fight-lab/baseline.json`. The last column says whether a
   change in a win rate is **real at 95%**: the two intervals don't overlap. Anything else may be noise.
5. **When the number moves the wrong way, find out why before changing more.** Write a throwaway probe that breaks
   the number down (by distance, shape, what the defender was doing). Delete it after.
6. **Keep the result.** Pin the important number in a Vitest test (a smoke test with a few fights; the lab has the
   precise number in its comment), write the decision in plan.md, and save the new baseline.

### Reading the numbers

- A win rate prints as `62% (57%–67%)`: the observed rate and its 95% interval (Wilson). With 400 duels the interval
  is about ±5 points; with 100, about ±10. Two rates whose intervals overlap are not known to differ.
- `--n` sets the duels per matchup. Use 200–400 to decide something, 20–50 to explore.
- Averages (fight length, uses per fight) are per side, per fight, unless they say otherwise.

### Watch these

| Metric | Healthy | Why |
|---|---|---|
| `sides.p1` | 45–55% | Two identical CPUs: the fight must not favor a side. |
| Ladder, hard vs normal | 60–75% | Difficulties must feel different, without hard being unbeatable. |
| Ladder, normal vs easy | 70–85% | |
| Fight length (median) | 12–25 s | Shorter: hits too strong. Longer: too much guarding. |
| Time-outs | under 5% | Fights should end in a knockout. |
| Damage share, tackle | under 75% | Specials must matter. |
| Specials that land (hard) | 15–35% | Too high: the CPU doesn't defend. Too low: specials are useless. |
| Big special forms | each within 35–65% | No form much better than the others. |
| Comebacks (wins from 50% behind) | 3–15% | A big lead should usually hold, but not always. |

## Experiments

| Name | Question |
|---|---|
| `sides` | Two identical CPUs with the same Pokémon: does player 1 win about half the time? |
| `ladder` | How often does each difficulty beat each other one? |
| `styles` | Does any CPU style (balanced, aggressive, defensive, zoner) win too often? |
| `mechanics` | Fight length, damage by source, how often each mechanic is used, specials that land, comebacks. |
| `forms` | With everything else equal, how often does each big special form win against the others? |
| `matchup` | One species against another, both played by the same CPU. |
| `economy` | What a battle-field battle pays at each stage of a journey, and how many of them each item costs. |

To add one: a function in `src/sim/experiments.ts` (or its own file) that returns a `Report` (tables to read,
metrics to save), registered in `src/sim/cli.ts`, with a tiny run in `src/sim/sim.test.ts`.

## Worked example: the CPU after milestone 13

The question was "the CPU should guard and jump elemental specials more". Measured with `report --n 400`, hard CPUs:

| Metric | Before | First try | Final |
|---|---|---|---|
| Elemental specials that land | 35% | 41% | **20%** |
| Big specials that land | 13% | 28% | **13%** |
| Hits guarded per fight | 1.58 | 1.11 | **2.18** |
| Back attacks / counters per fight | 0.10 / 0.38 | 0.19 / 0.54 | **0.24 / 0.69** |
| Hard beats normal | 73% | 66% | **62%** |

- **The first try made it worse.** A guard pressed late lands in the parry window, so the first version turned those
  late guards into hits (a parry only some of the time). 28% of big specials landed instead of 13%: the opposite of
  the goal. An A/B run with the old rule confirmed it, and the rule was dropped.
- **A probe found the real cause.** Broken down by distance, projectiles thrown from 70–150 px landed 67–80% of the
  time against a normal CPU. From there a projectile arrives faster than its reaction, and the CPU only answered
  projectiles in flight. It now guards a projectile's charge when it is closer than 160 px. Elementals landing went
  from 49% to 35% (normal) and from 34% to 20% (hard).
- **The cost.** Tackles now deal 70% of the damage (62% before). Watch it: if specials feel weak, they need a buff
  (speed, chip), measured the same way.

## Files

- `src/sim/duel.ts`: one fight, CPU against CPU, everything counted.
- `src/sim/experiments.ts`: the experiments.
- `src/sim/economy.ts`: the economy table.
- `src/sim/stats.ts`: Wilson intervals, quantiles.
- `src/sim/cli.ts`: the command line (markdown output, `--json`, `--baseline`).
- `scripts/sim.mjs`: runs the CLI through Vite.
- `docs/fight-lab/baseline.json`: the accepted numbers. Save it again (`report --n 400 --json …`) when a change is
  accepted.
