# Poké Fight — Project Plan

A study project: a real-time 2D fighting game (in the style of KOF / Street Fighter) with a Pokémon journey around it:
pick a starter, hunt and catch, earn XP, evolve, beat the gyms and the League. It runs in the browser on your own
machine only. **It is not distributed**: no deploy, no hosting, no store. Pokémon sprites and data are used only
because they are convenient.

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
  the starter rests (full HP) and the player sets off to **Viridian City**.
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

- Side view, a single flat stage with a background per location (grass, cave, gym, etc.).
- **Trainers** stand in the background at the left and right edges. Intro: trainer throws a Pokéball → ball arcs →
  flash → Pokémon appears. KO: the trainer recalls it (red beam), or the next one comes out in team fights.
- Wild battles: no opponent trainer on the right, and the wild Pokémon jumps in from off-screen.
- HUD: HP bars with name, level and types at the top, round timer, and a type-effectiveness flash on hit
  ("Super effective!").

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

Every key can be rebound, and controllers use the browser Gamepad API (polled every frame).
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
  you pick yours from the party (a quick menu with the fight paused), the CPU follows its team order. The
  Pokémon that stays keeps the HP it has left, and HP carries over after the battle. You lose when all your
  Pokémon have fainted (→ back to the last Pokémon Center, lose some money, like the games).
  ❓ Later: switching mid-fight (a "recall" button with a few vulnerable frames).
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

## 5. Progression systems

- **XP**: official formula (`base_experience · level / 7`, ×1.5 for trainer battles), growth rates from the data
  (fast, medium-fast, medium-slow, slow). Shared XP for party members who fought (team battles).
- **Level up**: stats recalculated; new moves learned → choose the equipped special.
- **Evolution**: official methods: level, stone (bought at the mall), trade (❓ replace with an item such as
  "Link Cable", like in poke-gacha). Evolving can be cancelled (B).
- **Capture** (wild battles only): after you win, the defeated Pokémon is worn out and you can throw a ball from the
  bag. **No performance bonus**: only the ball, the species and the levels count, using the **official modern
  formula** (Sword/Shield, Gen 8), the most recent one that uses level:

  ```
  X = HPterm × catchRate × ball × lowLevel × difficulty × status
  ```

  | Term | Value |
  |------|-------|
  | `HPterm` | Fixed at **1**: a defeated Pokémon counts as worn out (like Max Raids). It does not depend on how you won. |
  | `catchRate` | Species catch rate from the data (Pidgey 255, Pikachu 190, Snorlax 25, Mewtwo 3) |
  | `ball` | Poké ×1, Great ×1.5, Ultra ×2, Safari ×1.5, Master = always. Later regions add Nest Ball (`(41 − level)/10` below Lv. 30), Net, Dusk, Level Ball… as data. |
  | `lowLevel` | Wild level < 21 → `(30 − level) / 10` (Lv. 5 = ×2.5, Lv. 15 = ×1.5), otherwise ×1 |
  | `difficulty` | Before the 8th badge, if the wild Pokémon's level is **higher than your Pokémon's** → ×0.1 |
  | `status` | ×1 (no status effects yet; sleep ×2.5, paralysis/poison/burn ×1.5 when they exist) |

  - If `X ≥ 255` it is caught. Otherwise there are **4 shake checks**, each passing with
    `Y/65536` where `Y = 65536 / (255/X)^(3/16)`. Overall chance ≈ `(X/255)^0.75`. Each passed check = one wobble.
  - Examples: wild Lv. 30 Snorlax: Poké Ball ≈ 18%, Great ≈ 24%, Ultra ≈ 30%. Lv. 70 Mewtwo + Ultra ≈ 6%.
    Common Pokémon (catch rate 255) are always caught, as in the games when they're at 1 HP.
  - Note: the real formula only uses level through `lowLevel`, `difficulty` and some balls, so "level matters"
    mostly means "low-level Pokémon are easy, and stronger ones than yours are hard".
  - Gen 8 "critical capture" is left out (simpler).
  - **One throw per win**: if the Pokémon breaks free, it **flees**. You still keep the battle's XP. The ball is used up either way.
  - So the choice of ball matters: a rare Pokémon is worth an Ultra Ball, because there is no second try.
- **Party and PC**: 6 in the party, the rest in a box (simple list screen).
- **Money**: from trainer, gym and League wins. Wild battles give little or none.
- **Pokédex**: seen / caught.

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

## 7. Architecture

### 7.1 Stack (same as poke-gacha)

- **TypeScript + Vite**, no UI framework: menus in **DOM** (easy to style, accessible, easy to target in Playwright);
  the fight in **Canvas 2D**.
- **Vitest** for all game rules and the fight simulation.
- **Playwright** for end-to-end flows, running in **GitHub Actions** (CI only: no deploy step).
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
- Trainers in the background: trainer sprites (static) + a throw animation.

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
- **Flows**: new game → starter → rival tutorial → Viridian → buy balls → hunt → win → capture → level up → evolve →
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
| 6 | ✅ **Prologue** | Title → starter → interactive rival tutorial → arrive at Viridian |
| 7 | **World loop** | World map, cities, hunt (grass/water/cave), capture with balls, Pokémon Center, first shop, box |
| 8 | **Gyms** | KOF-style team battles, trainers, 8 gyms with AI styles, badges unlock cities, mall, Safari Zone |
| 9 | **League** | Elite Four + Champion, credits, "next region" hook (scalability check) |
| 10 | **Juice & polish** | Sound effects, music, cries, screen shake, particles, rebinding UI, options, balance pass |

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
| Capture | No performance bonus; official Gen 8 formula (catch rate, ball, level modifiers), fixed worn-out HP term |
| Specials | Two slots: elemental (K, always a range attack, ¼ PP) and big (I, full PP bar + long charge) |
| PP bar | Replaces the Power gauge. One per Pokémon, starts half full, fills only when your hits land |
| Big dash | A shape of the big special: physical moves become a Rush that passes through the opponent |
| Dash through | The dash passes through the opponent (no push box), to attack from behind |
| Sprites | Loaded by URL (no local copy) |
| Tackle type | None: always neutral, no same-type bonus |
| Big special power | The move's own power (no ×2) |
| Languages | English and Portuguese (Pokémon and move names in English) |
| Tackle loop | Kept as it is: a fast tackle spammer beating the hard CPU is accepted |
| Back dash | Invincible on its first 6 frames, punishable after |
| Capture failure | One throw per win; if it breaks free, it flees |

### Still open

1. **Mall**: Saffron (your idea) or Celadon (canonical department store)?
2. **Trade evolutions**: an item (Link Cable) or another rule?
3. **Next region**: what carries over to the new journey?
(none right now: new questions come up as we build)
