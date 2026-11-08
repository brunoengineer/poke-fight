import { describe, expect, it } from 'vitest';
import { createFight } from '../fight/state';
import type { Fighter } from '../fight/state';
import { ENTRANCE } from '../screens/entrance';
import { fightCues, freshCues, type FrameView } from './cues';
import { chordNotes, compileSong, noteFrequency, SONGS, STEPS_PER_BAR, type SongId } from './music';

describe('music', () => {
  it('note names → frequencies (A4 = 440 Hz)', () => {
    expect(noteFrequency('A4')).toBe(440);
    expect(noteFrequency('A5')).toBeCloseTo(880);
    expect(noteFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteFrequency('Bb3')).toBeCloseTo(noteFrequency('A#3'));
    expect(() => noteFrequency('H2')).toThrow();
  });

  it('major and minor chords', () => {
    const ratios = (chord: string) => chordNotes(chord, 4).map(f => Math.round((12 * Math.log2(f / chordNotes(chord, 4)[0])) * 100) / 100);
    expect(ratios('C')).toEqual([0, 4, 7]);
    expect(ratios('Am')).toEqual([0, 3, 7]);
  });

  it.each(Object.keys(SONGS) as SongId[])('“%s” has one bar of melody per chord, and plays', id => {
    const song = compileSong(SONGS[id]);
    expect(song.steps).toBe(SONGS[id].chords.length * STEPS_PER_BAR);
    expect(song.notes.filter(n => n.voice === 'lead').length).toBeGreaterThan(8);
    expect(song.notes.every(n => n.step >= 0 && n.step < song.steps)).toBe(true);
    expect(song.notes.some(n => n.voice === 'kick')).toBe(SONGS[id].drums);
  });

  it('a held note lasts until the next one', () => {
    const lead = compileSong(SONGS.title).notes.filter(n => n.voice === 'lead');
    expect(lead[0]).toMatchObject({ step: 0, length: 3, frequency: noteFrequency('E5') });
    expect(lead[1]).toMatchObject({ step: 3, length: 3 });
  });
});

describe('fight sounds', () => {
  const view = (change: (f: [Fighter, Fighter]) => void = () => {}, extra: Partial<FrameView> = {}): FrameView => {
    const fighters = createFight().fighters.map(f => ({ ...f })) as [Fighter, Fighter];
    change(fighters);
    return { fighters, entrance: null, trainers: [{}, {}], ...extra };
  };

  it('a hit, a big hit, a block, a K.O.', () => {
    const cues = fightCues(freshCues(), view(), [
      { type: 'hit', attacker: 0, defender: 1, damage: 10, big: false, effectiveness: 1, source: 'physical', combo: 1 },
      { type: 'block', attacker: 1, defender: 0, damage: 1, source: 'physical' },
    ] as never);
    expect(cues.sounds).toEqual(['hit', 'block']);
    expect(fightCues(freshCues(), view(), [{ type: 'hit', big: true } as never, { type: 'ko', loser: 1 } as never]).sounds).toEqual(['bigHit', 'ko']);
  });

  it('jump, dash and charge sound once, when they start', () => {
    const jumping = view(([p1]) => (p1.action = 'prejump'));
    const first = fightCues(freshCues(), jumping, []);
    expect(first.sounds).toEqual(['jump']);
    expect(fightCues(first.memory, jumping, []).sounds).toEqual([]);
    expect(fightCues(first.memory, view(([p1, p2]) => ((p1.action = 'dash'), (p2.action = 'big'))), []).sounds).toEqual(['dash', 'charge']);
  });

  it('the entrance: the throw, then the ball opens and each Pokémon cries', () => {
    const entrance = (frame: number) => ({ frame, sides: [true, true] as [boolean, boolean], first: true });
    const species = (fighters: [Fighter, Fighter]) => ((fighters[0].speciesId = 4), (fighters[1].speciesId = 74));
    expect(fightCues(freshCues(), view(species, { entrance: entrance(ENTRANCE.throwStart) }), []).sounds).toEqual(['ballThrow']);
    const burst = fightCues(freshCues(), view(species, { entrance: entrance(ENTRANCE.burst) }), []);
    expect(burst).toMatchObject({ sounds: ['ballOpen'], cries: [4, 74] });
    expect(fightCues(freshCues(), view(species, { entrance: entrance(ENTRANCE.burst + 1) }), []).cries).toEqual([]);
  });

  it('a wild Pokémon (no trainer): no ball, just its cry', () => {
    const entrance = { frame: ENTRANCE.burst, sides: [false, true] as [boolean, boolean], first: true };
    const cues = fightCues(freshCues(), view(f => (f[1].speciesId = 16), { entrance, trainers: [{}, null] }), []);
    expect(cues).toMatchObject({ sounds: [], cries: [16] });
  });
});
