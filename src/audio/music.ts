// The music, as data: short original chiptune loops (one per kind of scene), written as chords and a lead melody.
// Pure (no Web Audio): compileSong() turns a song into timed notes, which audio.ts plays.

export type SongId = 'title' | 'town' | 'battle' | 'gym' | 'league' | 'victory';

export interface Song {
  bpm: number;
  /** One chord per bar ("C", "Am", "F#m", "Bb"…): the bass and the arpeggio follow it. */
  chords: string[];
  /**
   * The melody: 16 steps (sixteenth notes) per bar. A note ("C5", "F#4", "Bb5") starts a note, "-" holds the one
   * before, "." is silence.
   */
  lead: string;
  /** Kick, snare and hi-hat. */
  drums: boolean;
}

export const STEPS_PER_BAR = 16;

export const SONGS: Record<SongId, Song> = {
  // Bright and hopeful: the adventure is ahead.
  title: {
    bpm: 112,
    chords: ['C', 'Am', 'F', 'G'],
    lead: `E5 - - G5 - - C6 - B5 - G5 - E5 - - -
           A5 - - G5 - - E5 - C5 - D5 - E5 - - -
           F5 - - A5 - - C6 - A5 - F5 - G5 - A5 -
           G5 - - - D5 - G5 - B5 - - - . . . .`,
    drums: false,
  },
  // Easygoing, for the city and the menus.
  town: {
    bpm: 96,
    chords: ['F', 'C', 'Dm', 'Bb'],
    lead: `A4 - C5 - F5 - - - E5 - C5 - A4 - - -
           G4 - C5 - E5 - - - D5 - C5 - G4 - - -
           F4 - A4 - D5 - - - C5 - A4 - F4 - G4 -
           F4 - - - D5 - - - C5 - - - . . . .`,
    drums: false,
  },
  // Driving, in A minor.
  battle: {
    bpm: 150,
    chords: ['Am', 'F', 'G', 'E'],
    lead: `A4 . A4 C5 E5 . A5 . G5 . E5 . C5 . D5 E5
           F5 . F5 . A5 . C6 . A5 . F5 . E5 . C5 .
           D5 . G5 . B5 . D6 . B5 . G5 . D5 . B4 .
           E5 . G#5 . B5 . E6 - - - D6 . B5 . G#5 .`,
    drums: true,
  },
  // Tense: a leader is waiting.
  gym: {
    bpm: 138,
    chords: ['Dm', 'Bb', 'C', 'A'],
    lead: `D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -
           D5 - F5 - Bb5 - - - A5 - G5 - F5 - - -
           E5 - G5 - C6 - - - Bb5 - A5 - G5 - - -
           C#5 - E5 - A5 - - - G5 - E5 - C#5 - - -`,
    drums: true,
  },
  // Grand, for the Elite Four and the Champion.
  league: {
    bpm: 128,
    chords: ['Em', 'C', 'D', 'B'],
    lead: `E5 - - - B4 - E5 - G5 - - - F#5 - E5 -
           E5 - - - C5 - E5 - G5 - - - A5 - G5 -
           F#5 - - - D5 - F#5 - A5 - - - B5 - A5 -
           B5 - - - F#5 - - - D#5 - - - . . . .`,
    drums: true,
  },
  // A short fanfare after a win.
  victory: {
    bpm: 132,
    chords: ['C', 'F', 'G', 'C'],
    lead: `C5 . E5 . G5 . C6 - - - G5 . C6 - - -
           A5 . F5 . A5 . C6 - - - A5 . F5 - - -
           B5 . G5 . B5 . D6 - - - B5 . G5 - - -
           C6 - - - G5 - - - C6 - - - . . . .`,
    drums: false,
  },
};

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" → 440 Hz; "C#5", "Bb3"… (equal temperament). */
export function noteFrequency(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Not a note: ${note}`);
  const [, letter, accidental, octave] = match;
  const semitone = SEMITONES[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const midi = (Number(octave) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A chord's notes from its name: "C" → C E G; "Am" → A C E (as frequencies, around `octave`). */
export function chordNotes(chord: string, octave: number): number[] {
  const match = /^([A-G][#b]?)(m?)$/.exec(chord);
  if (!match) throw new Error(`Not a chord: ${chord}`);
  const root = noteFrequency(`${match[1]}${octave}`);
  const third = match[2] === 'm' ? 3 : 4;
  return [0, third, 7].map(semitones => root * 2 ** (semitones / 12));
}

export type Voice = 'lead' | 'bass' | 'arp' | 'kick' | 'snare' | 'hat';

export interface Note {
  /** The step it starts on (a sixteenth note). */
  step: number;
  /** How many steps it lasts. */
  length: number;
  voice: Voice;
  /** Hz (0 for drums). */
  frequency: number;
}

export interface CompiledSong {
  notes: Note[];
  /** The loop's length in steps. */
  steps: number;
  /** Seconds per step. */
  stepSeconds: number;
}

export function compileSong(song: Song): CompiledSong {
  const steps = song.chords.length * STEPS_PER_BAR;
  const tokens = song.lead.trim().split(/\s+/);
  if (tokens.length !== steps) throw new Error(`The lead has ${tokens.length} steps; its ${song.chords.length} bars need ${steps}`);
  const notes: Note[] = [];

  // The lead: each note lasts until the next note or silence.
  tokens.forEach((token, step) => {
    if (token === '-' || token === '.') return;
    let length = 1;
    while (tokens[step + length] === '-') length++;
    notes.push({ step, length, voice: 'lead', frequency: noteFrequency(token) });
  });

  song.chords.forEach((chord, bar) => {
    const start = bar * STEPS_PER_BAR;
    const [root, , fifth] = chordNotes(chord, 2);
    // The bass: root and fifth, on eighth notes.
    [root, root, fifth, root, root, fifth, root * 2, fifth].forEach((frequency, i) =>
      notes.push({ step: start + i * 2, length: 1, voice: 'bass', frequency }),
    );
    // A soft arpeggio of the chord, on sixteenths.
    const tones = chordNotes(chord, 4);
    for (let i = 0; i < STEPS_PER_BAR; i++) notes.push({ step: start + i, length: 1, voice: 'arp', frequency: tones[i % 3] * (i % 6 >= 3 ? 2 : 1) });
    if (song.drums) {
      for (let i = 0; i < STEPS_PER_BAR; i += 2) {
        const voice: Voice = i % 8 === 0 ? 'kick' : i % 8 === 4 ? 'snare' : 'hat';
        notes.push({ step: start + i, length: 1, voice, frequency: 0 });
      }
    }
  });

  notes.sort((a, b) => a.step - b.step);
  return { notes, steps, stepSeconds: 60 / song.bpm / 4 };
}
