# Poké Fight — Project Plan

A study project: a real-time 2D fighting game (in the style of KOF / Street Fighter) with a Pokémon journey around it:
pick a starter, hunt and catch, earn XP, evolve, beat the gyms and the League. It runs in the browser on your own
machine only. **It is not distributed**: no store, no public link. Pokémon sprites and data are used only
because they are convenient. (Exception, to study deploying: a temporary GitHub Pages deploy, see §7.1.)

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
- **Training**: with a journey, your party against Rattata, Pidgey and Geodude at your party's average level (XP
  counts, Continue goes back to the city); without one, the Lv. 30 demo teams (no XP). Esc leaves Training. The
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
| Big special | I | B / ○ | Needs a **full PP bar** + a long charge; ground only |
| Guard | L (hold) | R1 / RB (hold) | **Dedicated button**, ground only (no air guard); can't move while guarding |
| Pause | Esc | Start | |

Every action's key can be rebound on the **Controls** screen (title or city): one key per action, the arrows always
move, the game's keys (Enter, Esc, P, R, M, F1–F4) can't be taken, and picking a key another action uses swaps them.
Saved in `poke-fight.settings` (not the save: a new game keeps them). Texts that name keys follow the bindings
(`{keyPhysical}`… in i18n). Controllers use the browser Gamepad API (polled every frame).
**Menus** work without a mouse: arrow keys / d-pad move between buttons, Enter / A presses, B goes back, Start presses
the main button. **M** turns the sound off and on.
**No crouch** for now (so there are no high/low attacks): ↓ is unused and reserved for later.

### 4.3 Moves and frame data

Every action has **startup / active / recovery** frames (60 frames = 1 second). Starting values, to be tuned
with the debug overlay:

| Move | Startup | Active | Recovery | On hit | Notes |
|------|---------|--------|----------|--------|-------|
| Physical (ground) | 5 | 4 | 12 | knockback, short hitstun | Moves the attacker forward (the lunge) |
| Physical (air) | 4 | 6 | lands | hits jumping-in | |
| Elemental special | 14 (charge) | depends on shape | 18 | depends on shape | Costs ¼ PP; vulnerable during charge; a hit cancels it |
| Big special | 40 (charge) | depends on shape | 30 | big knockback, long hitstop | The full PP bar is spent when the charge starts: get hit while charging and it's wasted |
| Jump | 3 (pre-jump) | ~36 airborne | 2 (landing) | — | **Can be steered in the air** (left/right) |
| Guard | 1 | while held | 3 (release) | blockstun, chip damage on specials | Blocks everything (no lows yet) |
| Dash (fwd / back) | 2 | ~14 moving | 4 | — | **Back dash: invincible on frames 1–6**, then hittable until it ends (so it can be punished) |

- **Input buffer**: a press is remembered for 6 frames, so it fires as soon as the current action ends.
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
- **Chip damage**: specials do ¼ of their damage through a guard, and chip can finish a Pokémon.
- **PP bar**: 100, starts at 50. Elemental special −25, big special −100 (needs a full bar), paid when the charge
  starts (lost if hit during the charge). Landing: tackle / air attack +15, elemental +5, big +0. A press without
  enough PP does nothing.
- **Elemental special**: 14-frame charge. Projectile: fired on frame 15 at 4 px/frame, 33 frames in total.
  Beam: hits on frames 15–20, up to ~230 px. Also in the air (shares the one air move per jump); landing before the
  charge ends loses it.
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
| **Big special** | I | Needs and spends the **full PP bar**, long charge (40 frames), power ×2, screen flash + slowdown on hit | Highest-power move it knows |

Together with the tackle (J), every Pokémon has a close attack, a range attack and a big finisher.

**PP bar** (decided): one per Pokémon, shown under its HP bar.

- Starts **half full** when the Pokémon enters a fight, so it can open with a range attack (2 shots).
- Fills **only when your attacks land**: the tackle and the air attack fill the most, so the loop is
  "get in with physical hits → earn PP → spend it on range attacks or save it for the big special". Taking damage
  or guarding does not fill it. Starting numbers to tune: tackle / air attack +15%, elemental special +5%,
  big special +0%.
- Not shared: in a 6 vs 6 battle, each Pokémon comes in with its own half-full bar.
- Why PP **and** a charge: PP controls *how often* (no spamming projectiles from across the screen), the charge
  adds the *risk* (the opponent can see it coming and hit you first; for the big special the PP is then lost).

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
| Area | Burst around the user | Big only | Earthquake, Thunder, Surf (wave) |

- In the **elemental slot every move becomes a range attack**: physical contact moves (Scratch, Karate Chop, Vine
  Whip) turn into a short projectile or shockwave of their type.
- In the **big slot**, physical moves become a **Rush** and special moves keep their own shape, bigger.

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
    Bite is Dark, Gust is Flying). Learnsets still come from the region's own games (Kanto: Red/Blue; the
    version group is set per region).
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

## 5. Progression systems

- **XP**: official formula (`base_experience · level / 7`, ×1.5 for trainer battles), growth rates from the data
  (fast, medium-fast, medium-slow, slow). Shared XP for party members who fought (team battles).
- **Level up**: stats recalculated; new moves learned → choose the equipped special.
- **Evolution**: official methods: level, stone (bought at the mall), trade (❓ replace with an item such as
  "Link Cable", like in poke-gacha). Evolving can be cancelled (B).
- **Capture** (wild battles only): after you win, the defeated Pokémon is worn out and you can throw a ball from the
  bag. **No performance bonus**: only the ball, the species and the levels count, using the shape of the **official
  modern formula** (Sword/Shield, Gen 8), made harder after milestone 11 (decided: with the games' values every early
  Pokémon was caught on the first throw; a common one should take **3–4 fights**):

  ```
  X = HPterm × catchRate × ball × difficulty × status
  ```

  | Term | Value |
  |------|-------|
  | `HPterm` | Fixed at **0.2** (`WILD_SPIRIT`): a beaten wild Pokémon still has fight in it. It does not depend on how you won. (It was 1, the games' 1-HP value.) |
  | `catchRate` | Species catch rate from the data (Pidgey 255, Pikachu 190, Snorlax 25, Mewtwo 3) |
  | `ball` | Poké ×1, Great ×1.5, Ultra ×2, Safari ×1.5, Master = always. Later regions add Nest Ball (`(41 − level)/10` below Lv. 30), Net, Dusk, Level Ball… as data. |
  | `lowLevel` | **Dropped** (it was `(30 − level) / 10` below Lv. 21, ×2.5 at Lv. 5: it made every early Pokémon a sure catch) |
  | `difficulty` | Before the 8th badge, if the wild Pokémon's level is **higher than your Pokémon's** → ×0.1 |
  | `status` | ×1 (no status effects yet; sleep ×2.5, paralysis/poison/burn ×1.5 when they exist) |

  - If `X ≥ 255` it is caught. Otherwise there are **4 shake checks**, each passing with
    `Y/65536` where `Y = 65536 / (255/X)^(3/16)`. Overall chance ≈ `(X/255)^0.75`. Each passed check = one wobble.
  - Examples (Poké / Great / Ultra Ball): a common Pokémon (catch rate 255: Pidgey, Rattata, Geodude) ≈ 30% / 40% /
    50%, so 3–4 fights with Poké Balls; Pikachu (190) ≈ 24% / 32% / 40%; Snorlax (25) ≈ 5% / 7% / 9%; Mewtwo (3) +
    Ultra ≈ 2%. The Master Ball always catches.
  - Level now only matters through `difficulty`: a Pokémon stronger than yours is much harder.
  - Gen 8 "critical capture" is left out (simpler).
  - **One throw per win**: if the Pokémon breaks free, it **flees**. You still keep the battle's XP. The ball is used up either way.
  - So the choice of ball matters: a rare Pokémon is worth an Ultra Ball, because there is no second try.
- **Party and PC**: 6 in the party, the rest in a box (simple list screen). **Releasing** (after milestone 11):
  from the box screen (X / Delete), after a "Keep it / Release" question with Keep it focused; any boxed Pokémon,
  or a party one as long as one stays in the party. The Pokédex still counts a released Pokémon as caught.
- **Money**: from trainer, gym and League wins. Wild battles give little or none.
- **Pokédex** (a screen since milestone 11's follow-ups; `game/pokedex.ts`, `ui/screens/pokedex.ts`): all 151 in a
  grid (unseen ones as silhouettes, a Poké Ball on caught ones: in color while you have one, grey once none is left),
  opened from the city's "seen · caught" chip or X. A page shows what you know:
  - unseen: only the number;
  - seen: name, types, kind ("Seed Pokémon"), its family (stage by stage, with how each one evolves *in this game*:
    a level, a stone, or the Link Cable for trades; later generations' evolutions are left out) and where it lives
    in Kanto (each city's grass, cave, water with the weakest rod that hooks it, the Safari Zone, with the levels);
  - caught: also height and weight, Red's Pokédex entry, base stats and catch rate, and how many you have now.
  The kind, size and entry come from PokeAPI through `npm run data` (in English, like the names).
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
  moves at that level. Stones and trades: the data is ready, the items come with the shop (milestone 8).
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
  catches Magikarp; here each rod also hooks the next rod's Pokémon 30% of the time, at its own levels (Old Rod:
  Magikarp, mostly; sometimes a Poliwag or a Goldeen). Rods are **bought** (decided): Old Rod in Viridian (₽1000), Good Rod in Pewter
  (₽3000), Super Rod at the Saffron mall (₽10000). Surfing: later.
- **Wild battles**: the party against one wild Pokémon (an easy CPU), "A wild X appeared!". Esc runs away.
  Wild Pokémon roll their own **IVs** (0–31), kept when caught.
- **Catching**: after a win, one ball (Poké / Great / Ultra / Master): the Gen 8 formula as planned (no performance
  bonus), 4 shake checks; if it breaks free it flees; you can also let it go. **The throw plays out** as in the
  games (`ui/screens/capture.ts`): the ball arcs in, the Pokémon turns to red light and is drawn inside, the ball
  drops and wobbles once per shake check passed, then clicks shut (a green light, stars, "Gotcha!") or bursts open
  ("Aargh! Almost had it!": the games' lines by the number of wobbles). A skips to the end. A caught Pokémon arrives rested (full
  HP) and joins the party, or the box when the party is full.
- **Money**: start ₽3000 and 5 Poké Balls. Battle field (trainers) pays the sum of their levels × 20; wild Pokémon
  pay nothing. **Losing** (wild or trainer): half the money is lost, the party is healed, back to the city.
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
- **The ending**: the rival's and the Professor's last words, the **Hall of Fame** (saved, one entry per win), the
  credits, and the **next-region hook**. Only Kanto exists, so the journey stays in Kanto as Champion (★ in the
  city), and the League can be challenged again.
- **Next region (decided default, the question had no answer)**: the party, box, money and Pokédex travel along;
  badges and the League start over. `src/data/regions/index.ts` lists the regions in order; a new region is a new
  data file plus its generated Pokémon data.
- **Save version 5**: region, champion, Hall of Fame.

## 7. Architecture

### 7.1 Stack (same as poke-gacha)

- **TypeScript + Vite**, no UI framework: menus in **DOM** (easy to style, accessible, easy to target in Playwright);
  the fight in **Canvas 2D**.
- **Vitest** for all game rules and the fight simulation.
- **Playwright** for end-to-end flows, running in **GitHub Actions** (`ci.yml`).
- **A temporary study deploy** (decided 2026-11-09): `pages.yml` builds on every push to `main` (type check, unit
  tests, `vite build` with the base `/poke-fight/`) and publishes `dist/` to GitHub Pages. The link is never shared
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
- **The world map** is pixel art too (`render/kanto-map.ts`): the sea with surf and shallows, a rugged coast and
  beaches, mountain **ranges** (several peaks each, lit and shaded faces, crevices, snow) instead of triangles,
  forests of little trees, a lake and a river, roads that turn on the map's axes (dotted over the sea, grey while
  locked), and each city as a little town. The city buttons are rings around them.
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

### 7.5 Region scalability

- A region is `{ id, typeChart, speciesRange, cities[], gyms[], league, starters, rival, shops, story }`.
- Generated data per generation (`gen1.json`, `gen2.json`…) like poke-gacha.
- The save stores `currentRegion` and per-region progress (badges, unlocks), plus global data (Pokédex, box).

## 8. Testing strategy (QA focus)

### 8.1 Vitest (logic, fast)

- **Frame data tests**: "physical attack hits on frame 6 and recovers on frame 21", "a press buffered during recovery
  fires on the first free frame", "a hit on back-dash frame 6 misses, on frame 7 it lands", "a hit during the big
  special's charge cancels it and the PP is lost", "the big special can't start without a full PP bar",
  "the elemental special can't start below ¼ PP", "a landed tackle adds PP, being hit doesn't".
- **Input latency test**: press on frame N → state shows the action starting on frame N (target 0, at most 1 frame).
- **Replay / golden tests**: recorded input logs + seed → final state hash. Any engine change that alters a result
  fails clearly (and is updated on purpose when the design changes).
- **Rules**: damage, type chart (full table), XP/level curves, evolution triggers, catch probability (formula +
  statistical test with a fixed seed), shop prices, unlock order, save migrations.
- **AI**: profiles behave within ranges (e.g., the "defensive" profile guards ≥ X% of attacks over 1000 frames).

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
| Capture | No performance bonus; the Gen 8 formula's shape (catch rate, ball, difficulty) with a fixed HP term of 0.2 and no low-level bonus: a common Pokémon takes 3–4 fights |
| Specials | Two slots: elemental (K, always a range attack, ¼ PP) and big (I, full PP bar + long charge) |
| PP bar | Replaces the Power gauge. One per Pokémon, starts half full, fills only when your hits land |
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
| League | The Red/Blue Elite Four; the Champion is the rival with the matching Red/Blue team |
| Next region | Party, box, money and Pokédex carry over; badges and League start over (default) |
| Back dash | Invincible on its first 6 frames, punishable after |
| Capture failure | One throw per win; if it breaks free, it flees |
| Look | Console style (milestone 11): a 16:9 frame, the place's art behind glass menus and bright cards, Barlow Condensed + Inter |
| Art | Trainers, characters and backgrounds from Pokémon Showdown; items and badges from PokeAPI; all by URL, painted stand-ins until they load |
| Menus and controller | Spatial navigation (by direction), focus kept on redraw, hint glyphs for the device in use, Y opens the party |
| Pokédex | A screen (grid + page) that reveals more as you see and catch; releasing is in the box, the dex keeps "caught"; wild fights show a Poké Ball (color: you have it) by the name |
| Party order | Reorder in the party screen (pick up, then swap); the first Pokémon leads. The two slots glide into each other's places; a screen redrawn after a change doesn't play its entrance again |
| Switching | Once mid-round (Tab / View), again only after a faint; after every faint the player picks the next fighter. A mid-round switch continues the same round from where everyone stood |
| CPU per Pokémon | Skill from who controls it (wild clumsy, trainers at their difficulty) plus its evolution stage and level; style from its stats; a new seed every fight |
| Fishing | Each rod also hooks the next rod's Pokémon 30% of the time (the Old Rod isn't only Magikarp) |
| Towns and map | Top-down pixel art painted by code (original drawings), not pictures |
| Results | XP cards per Pokémon (level, XP bar filling from where it was, level ups, new moves); "Hunt again" after wild and Safari battles |
| Options | One screen for sound, language (also kept on the device, without a save) and keys; New game asks in-game before erasing |
| Entrance | Trainers throw their balls before each Pokémon (72 frames, inputs ignored); the browser tests skip it (`?entrance=0`) |
| Music | Original loops only (no copied themes); cries are the games' recordings by URL |
| Settings | Sound, volumes and keys live apart from the save (`poke-fight.settings`), one custom key per action, arrows always move |
| Balance pass | Deferred until there is playtest data (numbers stay pinned in tests) |
| Deploy | A temporary GitHub Pages deploy to study how it's done (link never shared, `noindex`, removed after a day or two) |

### Still open

1. **Gym trainers and rematches**: trainers to beat before each leader, and rematching leaders later?
2. **Post-game**: legendary encounters (Articuno, Zapdos, Moltres, Mewtwo in Cerulean Cave), as in Red/Blue?
