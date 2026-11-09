// Sound through the Web Audio API: synthesized effects, the chiptune music (music.ts) and the Pokémon's cries.
// Browsers only allow sound after the player interacts with the page, so nothing plays before unlock().
// In test mode the game uses createSilentAudio(): the browser tests stay quiet and never fetch cries.

import { compileSong, SONGS, type CompiledSong, type SongId } from './music';
import type { SoundId } from './cues';
import { DEFAULT_VOLUMES, MAX_VOLUME, type Volumes } from '../state/settings';

export interface Audio {
  /** Call on the first click or key press (the browser's autoplay rule). */
  unlock(): void;
  play(sound: SoundId): void;
  /** Starts a song (or keeps it going if it's already playing); null stops the music. */
  music(song: SongId | null): void;
  cry(speciesId: number): void;
  setMuted(muted: boolean): void;
  /** Levels 0–10 for the music, the effects and the cries (state/settings.ts). */
  setVolumes(volumes: Volumes): void;
}

export const createSilentAudio = (): Audio => ({ unlock() {}, play() {}, music() {}, cry() {}, setMuted() {}, setVolumes() {} });

/** The cries recorded from the games, as PokeAPI hosts them (like the sprites, loaded only when needed). */
const cryUrl = (speciesId: number) => `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${speciesId}.ogg`;

/**
 * Each bus's gain at level 10. The cries are recordings at full loudness while the music is a soft synth: at the
 * default levels (music 6, sounds 6, cries 3) the music bus is 0.16, the effects 0.5 and a cry about 0.08, so a cry
 * sits just above the music instead of drowning it (it was 0.35, outside the mix, before).
 */
export const BUS_GAIN: Record<keyof Volumes, number> = { music: 0.45, sounds: 1.4, cries: 0.9 };

/** A level (0–10) → a gain. Squared, so the steps sound even (loudness is closer to logarithmic than linear). */
export const gainOf = (kind: keyof Volumes, level: number) => BUS_GAIN[kind] * (level / MAX_VOLUME) ** 2;

export function createWebAudio(startMuted: boolean, startVolumes: Volumes = DEFAULT_VOLUMES): Audio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let cryBus: GainNode | null = null;
  let volumes = startVolumes;
  let noise: AudioBuffer | null = null;
  let muted = startMuted;
  let wanted: SongId | null = null;
  let playing: { id: SongId; song: CompiledSong; step: number; time: number } | null = null;
  const compiled = new Map<SongId, CompiledSong>();
  const cries = new Map<number, HTMLAudioElement>();

  const now = () => ctx!.currentTime;

  /** One synthesized note: an oscillator with a pitch slide and a quick fade. */
  const tone = (bus: AudioNode, type: OscillatorType, from: number, to: number, start: number, duration: number, volume: number) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  /** A burst of noise through a filter (hits, drums, whooshes). */
  const hiss = (bus: AudioNode, filter: BiquadFilterType, frequency: number, start: number, duration: number, volume: number) => {
    const source = ctx!.createBufferSource();
    source.buffer = noise;
    const band = ctx!.createBiquadFilter();
    band.type = filter;
    band.frequency.value = frequency;
    const gain = ctx!.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(band).connect(gain).connect(bus);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
  };

  const SOUNDS: Record<SoundId, (t: number, bus: AudioNode) => void> = {
    hit: (t, bus) => {
      hiss(bus, 'bandpass', 1800, t, 0.08, 0.7);
      tone(bus, 'square', 320, 70, t, 0.09, 0.25);
    },
    bigHit: (t, bus) => {
      hiss(bus, 'lowpass', 1200, t, 0.35, 0.9);
      tone(bus, 'square', 220, 40, t, 0.3, 0.35);
      tone(bus, 'sawtooth', 110, 30, t, 0.4, 0.25);
    },
    block: (t, bus) => {
      tone(bus, 'triangle', 1100, 700, t, 0.08, 0.35);
      hiss(bus, 'highpass', 5000, t, 0.05, 0.3);
    },
    charge: (t, bus) => tone(bus, 'sine', 280, 900, t, 0.25, 0.18),
    ko: (t, bus) => {
      tone(bus, 'square', 660, 60, t, 0.7, 0.3);
      hiss(bus, 'lowpass', 900, t, 0.6, 0.6);
    },
    jump: (t, bus) => tone(bus, 'square', 260, 560, t, 0.09, 0.12),
    dash: (t, bus) => hiss(bus, 'bandpass', 900, t, 0.14, 0.45),
    select: (t, bus) => tone(bus, 'square', 880, 880, t, 0.03, 0.08),
    confirm: (t, bus) => {
      tone(bus, 'square', 660, 660, t, 0.05, 0.1);
      tone(bus, 'square', 990, 990, t + 0.05, 0.08, 0.1);
    },
    ballThrow: (t, bus) => {
      tone(bus, 'sine', 400, 1300, t, 0.22, 0.15);
      hiss(bus, 'highpass', 3000, t, 0.2, 0.15);
    },
    ballOpen: (t, bus) => {
      hiss(bus, 'bandpass', 2500, t, 0.2, 0.5);
      [784, 988, 1175, 1568].forEach((f, i) => tone(bus, 'triangle', f, f, t + i * 0.04, 0.18, 0.12));
    },
    shake: (t, bus) => {
      tone(bus, 'square', 180, 140, t, 0.05, 0.2);
      hiss(bus, 'bandpass', 600, t, 0.05, 0.3);
    },
    caught: (t, bus) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(bus, 'square', f, f, t + i * 0.09, 0.12, 0.12)),
    levelUp: (t, bus) => [523, 587, 659, 784, 1047].forEach((f, i) => tone(bus, 'triangle', f, f, t + i * 0.07, 0.12, 0.18)),
    // Legendary bosses: an ominous rising warning (two detuned voices), a whoosh, and a deep blast.
    bossWarn: (t, bus) => {
      tone(bus, 'sawtooth', 98, 196, t, 0.55, 0.12);
      tone(bus, 'sawtooth', 104, 208, t, 0.55, 0.1);
      tone(bus, 'sine', 392, 784, t + 0.3, 0.3, 0.08);
    },
    bossSweep: (t, bus) => {
      hiss(bus, 'bandpass', 700, t, 0.4, 0.7);
      hiss(bus, 'highpass', 4000, t + 0.05, 0.25, 0.25);
      tone(bus, 'square', 340, 70, t, 0.35, 0.18);
    },
    bossBlast: (t, bus) => {
      hiss(bus, 'lowpass', 700, t, 0.5, 0.9);
      tone(bus, 'sine', 90, 28, t, 0.5, 0.5);
      tone(bus, 'square', 160, 40, t, 0.2, 0.15);
    },
  };

  /** Music: a scheduler fills the next ~0.2 s of notes, so timing stays exact even if the page stutters. */
  const scheduleMusic = () => {
    if (!ctx || !musicBus || !playing) return;
    const { song } = playing;
    while (playing.time < now() + 0.2) {
      const step = playing.step % song.steps;
      for (const note of song.notes) {
        if (note.step !== step) continue;
        const t = playing.time;
        const length = note.length * song.stepSeconds;
        if (note.voice === 'lead') tone(musicBus, 'square', note.frequency, note.frequency, t, length * 0.95, 0.12);
        else if (note.voice === 'bass') tone(musicBus, 'triangle', note.frequency, note.frequency, t, length * 1.8, 0.35);
        else if (note.voice === 'arp') tone(musicBus, 'square', note.frequency, note.frequency, t, length * 0.6, 0.025);
        else if (note.voice === 'kick') tone(musicBus, 'sine', 150, 45, t, 0.12, 0.6);
        else if (note.voice === 'snare') hiss(musicBus, 'bandpass', 1800, t, 0.1, 0.35);
        else hiss(musicBus, 'highpass', 7000, t, 0.03, 0.12);
      }
      playing.step++;
      playing.time += song.stepSeconds;
    }
  };

  const startWanted = () => {
    if (!ctx || playing?.id === wanted) return;
    if (!wanted) {
      playing = null;
      return;
    }
    if (!compiled.has(wanted)) compiled.set(wanted, compileSong(SONGS[wanted]));
    playing = { id: wanted, song: compiled.get(wanted)!, step: 0, time: now() + 0.05 };
  };

  return {
    unlock() {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = gainOf('music', volumes.music);
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = gainOf('sounds', volumes.sounds);
      sfxBus.connect(master);
      cryBus = ctx.createGain();
      cryBus.gain.value = gainOf('cries', volumes.cries);
      cryBus.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      setInterval(scheduleMusic, 50);
      startWanted();
    },
    play(sound) {
      if (!ctx || !sfxBus || muted) return;
      SOUNDS[sound](now(), sfxBus);
    },
    music(song) {
      if (song === wanted) return;
      wanted = song;
      startWanted();
    },
    cry(speciesId) {
      if (!ctx || !cryBus || muted) return;
      let element = cries.get(speciesId);
      if (!element) {
        element = new window.Audio();
        // Through the mix (the cries' bus, then the master), which needs the file with CORS (GitHub sends it).
        element.crossOrigin = 'anonymous';
        element.src = cryUrl(speciesId);
        ctx.createMediaElementSource(element).connect(cryBus);
        cries.set(speciesId, element);
      }
      element.currentTime = 0;
      // A cry that can't load (offline) is simply skipped.
      element.play().catch(() => undefined);
    },
    setVolumes(next) {
      volumes = next;
      if (!ctx) return;
      musicBus?.gain.setTargetAtTime(gainOf('music', next.music), now(), 0.02);
      sfxBus?.gain.setTargetAtTime(gainOf('sounds', next.sounds), now(), 0.02);
      cryBus?.gain.setTargetAtTime(gainOf('cries', next.cries), now(), 0.02);
    },
    setMuted(next) {
      muted = next;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, now(), 0.02);
    },
  };
}
