# Poké Fight — Project Plan

A study project: a real-time 2D fighting game (in the style of KOF / Street Fighter) with a Pokémon journey around it:
pick a starter, hunt and catch, earn XP, evolve, beat the gyms and the League. It runs in the browser on your own
machine only. **It is not distributed**: no store, no public link. Pokémon sprites and data are used only
because they are convenient. (Exception, to study deploying: a private GitHub Pages deploy, see §7.1.)

The second goal matters as much as the game: **practice building a project from zero with Claude**, one small,
tested step at a time (see [How we work](#10-how-we-work-with-claude)).

> Status: **draft for discussion**. Items marked ❓ are open decisions (listed in [§11](#11-open-questions)).

---

## 1. Vision in one paragraph

You are a new trainer in Kanto, where Pokémon battles are now fought **live**: two trainers stand at the edges of an
arena, throw their Pokéballs, and their Pokémon fight in real time. You control your Pokémon directly with a keyboard
or a controller. The fight is simple to learn (move, jump, physical attack, special attack, guard) but has to feel
**precise and responsive**: every press counts, on the exact frame. Around the fights is a classic journey,
chosen from menus: cities, hunting grounds, shops, gyms, and finally the League. The data comes from the official
games (stats, types, learnsets, evolutions, encounters, catch rates).

## 2. Pillars (what we never compromise on)

1. **Responsive controls.** Input is read every simulation frame, with no added delay. A buffered press runs on the
   first frame it can. Target: action starts ≤ 1 frame after the key is pressed. This is measured by tests, not guessed.
2. **Deterministic fight engine.** Same seed + same inputs = same fight, every time. This makes it testable
   (Vitest replays, Playwright frame stepping) and debuggable.
3. **Simple to play.** Few buttons, and the variety comes from Pokémon, types and levels, not long combo inputs.
4. **Data, not code, for content.** Regions, cities, gyms, encounters and shops are data files. Adding region 2 means
   adding data, not rewriting systems.
5. **Every feature ships with tests.** Logic in Vitest, the whole flow in Playwright, all running in CI.

## 3. Story (draft)

Our own light narrative on top of the canonical Kanto structure (cities, gym order, gym types, League).

- **Prologue — Pallet Town.** The Professor explains that Kanto adopted *Live Battles*: Pokémon now fight in real time
  in arenas. You choose a starter (Bulbasaur, Charmander, Squirtle). Your rival picks the starter that has the type
  advantage over yours.
- **Tutorial fight — the rival.** An interactive tutorial against the rival: on-screen prompts teach movement → jump →
  physical attack → air attack → guard → special (with charge). The rival AI is very passive at first and the fight
  can't really be lost (the tutorial checks off each step). Win or lose, the story moves on (like the original games).
- **The journey.** Each badge unlocks the next city. The rival shows up at fixed points (e.g., after badges 2, 4 and 7),
  each time stronger and with a bigger team.
- **Region finale.** Elite Four, then the Champion: your rival.
- **Next region.** After the credits, you "travel" to region 2: a new journey with new cities, gyms and a League.
  ❓ What carries over (whole party? only one Pokémon? Pokédex and money?).

**Built in milestone 6** (pinned by `tutorial.test.ts`, `save.test.ts`, `e2e/prologue.spec.ts`):

- **Title**: Continue (with who and where), New game (asks before erasing a journey), Training, language.
- **Story**: the Professor (no name: "Professor") talks in dialogue boxes, one line at a time. Original texts in
  English and Portuguese. The player names themself and the rival (original defaults: **Kai** and **Ren**; up to
  12 characters; empty → default).
- **Starter**: Bulbasaur, Charmander or Squirtle, Lv. 5; the Professor teaches Vine Whip / Ember / Bubble; the rival
  takes the starter that beats yours.
- **Rival tutorial** (7 guided steps, each checked from real fight events): walk forward, jump, land a tackle, land
  an air attack, guard the rival's attack, dash, land the elemental special. During the guided steps the rival only
  attacks in the guard step, both Pokémon stay at full HP, the clock stops and the special step always has enough
  PP. Then "Now win the battle!" against an easy CPU, with the rival at half HP. Win (XP) or lose, the story goes on;
  the starter rests (full HP) and the journey starts at home in **Pallet Town** (decided after milestone 11; it
  used to drop the player in Viridian City), with Route 1's grass right outside.
- **City screen** (milestone 7 fills it in): Battle field (training), Party, Title.
- **Training**: with a journey, your party against a trainer with three different Pokémon picked at random from the
  city's own hunting grounds (grass, caves, water, Safari; the region's common ones fill in where a place has fewer),
  at your party's average level (XP counts, Continue goes back to the city); without one, the Lv. 30 demo teams (no XP). Esc leaves Training. The
  training tools (F1–F4, R) are off in the tutorial.
- **Save version 2**: player and rival names, starter, prologue stage, location. Version 1 saves migrate to a
  journey already at Viridian.

### Kanto progression (canonical order, simplified for menus)

| # | City | Gym type | Unlocks after | Notes |
|---|------|----------|---------------|-------|
| 0 | Pallet Town | — | start | Starter, rival tutorial, home (heal) |
| 1 | Viridian City | (Ground, last gym) | tutorial | **First shop (Poké Mart)**, gym locked until 7 badges |
| 2 | Pewter City | Rock | Viridian | Viridian Forest grass between them |
| 3 | Cerulean City | Water | Badge 1 | Mt. Moon (mountain/cave) on the way; Old Rod → water hunting |
| 4 | Vermilion City | Electric | Badge 2 | |
| 5 | Lavender Town | — | Badge 3 | Pokémon Tower (Ghost hunting) |
| 6 | Celadon City | Grass | Badge 3 | ❓ Celadon has the canonical department store |
| 7 | Fuchsia City | Poison | Badge 4 | **Safari Zone** |
| 8 | Saffron City | Psychic | Badge 5 | ❓ "Big mall" here (your idea) or at Celadon? |
| 9 | Cinnabar Island | Fire | Badge 6 | Needs Surf; fossils? |
| 10 | Viridian Gym | Ground | Badge 7 | |
| 11 | Indigo Plateau | League | 8 badges | Elite Four (Ice, Fighting, Ghost, Dragon) + Champion |

## 4. Fight mechanics

### 4.1 The arena

- Side view, a single flat stage with a background per place, painted by code (`render/stage.ts`): route, forest
  (grass around Pewter), cave, sea (fishing), gym (lit in the leader's type color), League hall, Safari, and the
  stadium (trainers' battle field, Training).
- **Trainers** stand at the left and right edges (small pixel figures, `render/trainers.ts`). The **entrance**
  (`screens/entrance.ts`, 72 frames): the trainer throws a Poké Ball → it arcs → bursts open → the Pokémon grows out of
  the light (and cries) → "FIGHT!". After a KO, only the side sending a new Pokémon throws. The fight waits for it.
- Wild battles (and the Safari): no trainer on the right; the wild Pokémon leaps in from off-screen.
- HUD: rounded panels with name, level and type badges, a gradient HP bar with a **damage trail** (the lost part
  drains away after a moment), the PP bar (glowing when the big special is ready), a Poké Ball per team member, the
  timer. A type-effectiveness text pops up on hit ("Super effective!").
- Effects (`render/fx.ts`, purely visual): hit sparks and rings, block rings, KO bursts, dust on dashes and landings,
  charge particles, projectile trails, screen shake.

### 4.2 Controls (MVP)

| Action | Keyboard (default) | Controller | Notes |
|--------|--------------------|------------|-------|
| Move | ← → (or A/D) | D-pad / left stick | Walk (walking back does **not** guard) |
| Dash | Space | LB / L1 | **Dedicated button**: forward dash; + back = back dash (its first frames can't be hit) |
| Jump | ↑ (or W) | D-pad up / A | Neutral, forward and back jump arcs |
| Physical attack | J | X / □ | Lunge at the opponent ("tackle"); also in the air |
| Elemental special | K | Y / △ | Short charge, then the move; also in the air |
| Free elemental special | back, down, forward + J | the same motion + X | The motion input: the elemental special **without PP** (§4.3) |
| Big special | I | B / ○ | Needs a **full PP bar** + a long charge; ground only |
| Guard | L (hold) | R1 / RB (hold) | **Dedicated button**, ground only (no air guard); can't move while guarding |
| Pause | Esc | Start | |

Every action's key can be rebound on the **Controls** screen (title or city): one key per action, the arrows always
move, the game's keys (Enter, Esc, P, R, M, F1–F4) can't be taken, and picking a key another action uses swaps them.
Saved in `poke-fight.settings` (not the save: a new game keeps them). Texts that name keys follow the bindings
(`{keyPhysical}`… in i18n). Controllers use the browser Gamepad API (polled every frame).
**Menus** work without a mouse: arrow keys / d-pad move between buttons, Enter / A presses, B goes back, Start presses
the main button. **M** turns the sound off and on. **Select / View** (Tab) opens the world map from the city, and
closes it again (after milestone 12: changing cities quickly).
**No crouch** for now (so there are no high/low attacks): ↓ (S, the arrow, d-pad or stick) only counts in the motion
below; on its own it does nothing in a fight (and moves the cursor on the battle's menus).

### 4.3 Moves and frame data

Every action has **startup / active / recovery** frames (60 frames = 1 second). Starting values, to be tuned
with the debug overlay:

| Move | Startup | Active | Recovery | On hit | Notes |
|------|---------|--------|----------|--------|-------|
| Physical (ground) | 5 | 4 | 12 | knockback, short hitstun | Moves the attacker forward (the lunge) |
| Physical (air) | 4 | 6 | lands | hits jumping-in | |
| Elemental special | 14 (charge) | depends on shape | 18 | depends on shape | Costs ¼ PP; vulnerable during charge; a hit cancels it (the PP comes back) |
| Big special | 40 (charge) | depends on shape | 30 | big knockback, long hitstop | The full PP bar is spent when the charge starts; a hit during the charge cancels it and gives the PP back |
| Jump | 3 (pre-jump) | ~36 airborne | 2 (landing) | — | **Can be steered in the air** (left/right) |
| Guard | 1 | while held | 3 (release) | blockstun, chip damage on specials | Blocks everything (no lows yet) |
| Dash (fwd / back) | 2 | ~14 moving | 4 | — | **Back dash: invincible on frames 1–6**, then hittable until it ends (so it can be punished) |

- **Input buffer**: a press is remembered for 6 frames, so it fires as soon as the current action ends.
- **Motion input** (decided 2026-11-09, pinned by `motion.test.ts`): **back, down, forward, then the physical attack**
  (← ↓ → J facing right, → ↓ ← J facing left, as in fighting games) performs the **elemental special for free**: the
  same move, charge, shape and damage as K, but it **spends no PP** (it works with an empty bar) and **earns none**
  when it lands (otherwise it could farm the bar for the big special). Rules:
  - Back, down and forward must fit in **20 frames** (from the first back frame to the first forward frame, both
    counted), and the attack must be pressed **0–8 frames** after forward is reached (holding forward and pressing
    later is a tackle).
  - Diagonals count as both of their directions: ↙ is "back, down", ↘ is "down, forward" (so ← ↘ J and ↙ → J work).
  - The motion is checked on the frame the attack is pressed, with the facing of that frame, then buffered like any
    press (6 frames). A plain attack, a wrong order, or walking back then forward without ↓ is a tackle.
  - **Also in the air**, like the K special: it uses the jump's one air move, and landing before the charge ends
    finishes it from the ground.
  - The directions of the last 28 frames live in the fighter's state (`Fighter.directions`, `fight/motion.ts`), so
    replays stay exact. The CPU doesn't use it.
- **Hitstop**: both fighters freeze for 4–8 frames on hit (bigger for super effective hits). This is the "impact"
  feel, and it costs no input precision.
- **Hitboxes / hurtboxes**: rectangles per move frame, shown by the debug overlay (F1).

**Rules settled in milestone 1** (all pinned by tests in `src/fight/*.test.ts`):

- **Frame counting**: the frame an action starts on is its frame 1. A press is used on the same frame it is read
  (0 frames of input lag). A tap shorter than one frame still counts.
- **Physical attack**: 21 frames in total (5 / 4 / 12), hits on frame 6, hits only once, and is **+3 on hit**. The fighter
  can act again on frame 22. Holding the button doesn't repeat the attack.
- **Jump**: 3 frames on the ground, 36 in the air (apex 85.5 px), 2 to land. The direction is the one held on the
  **last grounded frame**, so up then up-forward still jumps forward. Holding up jumps again after landing. A jump
  can go over the opponent, and both turn around after landing.
- **Air control** (changed after playtesting): holding left/right in the air steers towards that direction's jump
  speed (2.5 px forward, 2 px back), reaching it in 5 frames; with no direction held the jump keeps its speed. Being
  hit into the air can't be steered.
- **Air attack**: one per jump. A hit in the air pops the defender up, then it stays down 20 frames after landing.
- **Dash** (changed after playtesting: a button instead of a double tap): Space / LB, buffered like attacks. Forward:
  70 px, and it **passes through the opponent** (no push box while dashing), so a dash from close range ends
  behind it, ready to attack from the other side (not at the wall: no room). Dash + back: back dash, 63 px,
  invincible on frames 1–6 (it still pushes). Walking never dashes by itself.
- **Opposite directions cancel out** (left + right = neutral), on keyboard and controller.
- **Hitstop 6 frames**: presses during hitstop are kept.
- **Trades**: two hits on the same frame both land (a double KO is a draw).
- **Facing** only changes while the fighter is free on the ground.
- **Training dummy** (player 2 until the CPU): F2 cycles stand / jump / attack every 30 frames / guard / special
  every 60 frames. F3 (training) keeps both PP bars full.

**Rules settled in milestone 2** (pinned by `guard.test.ts`, `specials.test.ts`, `timer.test.ts`, `battle.test.ts`):

- **Guard** (L / RB): active on the frame it is pressed, can't move while held, blocks everything on the ground from
  both sides (a dash through doesn't get around it). You can attack straight out of a guard; letting go takes 3
  frames. No air guard. Blocked hits give no PP. The tackle is **−1 on block**.
- **Parry** (decided after milestone 13): guard **pressed** (not held) at most 6 frames before a hit lands. No damage,
  no chip, both freeze 12 frames, a melee attacker staggers 20 frames, and the parrier's first hit within 24 frames
  does 1.5× ("Counter!"). Projectiles can be parried too (their thrower is out of reach). Holding guard is an
  ordinary guard, and letting go takes 3 frames, so mashing doesn't parry (`PARRY`, pinned by `bonus.test.ts`).
- **Back attack** (decided after milestone 13, to make dashing worth it): a dash that goes through the opponent makes
  the dasher's first hit within 30 frames after the dash ends do 1.5× ("Back attack!"). Only the first hit, landed or
  guarded; the dash's own recovery can still be punished (`BACK_ATTACK`).
- **Chip damage**: specials do ¼ of their damage through a guard, and chip can finish a Pokémon.
- **PP bar**: 100, starts at 50. Elemental special −25, big special −100 (needs a full bar), paid when the charge
  starts; a special that never comes out (hit during the charge) gives it back (decided after milestone 12: losing it
  felt like a bug). Landing: tackle / air attack +15, elemental +5, big +0. **Taking damage: +1 for every 2% of
  max HP lost** (decided after milestone 13; guarding gives nothing). A press without enough PP does nothing. The motion input's free elemental special (above) costs 0 and earns 0.
- **Elemental special**: 14-frame charge. Projectile: fired on frame 15 at 4 px/frame, 33 frames in total.
  Beam: hits on frames 15–20, up to ~230 px. Also in the air (shares the one air move per jump); landing before the
  charge ends doesn't lose it: the charge goes on from the ground and it fires there (decided after milestone 12: a
  special pressed late in a jump used to vanish with its PP).
- **Big special**: 40-frame charge, ground only, launches the opponent, 14 frames of hitstop and a white flash.
  Projectile (6 px/frame), full-screen beam, or Rush (9 px/frame for 24 frames, passes through).
- **Projectiles**: two elemental ones that meet cancel out; a big one goes through a small one.
- **Combo scaling**: −10% per hit in the combo, down to 40% (a late jump-in into a tackle combos).
- **Timer**: 99 s, paused during hitstop and after a KO. Time over: the lower HP % faints (both if equal).
- **Battle (6 vs 6)**: after a KO the bodies fall for 90 frames; the opponent sends its next Pokémon in order;
  player 1 picks from a menu (↑ ↓, J). The survivor keeps HP and PP, the newcomer starts at 50 PP, positions reset.
  Double KO of the last Pokémon is a draw. The sandbox teams are 3 placeholders each, one per special shape.

### 4.4 Specials come from the Pokémon's real moves

Each Pokémon has **two special slots**, both filled from the damaging moves it has learned (official learnsets by
level). You choose them in the party screen when the Pokémon learns a new move:

| Slot | Button | Use | Default pick |
|------|--------|-----|--------------|
| **Elemental special** | K | **Always a range attack** (projectile or beam). Short charge (14 frames), normal power, costs **¼ of the PP bar** | Best move of its own type (STAB) |
| **Big special** | I | Needs and spends the **full PP bar**, long charge (40 frames), **about half the HP bar** (below), screen flash + slowdown on hit | Highest-power move it knows |

Together with the tackle (J), every Pokémon has a close attack, a range attack and a big finisher.

**Big special damage** (decided after milestone 13: it spent the whole bar yet hit like an elemental special, with the
same formula and often the same move): a share of the defender's max HP, **45%** (×1.1 with the same-type bonus: about
half the bar between equals). Type effectiveness, the level ratio, the attack/defense ratio and the move's power still
count, softened (square roots, clamped: super effective ≈ 65–70%, resisted ≈ 35%, immune 0), and it stays between
**12% and 75%** (no knockout from full HP). **Guarded, 45% of it gets through** (≈ 20% of the bar); parried, nothing.
No combo scaling. A barrage's rock is 40% of it. Against a legendary boss, the share is of its own HP, not its ×4 bar
(`fight/damage.ts` bigDamage, pinned by `big-damage.test.ts`). Fight lab: the big special's share of all damage
3.9% → 8.7%, fights 1 s shorter, fairness and the ladder unchanged.

**PP bar** (decided): one per Pokémon, shown under its HP bar.

- Starts **half full** when the Pokémon enters a fight, so it can open with a range attack (2 shots).
- Fills when your attacks land: the tackle and the air attack fill the most, so the loop is
  "get in with physical hits → earn PP → spend it on range attacks or save it for the big special". **Taking damage
  fills it too** (+1 per 2% of HP lost; decided after milestone 13, as most fighting games do: the side being beaten
  gets its specials sooner). Guarding doesn't fill it, so turtling never does. Starting numbers to tune: tackle / air attack +15%, elemental special +5%,
  big special +0%.
- Not shared: in a 6 vs 6 battle, each Pokémon comes in with its own half-full bar.
- Why PP **and** a charge: PP controls *how often* (no spamming projectiles from across the screen), the charge
  adds the *risk* (the opponent can see it coming and hit you first: you take the hit and lose the moment; the PP
  comes back, since PP only pays for a special that comes out).

Other rules:

- Both slots can hold the same move (useful early on, when a Pokémon knows only one damaging move).
- A Pokémon with no damaging move at all (Magikarp, Abra, Metapod…) uses **Struggle** (Normal) in both slots, as in
  the games: a weak shockwave as its range attack, a rush as its big special.
- Starters get their first type move from the Professor (Ember / Bubble / Vine Whip), so the tutorial can teach
  the elemental special at Lv. 5.

The move's **type and power** come from the data; its **shape in the fight** comes from the slot and an
*archetype* we assign to each move:

| Shape | Behavior | Slot | Examples |
|-------|----------|------|----------|
| Projectile | Travels across the screen | Elemental or big (bigger, faster) | Ember, Water Gun, Thunder Shock, Razor Leaf |
| Beam | Instant long-range hit after the charge | Elemental or big | Psybeam, Aurora Beam; big: Hyper Beam, Solar Beam |
| **Rush** (decided: the "big dash") | The Pokémon charges across the screen, passing through and hitting hard: **physical damage** | **Big only** | Take Down, Body Slam, Double-Edge, Skull Bash |
| Quake, Surf, Tornado, Solar, Blizzard, Burst, Strike, Barrage | By the move's type (milestone 13, §4.9) | Big only | Earthquake, Hydro Pump, Flamethrower, Solar Beam… |

- In the **elemental slot every move becomes a range attack**: physical contact moves (Scratch, Karate Chop, Vine
  Whip) turn into a short projectile or shockwave of their type.
- In the **big slot**, the form comes from the move's type (§4.9: a Ground move is a quake wave, a Fire move a
  tornado…); Normal moves keep the old rule: physical → **Rush**, special → beam.

More archetypes can come later (status effects: paralysis = slower, burn = damage over time, etc.).

### 4.5 Damage, types, stats

- **Stats** come from the official formula (base stats + level + DVs/IVs). Mapping to the fight:
  - HP → HP bar; Attack/Defense → physical damage dealt/taken; Sp. Atk/Sp. Def → special damage;
    Speed → walk/dash speed and jump arc (not frame data, to keep timing readable).
- **Damage** is an adapted Pokémon formula:
  `((2·L/5 + 2) · Power · A/D / 50 + 2) · STAB(1.5) · typeMultiplier · roll(0.9–1.0) · FIGHT_SCALE`
  with `FIGHT_SCALE` tuned so a fight between equal levels lasts ~30–45 seconds.
- **Type chart: the modern one (18 types, Gen 6+), for every region.** Decided because it scales best:
  - One chart for the whole game, so a Pokémon behaves the same in every region (with per-region charts, your
    Clefairy would change type when you travel).
  - It's what PokeAPI returns by default (old typings are only in `past_types`), so the data script stays simple.
  - New regions never need chart changes, only new species.
  - In practice: Kanto uses **modern typings and move data** (Clefairy is Fairy, Magnemite is Electric/Steel,
    Bite is Dark, Gust is Flying). Learnsets: see **Official learnsets** below.
- **Official learnsets** (decided 2026-11-14, replacing "the region's own games"): every species learns by level
  up from **HeartGold/SoulSilver's** lists (then Platinum's, then its region's games, for any species they lack). They
  are the last official games with all 493 species and full level-up lists; Red/Blue's were so thin that a Lv. 30
  Psyduck knew only Scratch and Tail Whip, and 94 of the 151 had fewer than 3 damaging moves at Lv. 30 (now: 11).
  `node scripts/build-data.mjs --learnsets` refreshes only the learnsets. The species left with few damaging moves at
  Lv. 30 (54 of 493: Magikarp, Abra, Chansey, Snorlax, Wobbuffet, the Lake trio, babies…) have official movepools
  that are thin too; that is kept, not padded.
  - **A species learns its earlier forms' moves too** (`learnable` in `game/moves.ts`), each at the lowest level any
    of them learns it. So **evolving early never costs a move**: a Raichu from a Lv. 10 Pikachu (Thunder Stone) still
    learns Slam at 21, Discharge at 37 and Thunder at 45; a caught Charizard knows Ember.
  - **Evolving teaches** every move the new form would know at its level that the Pokémon doesn't (its Lv. 1 moves:
    Raichu's Quick Attack and Thunderbolt). Nothing is ever forgotten.
  - **Save version 7**: every Pokémon in old saves (every journey, party and box) learns the moves the new lists give
    it at its level, after the ones it knew; its specials stay.
  - **Struggle is replaced** (fixed 2026-11-14): a Pokémon with no damaging move has Struggle in both slots. When it
    learns its first real one (a Magikarp's Tackle, a Metapod evolving, or the version 7 migration: a Metapod now
    learns Caterpie's Tackle), the slot gets the default pick (`repairSpecials`). Before, the save refused such a
    Pokémon and the whole game was set aside. Loading also repairs any special that is no longer an option instead
    of refusing the save, and **a save kept aside comes back** by itself once the game can read it, if no new game
    was started since (`state/store.ts`). Checked against 2,925 Pokémon saved by the code from before (every species
    at Lv. 1, 5, 18, 36 and 100, evolved early, every special choice) and the endgame save: all load.
- **Combo scaling**: each hit in a combo does less damage (100%, 90%, 80%, … minimum 40%), so a lucky combo can't
  end a fight.
- **Physical attack type** (decided in milestone 4): the tackle has **no type** (always ×1, no STAB). With Normal,
  a Ghost could never be tackled, and a Normal-type knowing only Normal moves could never win against one.

**Built in milestone 4** (pinned by `data.test.ts`, `game.test.ts`, `damage.test.ts`):

- **Data**: `npm run data` (scripts/build-data.mjs) pulls Gen 1 from PokeAPI once into `src/data/generated/`
  (committed): 151 species (modern types and stats, base XP, growth rate, catch rate, evolutions, Red/Blue level-up
  learnsets, Red/Blue wild encounters), the 146 moves those learnsets use (+ the starters' gift moves and Struggle),
  and the 18-type chart. Evolutions into later generations (Eevee → Espeon) are ignored until their region exists.
- **Stats**: official Gen 3+ formula, every IV 15 for now (captures will roll their own), no EVs or natures.
- **Damage**: official formula with STAB and the type chart, **no random roll** (precision). × `DAMAGE_SCALE` 0.6:
  about 12 tackles between two equal average Pokémon at Lv. 50 (fewer at low levels).
- **HP in the fight is in tenths of real HP** (`HP_UNITS` = 10), so small low-level damage keeps chip and combo
  scaling meaningful; menus show real HP.
- **Big special = the move's own power** (not ×2: a super-effective, same-type big special one-shot).
- **No effect** (×0): the hit passes harmlessly (no damage, no hitstun) and says "No effect".
- **Speed**: base Speed sets walk, dash and jump speeds from 85% to 115%; frame data never changes.
- **Default specials**: elemental = strongest move of its own type (else strongest), big = strongest; "strongest"
  counts the same-type bonus; ties go to the move learned last. Never Self-Destruct, Explosion or Dream Eater.
  No damaging move: Struggle.
- **Sprites**: Gen 5 front sprites **loaded by URL** (decided: no local copy), trimmed to their pixels, mirrored to
  face right, posed by code (bob, squash, lean, shake, white flash, fall), with a shadow. Both teams preload when a
  battle starts. While a sprite loads (or in the browser tests, where images are stubbed) a type-colored rectangle
  stands in.
- **Sandbox teams**: Charmeleon, Kadabra, Machoke vs Geodude, Gastly, Butterfree (Lv. 30–34), with "Super
  effective!" / "Not very effective…" / "No effect" messages.
- Type advantage is strong, as in the games: a same-type, super-effective elemental special takes ~40% of an equal
  Pokémon's HP. Something to watch when we balance the journey.

### 4.6 Fight formats

- **Wild battle**: 1 vs 1, single round, no timer pressure ❓. Your Pokémon keeps the HP it ends with (heal at
  the Pokémon Center or with Potions).
- **Trainer / Gym / League**: like the real Pokémon games, up to **6 against 6, one at a time**. Each trainer's
  team size (1–6) comes from the data. When a Pokémon faints, its trainer recalls it and sends the next one:
  the CPU follows its team order. The Pokémon that stays keeps the HP it has left, and HP carries over after the
  battle. You lose when all your Pokémon have fainted (→ back to the last Pokémon Center, lose some money, like the
  games).
- **Choosing and switching** (after milestone 11; rules in `fight/battle.ts`):
  - After **every** faint (yours or theirs), you pick who fights the next round (a quick menu, the fight paused;
    your current Pokémon is selected, so J keeps it). With one Pokémon left there is nothing to pick.
  - **Mid-round, once**: Tab (controller: View) pauses on the same menu; Guard / Esc / the controller's B, or the
    same Pokémon, cancels without using the switch. The new Pokémon comes in with half a PP bar **where the old one
    stood**, the opponent keeps its HP, PP, place and whatever it was doing, and the round's clock keeps running: it
    is the same round, not a new one (no free reset, nobody teleports back to the start).
  - The menu reads the battle's own menu buttons (`Button.Confirm` / `Button.Cancel`): the tackle key or Enter or the
    controller's A sends, B cancels. (A also means "jump" in the fight, so a press with Confirm never moves the
    cursor.) The hint line shows the keys or the controller's glyphs, for the device in use.
  - After a switch, the next one is refused until a Pokémon faints (on either side); a message says so, and the HUD
    shows the switch as ready or used. No switching in the tutorial.
- **Time over**: the side with the higher % HP wins.

### 4.7 CPU / AI

- Pure function `decide(view, profile, rng) → inputs` running inside the simulation (deterministic).
- **Human-like limits**: the AI sees the state with a **reaction delay** (e.g., 8–20 frames), and makes mistakes on
  purpose (misses some guards and anti-airs).
- **Profiles** control aggression, guard rate, zoning (keeping distance and spamming specials), jump frequency and
  reaction time:
  - Wild: slow, random. Trainers: medium. Gym leaders: a style per type (Brock = defensive/guard, Misty = zoning,
    Surge = aggressive rush). Elite Four / Champion: fast reactions, punishes mistakes.

**After milestone 13** (decided; measured with the fight lab, `docs/fight-lab.md`):

- **It guards specials more**: guard chances up (easy 0.25, normal 0.65, hard 0.9), jumpable projectiles jumped at
  least 35% of the time, and a projectile special charged closer than 160 px is guarded on its charge (from there it
  arrives faster than a reaction). Elementals that land against a hard CPU: 35% → 20%; normal: 49% → 35%.
- **Parry**: a `parry` chance per difficulty (easy 0, normal 0.1, hard 0.3): it waits and times its guard to a
  projectile. A guard that comes late is a parry by the rules too (the hard CPU's quick reactions parry some charged
  specials, as a quick player would).
- **Comeback**: when its opponent leads by more than half an HP bar, it plays a step up the skill scale (normal like
  hard: faster, guards and punishes more) until the gap is under a quarter. Never easier when it is winning.
- **Dashes**: it dashes through more (a back attack pays), tackles at once with a bonus ready, and punishes the end
  of a dash.
- **Big special**: its long charge isn't started point-blank (it got hit out of it); only burst, blizzard and rush
  are used up close.

**Built in milestone 3** (`src/fight/ai/`, pinned by `cpu.test.ts`):

- `cpuStep(cpu, state) → { cpu, input }`: pure and seeded; the CPU's memory is plain data like the fight state.
- **Fair by construction**: it only outputs an input mask (it presses and releases buttons like a player, no
  turbo); it sees the opponent and projectiles **`reaction` frames late** but its own state now.
- **Profile = difficulty × style.** Difficulty (skill): easy / normal / hard = reaction 30 / 18 / 10 frames,
  guard 15 / 50 / 85%, anti-air 10 / 40 / 75%, punish 10 / 50 / 85%. Style (personality): balanced / aggressive /
  defensive / zoner = how much it approaches, keeps its distance, fires specials, jumps, uses the big special, and
  guards up close in advance.
- **One roll per threat**: a projectile coming (guard, or jump over it, estimating where it is *now*), a beam or rush
  being charged (guard), an attack up close (guard, lower chance: it can't really react to a 5-frame tackle), a
  jump-in (anti-air tackle or guard). Plus: punish recovery nearby, **guard right after being hit up close**, and
  **hit back right after blocking** (the tackle is −1 on block).
- Otherwise a short **neutral plan** by distance and style: approach, retreat, wait, guard, tackle, special, jump in,
  dash (through), back dash, big special (rush only from fairly close).
- **Measured balance** (20 fixed-seed fights each): hard beats easy 19/20 and normal 17/20; normal beats easy
  17/20; every level beats a player who does nothing in ~17–24 s; hard beats a slow tackle spammer 20/20.
- **Known weakness**: a fast tackle spammer (walk forward + tackle every 22–30 frames) still beats hard ~60% of the
  time. Partly the CPU, partly the frame data: the tackle is +3 on hit with a lunge and walking pushes back in, so
  it's a strong loop for humans too. To revisit when tuning with real Pokémon (milestone 4): less pushback/lunge,
  +1 on hit, or a CPU that reads repeated patterns.
- **Changed while building it**: a **guarded Rush now stops** at the defender (and can be punished); before, it
  carried on 100+ px past the defender and was safe even when guarded. A Rush that hits still passes through.
- Sandbox: F2 cycles player 2 (dummy behaviors, then CPU easy / normal / hard), F4 cycles the CPU style. The game
  starts against CPU normal; `?opponent=stand` (or any other) chooses player 2 from the URL (the browser tests do).

**A profile per opponent Pokémon** (after milestone 11; `game/ai.ts`, `ai.test.ts`):

- **Skill is a scale** from 0 to 1 (`skillAt`): 0 is a clumsy wild Pokémon (reaction 36, guards 5%), and easy /
  normal / hard are the points ⅓, ⅔ and 1 (the numbers above, unchanged).
- **Who controls it** sets the base: wild = 0; a trainer's Pokémon = the trainer's difficulty − 0.1 (battle field:
  normal; gyms and the League: their own). **Each evolution stage adds 0.1**, and the level up to 0.12 more (at 100).
  So a wild Pidgey is clumsy, a trainer's Pidgeot plays near normal, Giovanni's Rhydon plays at hard.
- **Style from its stats** (unless a leader sets one for the team): Sp. Atk well above Attack → zoner; defenses well
  above its attacks → defensive; a fast physical attacker → aggressive; else balanced.
- **A twist per Pokémon**: each personality number varies ±20%, so two of the same species don't fight alike.
- **No two fights the same**: every fight gets a fresh CPU seed (from its own random sequence, so it never changes
  which Pokémon appear), and the **first plan of a round is an opening** picked more freely (wait and watch, walk
  in, a special, jump in, back off, dash, guard). Before this, every fight used the session's seed, so the CPU
  opened the same way every time. The balance pins above still hold.

### 4.8 Legendary bosses (milestone 12)

A legendary in its sanctuary is a **boss** (`fight/boss.ts`, drawn by `render/boss.ts`): four times its HP
(`BOSS_HP_MULTIPLIER`), its own CPU, and a list of **boss attacks** (`FighterSetup.boss`) it goes through in order.

- **Rhythm**: the first attack after 4–6 s, then 5–7 s after each one ends; **enraged** below 30% HP (2.5–4 s).
  An attack starts only when the boss is free on the ground; between them it fights like any CPU.
- **Telegraph → active → recovery**: every attack warns first (a banner with its name and a hint, red marks on the
  floor). While locked in an attack the boss has **super armor** (it takes damage but is never stunned or pushed),
  or tackling would cancel every warning; not during the meteor rain, where it keeps fighting.
- **Damage**: the real formula with the boss's stats and first type, each part hitting once; against an immune type
  it hits typeless (an unavoidable attack is never cancelled by type).

| Attack | Warning | What happens | Power | Guard keeps | How to survive |
|---|---|---|---|---|---|
| Slash | 48 f | a crescent wave crosses the whole screen | 90 phys. | 25% | can't be dodged: guard |
| Nova | 54 f | a sphere grows to a 200 px radius (240 filled the screen) | 100 spec. | 25% | leave the circle, or guard |
| Meteor | 36 f | 5 s of meteors (15, or 22 enraged), each marked 36 f ahead, half aimed at the player | 50 spec. | 50% | stay off the marks while fighting |
| Quake | 42 f | two slams, a ground wave each way | 65 phys. | 50% | jump each wave |
| Rampage | 48 f | charges to the wall and back | 80 phys. | 25% | jump over it, or guard |
| Vortex | 36 f | pulls the player in for 2 s, then bursts (72 px) | 90 spec. | 25% | walk away, or guard |

The boss HUD: a gold frame, a crown, an HP bar in four segments (×4), LEGENDARY / ENRAGED!. Measured drawing cost:
under 4 ms a frame on average for the busiest attack (enraged meteor rain), at 1440×810.

### 4.9 Moves by type, signature moves, legendary moves (milestone 13)

Decided after milestone 12: the specials should look like the move's type, the famous Pokémon get a move of their
own, and a legendary on your team gets its boss attack. Four steps, each reviewed and committed on its own.

1. ✅ **The elemental special looks like its type** (`render/elements.ts`, purely visual: hitboxes and damage are
   unchanged). Each type has a projectile, a beam texture, a charge and particles:

   | Type | Projectile | Beam | Leaves behind |
   |---|---|---|---|
   | Normal | a spinning star (Swift) | twisting strands | glow |
   | Fire | a fireball with a flame tail | a flame stream | embers rising |
   | Water | a bubble (and small ones behind) | a jet with foam and spray | drops |
   | Electric | a crackling ball of bolts | lightning bolts only (no band) | sparks |
   | Grass | three leaves spinning | strands | leaves |
   | Ice | an ice shard with twinkles | ice crystals along it | snowflakes |
   | Fighting | an orange sphere with speed lines | strands | glow |
   | Poison | a sludge blob | strands | drops |
   | Ground | a clod of earth | strands | debris |
   | Flying | an air-slash crescent | strands | glow |
   | Psychic | **purple** energy with rings (the type's badge pink is for menus) | rings (Psybeam) | glow |
   | Bug | a swarm around a glowing core | strands | glow |
   | Rock | a spinning stone | strands | debris |
   | Ghost | a shadow ball with wisps | a dark band, glowing edge | smoke |
   | Dragon | a blue-violet flame orb with a spiral | strands | glow |
   | Dark | a black core in dark rings | a dark band, glowing edge | smoke |
   | Steel | a spinning gear | strands | sparks |

   The projectile forms in the charge's glow, so the player sees what is coming. Dark energy is painted over the
   scene (adding a dark color shows nothing); bright cores too, or they wash out to white on a bright stage. A
   projectile is drawn 20% bigger than its hitbox.
2. ✅ **The big special by type, with real hits** (`fight/frame-data.ts` BIG, `game/moves.ts` BIG_SHAPES, drawn by
   `render/ultimates.ts`). The move's type picks the form; the hit is what is drawn (drawings are at full size from
   their first active frame: a hit there freezes the game, and one still growing in would freeze smaller). Every
   form keeps the 40-frame charge and 30 frames of recovery; the form is how to survive it:

   | Form | Types | What hits | How to survive |
   |---|---|---|---|
   | Quake | Ground | a wave along the floor each way, to both edges (0–16 px high, 5 px/f) | jump it |
   | Surf | Water, Poison (Sludge Wave) | a wide wave (44 px), 72 px tall, 3.5 px/f | guard (a jump clears it only at its top) |
   | Tornado | Fire, Flying | a column 150 px tall (no jump clears it), 2.5 px/f | guard |
   | Solar | Grass | a beam across the screen, from the floor to 64 px, 12 frames | guard, or be at a jump's top |
   | Blizzard | Ice | a storm 170 px in front, 80 px high, 18 frames | back off, or guard |
   | Burst | Psychic, Dark, Fairy | a dome 95 px all around (behind too), 8 frames | stay away, or guard |
   | Strike | Electric (from the sky), Ghost (from the ground) | a column on the opponent's spot, locked 12 frames before (36 px wide) | move once it locks (a dash) |
   | Barrage | Rock (Rock Slide), Dragon (Draco Meteor) | three in arcs, landing 70 / 130 / 190 px ahead, half the power each | stand between them, or guard |
   | Projectile, Beam, Rush | Bug; Steel; Fighting | as before | as before |

   Normal moves keep the old rule (physical → Rush, special → beam). The warnings: a barrage marks its landing spots
   on the floor during the charge; a strike puts a reticle on the opponent that follows it, then locks (and flashes)
   12 frames before. The CPU guards what it can't jump (anything taller than a body, or falling from above), and
   uses the short-reach forms only close (burst < 85 px, blizzard < 150, barrage < 200, rush < 160).
3. ✅ **Signature moves** (`game/signatures.ts`): back, down, forward + attack (on the ground) is, for eleven famous
   Pokémon, a move of their own instead of the free elemental special. Greninja and Zoroark were asked for, but the
   game covers generations 1–4: Blaziken and Garchomp replace them. Each one is a big special's form (its timing and
   reach), all eleven different, of the Pokémon's type, hitting like an elemental special: power 90 (with the
   same-type bonus), no knockdown, free (no PP spent, none earned). Only the species named (not Raichu, not
   Charmeleon). Its name shows in a banner during the charge; the party screen lists it with its input.

   | Pokémon | Move | Form |
   |---|---|---|
   | Pikachu | Thunder | strike (a bolt on the opponent's spot) |
   | Charizard | Blast Burn | solar (a giant fire beam) |
   | Blaziken | Blaze Kick | tornado |
   | Lucario | Aura Sphere | projectile |
   | Gengar | Night Shade | burst (a dark dome) |
   | Gardevoir | Psychic | beam |
   | Kingler | Crabhammer | surf (a wave) |
   | Dragonite | Draco Meteor | barrage |
   | Lapras | Sheer Cold | blizzard |
   | Flygon | Earth Power | quake |
   | Garchomp | Dragon Rush | rush |
4. ✅ **Legendary moves**: a legendary on the player's team (any one of a sanctuary) has **down, down + attack** (up,
   down, back, forward was planned, but up jumps: the move would start in the air, where a big special can't; down does
   nothing else, so ↓↓ can't happen by accident). Its first boss attack, as the closest big special form: Slash → a
   wave (surf), Nova → a dome (burst), Meteor → a barrage, Quake → a quake, Rampage → a rush, Vortex → a tornado; of
   its first type. It needs some PP, spends all of it, and hits as a big special does scaled by the bar (a full bar =
   a big special, ≈ half the HP bar; at least a fifth of that). A hit during its charge gives the PP back. The banner
   shows the attack's name ("Nova!").

**The CPU uses them too** (milestone 15): it types the motion a frame at a time, like a player (a hit drops it). Its
signature move is a plan of its own (more for zoners, where its form reaches); its legendary move waits for 70 PP and
its form's reach. A legendary boss keeps to its own attacks (fight/boss.ts). Fight lab: tackles' share of the damage
66% → 58%, fairness and the ladder unchanged. The endgame save has Mewtwo in Kanto's box to try one.

### 4.10 Versus (milestone 16)

Two players on one machine (decided 2026-11-10). From the title: **Versus**.

- **Selection**: two big grids side by side (Player 1 red, Player 2 blue), each with its own cursor, moved by its own
  device at the same time (the DOM's single focus can't do that, so the screen is built once and updated in place;
  the state is `game/versus.ts`). Each player picks **3 Pokémon** (in fighting order; the same species can't be in a
  team twice, both teams may share one), then presses pick again: **Ready!**. Both ready: "Fight!". Back undoes (ready,
  then the last pick); with nothing left, Player 1 leaves. LB / RB (Q / E) jump between generations. The focused
  Pokémon shows its types and its move of its own (signature or legendary).
- **Who can be picked**: every species of the regions opened in the journey (Kanto's 151 without a save; Johto's
  after Kanto's League…). All at **Lv. 100**, perfect IVs (only the Pokémon chosen differ).
- **Devices** (`versusSeats`): two controllers: P1 the first (and the keyboard), P2 the second; one controller: P1 the
  keyboard, P2 the controller; none: P2's panel waits ("connect a controller"). The browser tests use a stand-in
  controller (`window.__pf.versusPad`).
- **The fight**: the usual fight, both sides people. **No switching** (Tab says so); when a Pokémon faints, **its player
  picks the next one** (both, if both fainted; nobody when one is left), each on their side of the screen with their
  own input (`BattleState.versus`). The HUD tags each side "Player 1" / "Player 2". No XP, no money, nothing saved.
- **The winner**: "Player 1 wins!" (or a draw) in the winner's color, both teams (fainted ones grey); **Choose again**
  goes back to the selection with the same teams picked (one press each to be ready for a rematch), or the title. Esc
  in the fight goes back to the selection too.

## 5. Progression systems

- **XP**: official formula (`base_experience · level / 7`, ×1.5 for trainer battles), growth rates from the data
  (fast, medium-fast, medium-slow, slow). Shared XP for party members who fought (team battles).
- **Level up**: stats recalculated; new moves learned → choose the equipped special.
- **Evolution**: official methods: level, stone (bought at the mall), trade (❓ replace with an item such as
  "Link Cable", like in poke-gacha). Evolving can be cancelled (B).
- **Capture** (wild battles only): after you win, the defeated Pokémon is worn out and you can throw a ball from the
  bag. **No performance bonus**: only the ball, the species and the levels count, using the shape of the **official
  modern formula** (Sword/Shield, Gen 8). Tuned twice: after milestone 11 it was made harder (with the games' values
  every early Pokémon was caught on the first throw), then after milestone 12 easier again (decided: a typical Pokémon
  took ~9 Great Balls, each after its own fight; it should take **3–5**):

  ```
  X = HPterm × catchRate × ball × difficulty × status
  ```

  | Term | Value |
  |------|-------|
  | `HPterm` | Fixed at **0.6** (`WILD_SPIRIT`): a beaten wild Pokémon still has fight in it. It does not depend on how you won. (It was 1, the games' 1-HP value, then 0.2 after milestone 11: far too hard.) |
  | `catchRate` | Species catch rate from the data (Pidgey 255, Pikachu 190, Snorlax 25, Mewtwo 3) |
  | `ball` | Poké ×1, Great ×1.5, Ultra ×2, Safari ×2 (the games' ×1.5 was too weak for the Safari's rare Pokémon), Master = always. Later regions add Nest Ball (`(41 − level)/10` below Lv. 30), Net, Dusk, Level Ball… as data. |
  | `lowLevel` | **Dropped** (it was `(30 − level) / 10` below Lv. 21, ×2.5 at Lv. 5: it made every early Pokémon a sure catch) |
  | `difficulty` | Before the 8th badge, if the wild Pokémon's level is **higher than your Pokémon's** → ×0.1 |
  | `status` | ×1 (no status effects yet; sleep ×2.5, paralysis/poison/burn ×1.5 when they exist) |

  - If `X ≥ 255` it is caught. Otherwise there are **4 shake checks**, each passing with
    `Y/65536` where `Y = 65536 / (255/X)^(3/16)`. Overall chance ≈ `(X/255)^0.75`. Each passed check = one wobble.
  - Examples (Poké / Great / Ultra Ball): a common Pokémon (catch rate 255: Pidgey, Rattata, Geodude) ≈ 68% / 92% /
    100%; Pikachu (190) ≈ 55%; a typical one (45: Kangaskhan, Scyther, most evolved Pokémon) ≈ 19% / 25% / 31%, so
    3–5 Great Balls; Snorlax (25) ≈ 12% / 16% / 20%. In the Safari: Kangaskhan ≈ 31%, Chansey ≈ 23%. Legendaries
    can only be caught with a Master Ball, which always catches.
  - Level now only matters through `difficulty`: a Pokémon stronger than yours is much harder.
  - Gen 8 "critical capture" is left out (simpler).
  - **One throw per win**: if the Pokémon breaks free, it **flees**. You still keep the battle's XP. The ball is used up either way.
  - So the choice of ball matters: a rare Pokémon is worth an Ultra Ball, because there is no second try.
- **Party and PC**: 6 in the party, the rest in a box (simple list screen). **Releasing** (after milestone 11):
  from the box screen (X / Delete), after a "Keep it / Release" question with Keep it focused; any boxed Pokémon,
  or a party one as long as one stays in the party. The Pokédex still counts a released Pokémon as caught.
  **Moving** (after milestone 12, `game/box.ts` `place`): A (Enter, a click) picks a Pokémon up and A puts it down:
  on another Pokémon they swap places (party, box, or between them: the party keeps its size), on the empty place
  after the party or the box it moves there (the party keeps 1 to 6); A on itself or B puts it back. **Y** (S) sends
  the focused one straight across (party → box, box → party), or says why not.
- **Money**: from trainer, gym and League wins. Wild battles give little or none.
- **Bag** (after milestone 11; `game/bag.ts`, `ui/screens/bag.ts`): every item by pocket (medicine, Poké Balls,
  evolution items, key items), opened from the city's bottom bar (RB / B). The focused item says what it does; potions,
  stones and the Link Cable list the party with what they would do to each ("+20 HP", "Can evolve!", "Full HP", "No
  effect"), and A uses it (an evolution plays its animation, then back to the bag). Balls and rods say where they are
  used instead. The party screen can still use items too.
- **The city's bottom bar**: the party, then the **Pokédex** (X) and the **Bag** (RB / B) as round buttons showing
  just their picture, no background (the Pokédex's "seen · caught" chip at the top moved into its name and tooltip).
  PokeAPI has no Pokédex or bag sprite, so both are hand-placed pixel art in the GBA games' style (`render/gear.ts`,
  one letter per pixel with a palette): an opened red Pokédex (lens, lights, screens, keypad, hinge) and a yellow
  backpack (lobes, flap and buckle, side pockets, navy outlines), drawn from scratch after reference pictures.
- **Pokédex** (a screen since milestone 11's follow-ups; `game/pokedex.ts`, `ui/screens/pokedex.ts`). Two screens:
  - Opened from the city's bottom bar (X). **The list**: all 151 in a grid (unseen ones as silhouettes named "???", a Poké Ball on caught ones, always in
    color: caught means registered in the Pokédex, as in the games, so evolving or releasing it never undoes it;
    decided after milestone 12, it used to turn grey once none was left). A filter bar on top: **Owned** (caught at some point, as the games'
    Pokédex says "owned"; released ones count), **Type** (a picker), **Legendary**, **Mythical** (with both on,
    either), **No.** (a range of 30 numbers, which also jumps there), and Clear. Filters add up, stay while the game
    runs, and the list says how many are shown.
  - **A species' page** (A on a tile): a card (sprite, number, name, kind, types, legendary / mythical, what you know,
    size) and the text, which takes the focus so the **d-pad scrolls it** while there is more to read
    (`data-scroll` in `ui/focus.ts`), then moves on. LB / RB (Q / E) go to the previous / next species *in the list
    as filtered*; B goes back to the list, on that species. What a page shows grows with what you know:
    - unseen: only the number;
    - seen: name, types, kind ("Seed Pokémon"), its family (stage by stage, with how each one evolves *in this game*:
      a level, a stone, or the Link Cable for trades; later generations' evolutions are left out) and where it lives
      in Kanto (each city's grass, cave, water with the weakest rod that hooks it, the Safari Zone, with the levels);
    - caught: also height and weight, the Pokédex entry, base stats and catch rate, and how many you have now.
  - **Languages**: the kind and the entry come from PokeAPI in English (Red's Pokédex, through `npm run data`;
    "POKéMON" written "Pokémon"). PokeAPI has no Portuguese for them, so `data/dex-pt.json` is this game's own
    translation (`data/dex-text.ts` picks the language; a test checks every species has one). Heights and weights
    use the language's decimal mark (1.3 / 1,3).
- **The wild fight's Poké Ball**: in wild and Safari fights, a small Poké Ball left of the opponent's name: in color
  if you have that species now (party or box), grey if not, so you don't spend balls on one you have. Not shown
  against trainers (their Pokémon can't be caught).

**Built in milestone 5** (pinned by `progress.test.ts`, `save.test.ts`, `i18n.test.ts`, `e2e/progress.spec.ts`):

- **XP**: base experience × level / 7, ×1.5 from trainers (the sandbox counts as a trainer), shared equally by the
  player's Pokémon that fought each knocked-out opponent and are still standing at the end. The 6 official growth
  curves (checked against PokeAPI's tables). Lv. 100 is the cap.
- **Level up**: several levels at once if the XP reaches; stats follow; current HP rises by as much as max HP;
  the moves of each new level are learned. **All moves are kept** (no 4-move limit: only the 2 special slots).
- **Evolution by level**, asked after the battle ("What? X is evolving!": Evolve / Stop, as in the games; a stopped
  Pokémon is asked again after its next battle). It keeps level, XP, moves and specials, and learns the new form's
  moves up to that level (see **Official learnsets**). Stones and trades: the data is ready, the items come with the shop (milestone 8).
- **Party screen (P)**: pauses the fight; level, HP, XP to the next level; pick each special from the known damaging
  moves; Heal (sandbox stand-in for the Pokémon Center); New game; language. Changes start a new battle.
- **Results screen** after every battle (outcome, XP, level ups, new moves, evolutions). If nobody can fight, the
  sandbox heals the party for the next battle.
- **Saves**: localStorage key `poke-fight.save`, JSON with a version (1) and a migration chain for later versions;
  strict validation; a broken or newer save is kept aside (`poke-fight.save.broken`) and a new game starts (a
  warning, never a crash); blocked storage just means nothing is remembered. Fixtures in `src/state/fixtures/` must
  always load (unit test) and are used by the browser tests.
- **Languages: English and Portuguese** (decided after milestone 4). Every player-facing text goes through `t()`;
  a test checks both languages have every text with the same placeholders. Pokémon and move names stay in English
  (as Brazilian players know them). Portuguese for Portuguese browsers, English otherwise; changeable in the party
  screen; saved. The debug overlay (F1) stays in English (a developer tool).
- Menus: mouse and keyboard (Enter/Space on the focused button, P, Escape); a controller's Start presses the main
  button. Full controller navigation of menus comes with the world menus (milestone 7).

## 6. The world (menus)

No walking map: the world is a set of **menu screens** (easy to build, easy to test).

```
World map (cities unlocked by badges)
 └─ City
     ├─ Hunt: Grass / Water / Mountain-Cave (only the areas this city has; Water needs a rod or Surf)
     ├─ Battle field: trainer battles (repeatable, money + XP)
     ├─ Gym: the leader (+ 1–2 gym trainers first ❓)
     ├─ Pokémon Center: heal party, PC box
     ├─ Shop (Poké Mart) or Mall (in the big city)
     └─ Special: Safari Zone (Fuchsia), Pokémon Tower (Lavender), Fossils (Cinnabar)…
```

- **Encounters** come from the official Gen 1 (Red/Blue) encounter tables per location area, with each area
  assigned to a city and a hunt type. Rarity follows the official encounter rates.
- **Safari Zone** ❓ idea: you don't lose HP permanently there, you get 30 Safari Balls and a time limit, and the wild
  Pokémon flee after ~20 s, so you must weaken them fast and throw. Rare species.
- **Shop (first city)**: Poké Ball, Potion, Antidote ❓ (if status exists), and Great Ball after badge 2.
- **Mall (big city)**: Great/Ultra Balls, Super/Hyper Potion, Revive, evolution stones, X items ❓,
  vitamins ❓.

**Built in milestone 7** (pinned by `world.test.ts`, `save.test.ts`, `e2e/world.spec.ts`):

- **Kanto as data** (`src/data/regions/kanto.ts`): 11 places in story order, each with the badges it needs, its
  shop and its hunting grounds: real Red/Blue location areas grouped as grass, cave and water (Red and Blue merged,
  so both versions' exclusives appear). Without badges: Pallet, Viridian, Pewter.
- **Hunting**: grass and caves (walking tables); water = fishing with the **best rod owned** (Old, Good, Super Rod:
  each its own Red/Blue table). **Rare bites** (decided after milestone 11): in Red/Blue the Old Rod only ever
  catches Magikarp and the Good Rod the same Poliwag and Goldeen everywhere; here each rod also hooks the better
  rods' Pokémon of that water 30% of the time, at its own levels (Cerulean's Old Rod: Psyduck and Krabby too).
- **Every species can be obtained** (decided after milestone 14: 111 of the 493 couldn't be). Each League city has
  a **Hidden Grove** (a fourth hunting ground, gold, after the League's 8 badges) with its generation's Pokémon that
  nothing else reaches: the starters not chosen, the games' gifts and fossils (Lapras, Eevee, Porygon, Omanyte,
  Kabuto, Aerodactyl, Togepi, Shuckle, Castform, Beldum, Riolu, Spiritomb, Rotom…), the babies (no eggs here), and
  the evolutions this game can't do (by place, by a known move, by a held item: Magnezone, Leafeon, Glaceon,
  Mamoswine, Weavile, Milotic, Shedinja…), plus an older species whose only way in is a newer baby (Snorlax from
  Munchlax, Mantine from Mantyke). Base forms Lv. 30–36, evolved ones Lv. 40–46; their evolutions happen as usual.
  Kanto 12, Johto 11, Hoenn 10, Sinnoh 29 (`Region.grove`, area `<region>-hidden-grove`). `game/obtainable.test.ts`
  fails if any species becomes unreachable, or a grove holds one that is wild elsewhere.
- **Variety** (decided after milestone 11, `huntTable` in `game/encounters.ts`): the Red/Blue tables put Pidgey,
  Rattata and Spearow on nearly every route and make each city's own Pokémon rare (Lavender's Vulpix 3%). What you
  actually meet is weighted so every new city feels new; the levels stay the games':
  - rates are **flattened** (the square root of each species' share);
  - a species that already lived in an earlier city (story order) is an **old face**: a quarter as often;
  - a species you **haven't caught** yet comes twice as often.
  Result: a city's own Pokémon are 60–100% of its grass and caves (Cerulean: Abra, Oddish, Bellsprout, Ekans,
  Sandshrew ≈ 71%; Pidgey + Rattata + Spearow < 20%), Lavender's Vulpix ≈ 10%. Saffron has no grass of its own (Route
  9's four were all met before): it hunts in the Power Plant. The Pokédex's "where to find it" still lists the
  games' places. Rods are **bought** (decided): Old Rod in Viridian (₽1000), Good Rod in Pewter
  (₽3000), Super Rod at the Saffron mall (₽10000). Surfing: later.
- **Wild battles**: the party against one wild Pokémon (an easy CPU), "A wild X appeared!". Esc runs away.
  Wild Pokémon roll their own **IVs** (0–31), kept when caught.
- **Catching**: after a win, one ball (Poké / Great / Ultra / Master): the Gen 8 formula as planned (no performance
  bonus), 4 shake checks; if it breaks free it flees; you can also let it go. **The throw plays out** as in the
  games (`ui/screens/capture.ts`): the ball arcs in, the Pokémon turns to red light and is drawn inside, the ball
  drops and wobbles once per shake check passed, then clicks shut (a green light, stars, "Gotcha!") or bursts open
  ("Aargh! Almost had it! Pidgey broke free.": after the games' lines by the number of wobbles, each saying plainly that it got away; the games' "It appeared to be caught!" read like a catch). A skips to the end. A caught Pokémon arrives rested (full
  HP) and joins the party, or the box when the party is full.
- **Money**: start ₽3000 and 5 Poké Balls. Battle field (trainers) pays the sum of their levels × 12 (× 20 until
  milestone 13); wild Pokémon pay nothing.
- **Economy** (decided after milestone 13: "with a few battles I buy a lot of stuff"; the table is
  `npm run sim -- economy`). Prices are set against targets in **battle-field battles** at the stage an item is
  bought (one battle ≈ 2 minutes): an evolution item ≈ 5 battles when first sold and ≈ 3 by Saffron (₽5,000, every
  evolution item); a Master Ball ≈ 15 battles at the sanctuary (₽30,000: each legendary is a half-hour goal); an Ultra
  Ball or a Hyper Potion ≈ 1 battle in mid-game. **Rare Candy** (decided after milestone 14: leveling up late took
  too long): ₽2,000, +1 level (its moves too; reaching a level evolution, it evolves at once, as in the games), sold
  only at each region's League city mart: about one battle there per level. Gym, Elite Four and Champion prizes (99 × their best level) are
  one-time and unchanged. **Losing** (wild or trainer): half the money is lost, the party is healed, back to the city.
- **Shop** (per city), **Pokémon Center** (free healing), **PC box** in any city (decided: swap freely, the party
  keeps 1–6), **potions** used from the party screen (they can't revive), **world map** (locked cities say how many
  badges they need), **Pokédex** (seen / caught counts).
- **Save version 3**: money, bag, Pokédex (version 2 saves migrate).

**Built in milestone 8** (pinned by `gym.test.ts`, `save.test.ts`, `e2e/gyms.spec.ts`):

- **8 gyms** with the Red/Blue leaders, badges and teams (Brock's Geodude Lv. 12 and Onix Lv. 14 … Giovanni's five,
  up to Rhydon Lv. 50), as the official-data rule asks. The leaders' lines are original (EN/PT). Each leader fights
  with a CPU style that suits the type: Brock and Erika defensive, Misty zoner, Lt. Surge aggressive (normal);
  Koga and Sabrina zoner, Blaine aggressive, Giovanni balanced (hard).
- A gym: the leader's intro → their whole team, one at a time → on a win the **badge**, **99 × their highest level**
  (Brock: ₽1386, as in Red/Blue) and 1.5× XP → the leader's last word. Losing: as any loss (half the money). No
  gym trainers before the leader and no rematches (for now). Viridian's gym needs 7 badges.
- **Gym trainers** (decided 2026-11-10, milestone 15): a gym is a hall (the League's screen) with **two gym trainers
  and then the leader**, fought in a row. No Pokémon Center in between: HP carries over, so potions from the party
  matter (the hall has the party button); a loss, or leaving, ends the run, and the next try starts over. The
  trainers are a rule, not data (`gymTrainers` in `game/gym.ts`): two Pokémon each of the gym's type, met in the
  region's wild, never below the level they evolve at, the first trainer at the leader's weakest level − 4, the second
  − 2; their class by type (a Hiker and a Camper at Pewter); their CPU a step below the leader's. They pay like the
  battle field (levels × 12) and give trainer XP. Rematches with leaders stay open.
- **Badges open Kanto** (the world map), and the 8th removes the "stronger than yours" catch penalty.
- **Evolution items**: Fire, Water, Thunder, Leaf and Moon Stones, and the **Link Cable for trade evolutions**
  (Kadabra, Machoke, Graveler, Haunter; decided default, the question had no answer), sold at the **Saffron mall**
  (₽2100), used from the party screen.
- **Safari Zone** (Fuchsia, 4 badges): ₽500 for 30 Safari Balls (×1.5, never in the bag); each encounter is a
  30-second fight against its rare Pokémon (Chansey, Kangaskhan, Tauros…): knock it out in time and throw, or it
  flees. The party recovers after every encounter; losing costs nothing.
- **Fair journey fights**: the training tools (F1–F4, R: infinite PP, switching the opponent…) work only in the
  practice demo, never in a journey fight.
- **Save version 4**: badges.

**Built in milestone 9** (pinned by `league.test.ts`, `save.test.ts`, `e2e/league.spec.ts`):

- **The Pokémon League** at Indigo Plateau (8 badges): the Elite Four with their Red/Blue teams (Lorelei, Bruno,
  Agatha, Lance) and the **Champion: the rival**, with the Red/Blue champion team that matches the starter they took
  (ending with Blastoise, Venusaur or Charizard Lv. 65). All hard CPUs, with styles that suit them. Lines are
  original (EN/PT).
- **A run** is the five battles in a row. Between them, only a menu: who's next, the party (potions), Challenge or
  Give up. HP carries over; a loss anywhere costs half the money and ends the run. No running away. Each win pays
  99 × the opponent's strongest level.
- **The ending**: the Champion's and the Professor's last words, the **Hall of Fame** (saved, one entry per win, with
  its region), the credits, and the **next region**: winning a region's League opens the next region and that
  region's Legends' Sanctuary (milestone 12). The League can be challenged again.
- **Save version 5**: region, champion, Hall of Fame.

**Milestone 12: regions** (decided; replaces the earlier default where the party travelled along):

- **Four regions**: Kanto, Johto, Hoenn, Sinnoh (`src/data/regions/<id>.ts`, the shape in `types.ts`, checked by
  `regions.test.ts`). Each has its cities and hunting grounds (the location areas of its own games: HGSS, RSE,
  DPPt), its 8 gyms and League (the games' leaders, teams and Champions), its starters, Professor and rival, its art,
  pixel-art towns and world map, and its Legends' Sanctuary. Every id is unique across regions.
- **Each region is its own journey**: its own party, box, bag, money, badges and **Pokédex** (every species up to its
  generation's last: 151, 251, 386, 493). The first visit starts a new journey: the region's Professor, a starter of
  its own, the starting money and balls, its first city. Journeys are kept while the player is elsewhere (save
  version 6: the current journey in the save's fields, the others in `away`; `switchRegion` / `startRegion`).
- **Opening regions**: Kanto is open; each next region opens when the one before's League is won (`champions`).
- **The plane** (beside the bag, LB / T): every region with what the player has there, or why it's closed; A on an
  open one flies there (a short flight, A skips).
- **Legends' Sanctuary**: a place in the center of each region, open once its League is won. Instead of hunting
  grounds, a card for each legendary (and mythical) of the region; a Center, a Mart (the only one that sells Master
  Balls, ₽30000), the box and the map. A legendary fights with **four times its HP** and **boss attacks** of its own
  (§4.8); it takes the whole team. Beaten, **only a Master Ball** can be thrown (no other ball is offered); with none,
  it can only be let go and fought again. It gives **every party Pokémon** the full XP twice over, fainted or not,
  whether it fought or not (`LEGENDARY_XP`). A caught legendary's card says so and can't be fought again.
- **Data**: `npm run data` builds generations 1–4 (species, moves, HeartGold/SoulSilver learnsets, Pokédex pages)
  and, for generations 2–4, each region's own encounter tables (every species found there, only its own areas, so
  Kanto's tables are untouched). New evolution items: Sun, Dusk, Shiny and Dawn Stones, and the **Soothe Bell**
  (friendship evolutions); the Link Cable starts every trade evolution. Evolutions that need what the game doesn't
  have (time of day, gender, a place, a held item while leveling) are left out. The Portuguese Pokédex texts are
  the game's own translation, one file per generation.

## 7. Architecture

### 7.1 Stack (same as poke-gacha)

- **TypeScript + Vite**, no UI framework: menus in **DOM** (easy to style, accessible, easy to target in Playwright);
  the fight in **Canvas 2D**.
- **Vitest** for all game rules and the fight simulation.
- **Playwright** for end-to-end flows, running in **GitHub Actions** (`ci.yml`).
- **A study deploy** (decided 2026-11-09; kept on 2026-11-10: the user checks there that the project builds and runs as
  a deployed site): `pages.yml` runs when CI (`ci.yml`: type check, unit tests,
  browser tests) has **passed** for a push to `main` (not in parallel with it: a push whose tests fail is never
  published); it builds that commit (`vite build` with the base `/poke-fight/`) and publishes `dist/` to GitHub Pages. The link is never shared
  and the page asks search engines not to list it (`noindex`). To take it down: Settings → Pages → Unpublish site,
  and delete `pages.yml` (else the next push publishes it again).
- **Data**: `scripts/build-data.mjs` downloads from PokeAPI once and writes JSON into `src/data/generated/`, which is
  committed. The game never calls PokeAPI at runtime. Sprites are loaded by URL ❓ (or downloaded once into
  `public/sprites/`, git-ignored, to play offline).
- **Saves**: `localStorage`, versioned format with migrations (no cloud and no Firebase: nothing to distribute).

### 7.2 Fight engine (the core)

```
            ┌──────────── requestAnimationFrame (any refresh rate) ─────────────┐
            │                                                                   │
 keyboard ─▶│ InputSampler ─▶ InputFrame ─▶ sim.step(state, p1In, p2In) ─▶ state │─▶ Renderer (canvas)
 gamepad ──▶│  (edge detect,     (bitmask)    fixed 60 Hz, accumulator    │     │─▶ Audio (events)
            │   buffer 6f)                    AI.decide() → p2In          ▼     │
            │                                                      events[]     │
            └───────────────────────────────────────────────────────────────────┘
```

- **Fixed timestep at 60 Hz** with an accumulator: the simulation is independent of the monitor's refresh rate
  (60/120/144 Hz) and of how slow the machine is.
- **Pure simulation**: `step(state, inputs) → state + events` has no DOM, no time and no `Math.random` (it uses a seeded RNG).
  Positions are **integers in sub-pixels** (1 px = 256 units) so results never depend on floating-point quirks.
- **Renderer only reads the state**: sprites, effects, HUD. Visual-only randomness (particles) uses its own RNG.
- **Events** (`hit`, `guard`, `ko`, `specialStart`…) drive sound, screen shake and HUD pops: the simulation
  never calls them directly.
- **Internal resolution** 480×270 (16:9), scaled by whole numbers (×2, ×3, ×4) with `image-rendering: pixelated`.

### 7.3 Sprites and animation

Pokémon sprites are single front/back images, not fighting-game animation frames. The plan:

- **MVP**: Gen 5 (Black/White) static front sprites, facing the right way (front sprites look to the left, so we flip
  the player's). Animation is **procedural**: idle bob, squash/stretch on jump, lean + forward slide on the
  physical attack, glow/shake while charging, flash + knockback on hit, fall + fade on KO.
- **Later** ❓: the data script turns Gen 5 animated GIFs into sprite sheets for the idle animation.
- Trainers at the edges and in the story: **Pokémon Showdown's trainer sprites** (80×80, by URL: the player, the
  rival, the Professor, Nurse Joy, the Mart clerk, the leaders, the Elite Four, a trainer class for the battle field).
  Until a sprite loads (or offline, or in the browser tests) a pixel figure painted by code stands in.
- Places: **Showdown's battle backgrounds** (by URL), both as the fight's stage and behind the menus, with life drawn
  over them (`render/ambience.ts`: leaves and light rays, water sparkles, bubbles, dust, snow, embers, lightning,
  stars, spotlights; some pass in front of the fighters). The painted stages stay as the stand-in.
- **Cities**: a top-down pixel-art town per city, painted by code (`render/town.ts`, after milestone 11; the first
  version was a flat side-view skyline): a forest edge, the main row of buildings in the band the city's cards
  leave visible (houses, the Pokémon Center with its Poké Ball, the Mart, the gym with its statues, the landmark:
  Oak's lab, the museum's columns, Lavender's tower, the department store, Silph's tower, the Safari gate, the
  League, Cinnabar's volcano), the road with lamps and flower beds, gardens and fences, tall grass at the edges,
  and the city's water (the sea, a river with a bridge, a pond, Vermilion's harbor with its ship). Each city has its
  ground (grass, rock, sand, paving) and time of day (Lavender at dusk and the Plateau at night, windows lit). The
  battle field's fights use the city's battle background again (a top-down town can't be a side-view stage).
- **The League and the Legends' Sanctuary have pictures of their own** (`render/landmarks.ts`, decided after
  milestone 13's step 2: they were towns of houses): the League is a palace on its plateau at sunset in its region's
  color (columns, banners, a gabled portico with a gold crest, a domed tower, side towers with flags, braziers, a red
  carpet down the stairs); the sanctuary an ancient shrine at night (an aurora, the moon, a great arch with glowing
  runes, a crystal floating in it over a rune circle, broken columns with ivy, cold lanterns, a still pool), glowing
  in the sanctuary's own color (Kanto violet, Johto gold, Hoenn jade, Sinnoh blue).
- **The world map** is pixel art too (`render/region-map.ts`): the sea with surf and shallows, a rugged coast and
  beaches, mountain **ranges** (several peaks each, lit and shaded faces, crevices, snow) instead of triangles,
  forests of little trees, a lake and a river, roads that turn on the map's axes (dotted over the sea, grey while
  locked). Each place is an icon in 3/4 view (redrawn with the League and sanctuary pictures): a town is a clearing
  with a few houses and the Pokémon Center; a city (four or more buildings in its plan) a block built from its plan,
  its landmarks behind (the gym, Lavender's tower, skyscrapers, the department store, the lab, the museum,
  Cinnabar's volcano); the League a palace on a rocky plateau; the sanctuary a shrine with a floating crystal. A
  place not open yet is faded. The buttons are invisible frames laid exactly over the icons (`ICON_BOX`): white on
  focus, gold where you are; the name under each, with a pin or a lock. A test keeps every region's icons and names
  on the map and apart (`region-map.test.ts`). The side panel shows the focused place's picture.
- Both are drawn by a small pixel painter (`render/pixel.ts`): pixels written to a buffer, light from the top-left,
  dark outlines, a few tones per material with ordered dithering between them, and fixed noise for textures.
- Items and badges: the PokeAPI sprites.
- **Rendering**: the fight is laid out in 480×270 art pixels but drawn at the screen's resolution, with a whole number
  of *device* pixels per art pixel and positions snapped to device pixels (`render/screen.ts`). Stretching a
  480×270 canvas made texts blurry and moving sprites flicker on screens with 125% / 150% display scaling. The HUD
  uses the menus' fonts (Barlow Condensed, Inter), drawn sharp.
- **Shadows and stance**: a soft contact shadow the feet stand in (centered just above the feet line); idle
  Pokémon breathe (a slight squash) instead of bobbing up, so they never look like they float.
- **Evolution**: an animation, as in the games (glow, white silhouettes swapping faster and faster, a flash, the new
  form in color), after a battle and with an evolution item; A skips it (`ui/screens/evolution.ts`).
- Menus show each Pokémon's sprite (city, party, box, Center, results, Hall of Fame).
- Which picture goes where is data: `src/data/art.ts` (cities, gyms by type, people, the world map's layout).

### 7.7 Look and feel (milestone 11)

The menus were redesigned to look and play like a console game, **controller first**:

- **The frame**: a 16:9 box as big as the window (`render/screen.ts`). The fight canvas sits in its middle at a
  whole-number scale; menus fill the frame and are sized in frame units (CSS `cqh`), so everything scales together.
  Behind the menus, the place's picture (`ui/backdrop.ts`): sharp for a place, blurred for an interior (Center, Mart,
  box), dimmed around a fight. Each city has a theme color.
- **Type**: Barlow Condensed (italic, uppercase titles), Inter (text), Pixelify Sans (the fight's canvas).
- **Pieces** (`ui/kit.ts`): glass panels, bright cards (a gradient of their color, speed lines, a shine on focus),
  white-on-focus buttons, HP bars (green → yellow → red), XP bars, type pills, a hint bar. Icons are simple line
  drawings made for the game (`ui/icons.ts`).
- **Focus** (`ui/focus.ts`, `ui/spatial.ts`): the arrows and the d-pad move **by direction on screen** (grids, rows,
  columns; lists wrap). A redrawn screen keeps the focus where it was (buying an item stays on the item). The mouse
  moves the focus too. A / Enter press, B / Esc go back, Y / P opens the party, Start presses the main button.
  The hint bar shows controller glyphs or keyboard keys, whichever was used last. A sheet (the move picker) keeps the
  focus inside it.
- **Screens** (`ui/screens/*`): the title (logo, two Pokémon facing off, the menu, the saved journey), Options
  (sound, language, keys, the controller's layout), story dialogs (visual-novel style: the speaker's sprite, a name
  plate, typed-out text, Yes / No questions), the starters (cards with stats), the **city hub** (cards: hunting
  grounds with the Pokémon that live there (unseen ones as silhouettes), the gym with its leader, the League, the
  Safari, the battle field; then the Center, the Mart, the box, the map; the party along the bottom), the Pokémon
  Center (Nurse Joy and Chansey behind the counter, the healing machine), the Mart (the clerk, shelves of item cards,
  descriptions), the PC box (party column + box grid), the **world map** (an illustrated Kanto, cities as nodes), the
  **party** (slots with HP bars and types, a summary with stats, XP and the specials, a move picker, items,
  **reordering**), results (a banner, the report with icons, the capture / evolution card), the League hall (the five
  opponents), the Hall of Fame (pedestals, confetti), the credits.
- The browser tests switch the animations off (`html[data-test]`) and check focus and controller flows with a fake
  gamepad (`e2e/controller.spec.ts`).

### 7.6 Sound

All in `audio/`, through the Web Audio API, starting on the first click or key (the browser's autoplay rule):

- **Effects** are synthesized (oscillators + filtered noise): hit, big hit, block, charge, KO, jump, dash, menu
  select/confirm, ball throw/open/shake, caught, level up. Which ones a fight frame makes is a pure function
  (`audio/cues.ts`), tested.
- **Music**: short **original** chiptune loops written as chords + a melody (`audio/music.ts`): title, town, battle,
  gym, League, victory. No game's music is copied.
- **Cries**: the games' recordings, loaded by URL from PokeAPI (like the sprites) when a Pokémon comes out. They go
  through the mix like everything else (their own bus, then the master), so mute and volume apply.
- **Volume** (after milestone 11): Options has music, effects and cries, 0–10 each (device settings). Defaults 6 / 6
  / 3: the cries are full-loudness recordings and the music a soft synth, so at the old fixed levels a cry drowned
  the music. Levels are squared into gains (`gainOf`), so the steps sound even.
- The browser tests are silent (test mode uses a silent player and never fetches cries).

### 7.4 Folder structure

```
src/
  engine/       loop.ts (fixed step), rng.ts, input/ (keyboard, gamepad, bindings, buffer)
  fight/        PURE: state.ts, step.ts, physics.ts, hitbox.ts, moves/ (frame data, archetypes),
                damage.ts, types.ts, ai/ (decide.ts, profiles.ts), replay.ts
  render/       canvas renderer, sprites, effects, hud, camera/shake
  audio/        sfx (synth), music, cries
  game/         PURE: stats.ts, xp.ts, evolution.ts, capture.ts, encounters.ts, economy.ts, party.ts, progress.ts
  data/
    generated/  kanto.json (species, moves, learnsets, evolutions, encounters, growth rates) — from the script
    regions/    kanto.ts (cities, unlocks, gyms, trainers, shops, story beats) — hand-written
    typechart.ts, items.ts, archetypes.ts (move → fight archetype)
  state/        save.ts (schema + migrations), store.ts, actions.ts
  screens/      title, starter, tutorial, world, city, hunt, shop, center, party, bag, fight, capture, results, options
  ui/           small DOM helpers/components
  test/         test hooks (window.__pf), fixtures (saves at different points of the game)
scripts/build-data.mjs
e2e/            Playwright specs + helpers
docs/           design notes as we decide (frame data table, balance, AI profiles)
.github/workflows/ci.yml
```

**Rule**: `fight/` and `game/` never import from `render/`, `screens/`, `state/` or the DOM. That keeps them pure
and fast to test.

### 7.5 Regions (milestone 12)

- A region is a data file (`src/data/regions/<id>.ts`, the `Region` type in `types.ts`): cities, gyms, League,
  starters, people, art, towns, map, sanctuary. `index.ts` registers them in journey order and finds a city, gym,
  look or town plan by id in any region. `regions.test.ts` checks every region the same way (unique ids, 8 gyms in
  order, a League, real species and moves, art and towns for every place, a connected map, hunting areas with
  Pokémon, legendaries, every text in both languages).
- Generated data per generation (`gen1.json` … `gen4.json`); generations 2–4 carry their region's encounter tables.
- Texts are split by part (`src/i18n/parts/`: each region, the bosses, travelling, items), merged into the dictionaries.
- The save holds the current region's journey in its fields and the others in `away` (version 6).

## 8. Testing strategy (QA focus)

### 8.1 Vitest (logic, fast)

- **Frame data tests**: "physical attack hits on frame 6 and recovers on frame 21", "a press buffered during recovery
  fires on the first free frame", "a hit on back-dash frame 6 misses, on frame 7 it lands", "a hit during the big
  special's charge cancels it and gives the PP back", "the big special can't start without a full PP bar",
  "the elemental special can't start below ¼ PP", "a landed tackle adds PP, being hit adds 1 per 2% of HP".
- **Input latency test**: press on frame N → state shows the action starting on frame N (target 0, at most 1 frame).
- **Replay / golden tests**: recorded input logs + seed → final state hash. Any engine change that alters a result
  fails clearly (and is updated on purpose when the design changes).
- **Rules**: damage, type chart (full table), XP/level curves, evolution triggers, catch probability (formula +
  statistical test with a fixed seed), shop prices, unlock order, save migrations.
- **AI**: profiles behave within ranges (e.g., the "defensive" profile guards ≥ X% of attacks over 1000 frames).

### 8.4 The fight lab (`npm run sim`, `docs/fight-lab.md`)

Balance is measured, not guessed: the lab plays thousands of CPU-against-CPU fights through the real fight code
(deterministic, ~15 ms a fight) and reports win rates with 95% intervals: side fairness, the difficulty ladder,
styles, big special forms, species matchups, fight length, damage by source, mechanics used, comebacks, and the
economy along a journey. Method: measure, change one thing, compare with `docs/fight-lab/baseline.json`, pin the
result in a test, save the new baseline.

### 8.2 Playwright (the real game in a browser)

- **Test mode** (`?test=1`): fixed seed, **manual clock** (the game only advances when the test calls
  `window.__pf.step(n)`), sprites and audio stubbed, read-only `window.__pf.snapshot()` of the fight state, and a
  `window.__pf.load(save)` to start from any point of the game.
- **Flows**: new game → starter → rival tutorial → Pallet → Viridian → buy balls → hunt → win → capture → level up → evolve →
  gym → badge → new city unlocked → … → Champion (with saves to skip ahead).
- **Controls**: real `keyboard.down/up` + frame stepping to check precise timing in the real page; a **fake
  gamepad** injected via `addInitScript` (`navigator.getGamepads`) to test the controller path; key rebinding.
- **Quality guards** (as in poke-gacha): fail on any console error; no covered buttons; no horizontal overflow;
  screenshot + trace on failure.
- **Visual checks** ❓: `toHaveScreenshot` for menus and a few frozen fight frames.
- Projects: desktop only (keyboard/controller game) ❓ maybe a second window size.

### 8.3 CI (`.github/workflows/ci.yml`)

On push and pull request: `npm ci` → `typecheck` → `vitest` → `playwright install chromium` → `e2e` → upload the
report on failure. **No build/deploy job.**

## 9. Roadmap (milestones)

Each milestone ends with something playable, tests, and green CI.

| # | Milestone | Done when |
|---|-----------|-----------|
| 0 | ✅ **Scaffold** | Vite + TS + Vitest + Playwright + CI; a blank canvas page; first e2e test passes in CI; `CLAUDE.md` with conventions |
| 1 | ✅ **Fight sandbox** | Two placeholder fighters (rectangles), fixed-step loop, input (keyboard + gamepad), walk, jump, dash + invincible back dash, physical attack (ground and air), hitboxes, hitstop, knockback, HP, KO; debug overlay (F1: hitboxes, frame data, frame advantage, input history); latency + frame data tests |
| 2 | ✅ **Full move set** | Guard button, PP bar, elemental range special with charge (projectile, beam), big special (projectile, beam, rush), hitstop, knockback, combo scaling, timer, next-Pokémon flow (6 vs 6) |
| 3 | ✅ **CPU** | AI with reaction delay, 3 difficulties × 4 styles; can play a fair fight against it |
| 4 | ✅ **Pokémon data** | `build-data.mjs` (Gen 1: species, stats, types, moves, learnsets, evolutions, encounters, growth, catch rates); sprites in the fight; stat-based damage; type chart |
| 5 | ✅ **Progression + save** | Party, XP, level up, move choice, evolution, save/load with versions |
| 6 | ✅ **Prologue** | Title → starter → interactive rival tutorial → arrive at Viridian (Pallet since milestone 11's follow-ups) |
| 7 | ✅ **World loop** | World map, cities, hunt (grass/water/cave), capture with balls, Pokémon Center, first shop, box |
| 8 | ✅ **Gyms** | KOF-style team battles, trainers, 8 gyms with AI styles, badges unlock cities, mall, Safari Zone |
| 9 | ✅ **League** | Elite Four + Champion, credits, "next region" hook (scalability check) |
| 10 | ✅ **Juice & polish** | Stages per place, trainers' Poké Ball entrance, new HUD, particles and screen shake, sound effects, original music, cries, mute, rebinding UI, menu navigation by keys and controller, modern menus. **Balance pass deferred**: it needs playtest data |
| 11 | ✅ **Design overhaul** | A console-style 16:9 frame, the places' art behind the menus and as fight stages, trainer and character sprites, every screen redesigned (city hub of cards, Center with Nurse Joy, Mart, box grid, illustrated map, party with HP bars and reordering, results, League hall), controller-first spatial navigation with glyph hints |
| 12 | ✅ **Regions** | Johto, Hoenn and Sinnoh (their cities, gyms, Leagues, starters, towns and maps; generations 2–4 data), a journey per region, the plane, regions opened by Leagues, the Legends' Sanctuary with boss legendaries (Master Ball only, XP for the whole party) |
| 13 | ✅ **Moves by type** | Elemental specials drawn by type, big specials by type with real hits, signature moves for 11 famous Pokémon (←↓→ + attack), legendary moves (↓↓ + attack) (§4.9) |
| 14 | ✅ **Combat depth + fight lab** | PP from damage taken, back attacks after a dash through, parry and counter, big specials that hit for about half the bar (a fifth through a guard), a smarter CPU (guards specials, parries, comes back when far behind, uses dashes), the economy repriced, and the fight lab (`npm run sim`, `docs/fight-lab.md`) |
| 15 | ✅ **Gym trainers, CPU signature moves, balance check** | Two gym trainers before every leader in a row (no healing; potions matter); the CPU types signature and legendary moves; a measured balance pass (below) |
| 16 | ✅ **Versus** | Two players: pick 3 Pokémon each (Lv. 100, from the regions opened in the journey) on two grids at once, fight without switching (whoever loses a Pokémon picks the next), the winner, and back to the selection; keyboard + controller or two controllers (§4.10) |

Milestones 1–3 come **before** any Pokémon content on purpose: if the fight doesn't feel good with rectangles, the
sprites won't save it.

## 10. How we work with Claude

- `plan.md` (this file) is the living design. We update it whenever we decide something.
- One milestone (or part of one) per session: **plan → implement → tests → you review → you commit**.
  (Claude never commits or pushes. You run git yourself.)
- `CLAUDE.md` in the repo (milestone 0) records the conventions: pure `fight/`/`game/`, no `Math.random` in the
  simulation, every feature adds tests, how to run things.
- Decisions with trade-offs get a short note in `docs/` (why we chose it), so a later session doesn't re-open them.
- Tuning (frame data, damage scale, AI) is done by playing with the debug overlay, then locked in tests.

## 11. Open questions

### Decided

| Topic | Decision |
|-------|----------|
| Guard | Dedicated button (hold), ground only |
| Crouch / dash | Dash on its own button (Space / LB; + back = back dash); no crouch for now |
| Air control | Jumps can be steered left/right in the air |
| Team battles | Up to 6 vs 6, one at a time, like the real games |
| Type chart | Modern 18-type chart and modern typings for every region (scales best) |
| Capture | No performance bonus; the Gen 8 formula's shape (catch rate, ball, difficulty) with a fixed HP term of 0.6 (0.2 was far too hard) and no low-level bonus: a typical Pokémon takes 3–5 Great Balls; Safari Balls ×2 |
| Specials | Two slots: elemental (K, always a range attack, ¼ PP) and big (I, full PP bar + long charge) |
| Motion input | Back, down, forward + J: the elemental special with no PP spent and none earned (20-frame motion, attack within 8 frames), also in the air |
| PP bar | Replaces the Power gauge. One per Pokémon, starts half full, fills only when your hits land. PP pays only for a special that comes out: a hit during the charge gives it back, and an air special still charging on landing fires from the ground |
| Big dash | A shape of the big special: physical moves become a Rush that passes through the opponent |
| Dash through | The dash passes through the opponent (no push box), to attack from behind |
| Sprites | Loaded by URL (no local copy) |
| Tackle type | None: always neutral, no same-type bonus |
| Big special power | The move's own power (no ×2) |
| Languages | English and Portuguese (Pokémon and move names in English) |
| Tackle loop | Kept as it is: a fast tackle spammer beating the hard CPU is accepted |
| Water hunting | Needs a fishing rod; rods are bought (Old: Viridian, Good: Pewter, Super: Saffron mall) |
| PC box | Swap Pokémon freely in any city |
| Trade evolutions | A Link Cable item (default chosen in milestone 8: easy to change) |
| Gym leaders | The Red/Blue leaders, badges and teams; their lines are original |
| Post-game legendaries | Decided (2026-11-10): the Legends' Sanctuary is the post-game (each region's legendaries as bosses, Master Ball only), instead of Red/Blue's scattered encounters |
| Gym trainers | Decided (2026-11-10): two gym trainers before each leader, fought in a row with no healing in between (potions matter); see §5 |
| League | The Red/Blue Elite Four; the Champion is the rival with the matching Red/Blue team |
| Regions | Each region is its own journey (party, box, money, badges, Pokédex, kept apart); the next opens with the previous League; the plane flies between them |
| Back dash | Invincible on its first 6 frames, punishable after |
| Capture failure | One throw per win; if it breaks free, it flees |
| Look | Console style (milestone 11): a 16:9 frame, the place's art behind glass menus and bright cards, Barlow Condensed + Inter |
| Art | Trainers, characters and backgrounds from Pokémon Showdown; items and badges from PokeAPI; all by URL, painted stand-ins until they load |
| Menus and controller | Spatial navigation (by direction), focus kept on redraw, hint glyphs for the device in use, Y opens the party |
| Pokédex | Opened from the city, the focus starts on the first filter (Owned); back from a species' page, on that species. A list with filters (owned, type, legendary, mythical, number) and a page per species that reveals more as you see and catch, scrolls with the d-pad, and walks the filtered list with LB / RB; Portuguese texts are the game's own translation; releasing is in the box, the dex keeps "caught"; wild fights show a Poké Ball by the name (in color: caught in the Pokédex, even if it has since evolved or been released) |
| Bag | A bag screen by pocket; potions and evolution items are used on a party Pokémon from it; the Pokédex and the Bag are picture buttons (drawn by the game) beside the party at the bottom of the city |
| Hunting cards | Each city's hunting card shows every species of its ground (4 to 22), smaller when there are many; unseen ones as silhouettes, the most common first |
| City cards | The town behind the cards is dimmed and softly blurred (the band of buildings at the top stays clear); cards have a deeper shadow, a dark outer edge and a bright rim |
| Badges | Shown smooth (they are drawings, not pixel art), with a dark shadow; their white sticker rim is removed when they load (`render/badges.ts`) |
| Party order | Reorder in the party screen (pick up, then swap); the first Pokémon leads. The two slots glide into each other's places; a screen redrawn after a change doesn't play its entrance again |
| Switching | Once mid-round (Tab / View), again only after a faint; after every faint the player picks the next fighter. A mid-round switch continues the same round from where everyone stood |
| CPU per Pokémon | Skill from who controls it (wild clumsy, trainers at their difficulty) plus its evolution stage and level; style from its stats; a new seed every fight |
| Fishing | Each rod also hooks the better rods' Pokémon of that water 30% of the time (the Old Rod isn't only Magikarp, and each town's fishing has its locals) |
| Encounter variety | Rates flattened (square root), species met in an earlier city a quarter as often, uncaught ones twice as often: each city is mostly its own Pokémon |
| Towns and map | Top-down pixel art painted by code (original drawings), not pictures |
| Results | XP cards per Pokémon (level, XP bar filling from where it was, level ups, new moves); "Hunt again" after wild and Safari battles |
| Options | One screen for sound, language (also kept on the device, without a save) and keys; New game asks in-game before erasing |
| Entrance | Trainers throw their balls before each Pokémon (72 frames, inputs ignored); the browser tests skip it (`?entrance=0`) |
| Music | Original loops only (no copied themes); cries are the games' recordings by URL |
| Settings | Sound, volumes and keys live apart from the save (`poke-fight.settings`), one custom key per action, arrows always move |
| Balance pass | Deferred until there is playtest data (numbers stay pinned in tests) |
| Deploy | A GitHub Pages deploy to study how it's done and check deployed builds (link never shared, `noindex`; kept, decided 2026-11-10); it runs only after CI passes |
| Endgame build | `npm run endgame`: a local build (`dist-endgame/`, never deployed) that starts from an endgame save (every League won, a Lv. 70 team in each region, a full bag; `state/endgame.ts`) under its own storage key; the page opens with `?fresh`, which starts it over |

### Still open

1. **Gym rematches**: rematching leaders later, at higher levels? (Gym trainers: decided, below.)
