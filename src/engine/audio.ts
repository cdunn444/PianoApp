import * as Tone from 'tone';
import unmuteIosAudio from 'unmute-ios-audio';

/** Transport resolution: ticks per quarter note. All scheduling uses tick strings ("192i"). */
export const PPQ = 192;

const SAMPLE_NOTES = [
  'A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4',
  'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8',
];

let sampler: Tone.Sampler | null = null;
let click: Tone.Synth | null = null;
let accentClick: Tone.Synth | null = null;
let loadPromise: Promise<void> | null = null;
let unlocked = false;

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
let loadState: LoadState = 'idle';
const listeners = new Set<(s: LoadState) => void>();

export function onLoadState(fn: (s: LoadState) => void): () => void {
  listeners.add(fn);
  fn(loadState);
  return () => listeners.delete(fn);
}

function setLoadState(s: LoadState) {
  loadState = s;
  listeners.forEach((fn) => fn(s));
}

export function getLoadState(): LoadState {
  return loadState;
}

function sampleUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const n of SAMPLE_NOTES) urls[n] = `${n.replace('#', 's')}.mp3`;
  return urls;
}

/** Start loading the piano samples. Safe to call many times. Does not need a user gesture. */
export function preloadPiano(): Promise<void> {
  if (loadPromise) return loadPromise;
  setLoadState('loading');
  Tone.getTransport().PPQ = PPQ;
  loadPromise = new Promise<void>((resolve, reject) => {
    sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
      release: 1,
      onload: () => {
        setLoadState('ready');
        resolve();
      },
      onerror: (e) => {
        setLoadState('error');
        reject(e);
      },
    }).toDestination();
    sampler.volume.value = -4;
    click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
    click.volume.value = -12;
    accentClick = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
    }).toDestination();
    accentClick.volume.value = -8;
  });
  return loadPromise;
}

/** Must be called from a user gesture (tap) on iOS before any sound can play. */
export async function unlockAudio(): Promise<void> {
  if (!unlocked) {
    unlocked = true;
    try {
      unmuteIosAudio();
    } catch {
      /* not iOS */
    }
  }
  await Tone.start();
  await preloadPiano();
}

export function isUnlocked(): boolean {
  return unlocked && Tone.getContext().state === 'running';
}

/** Play a note. `time` is a Tone time (seconds or tick string); omit for "now". */
export function playNote(midi: number, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity = 0.9): void {
  if (!sampler || loadState !== 'ready') return;
  const freq = Tone.Frequency(midi, 'midi').toFrequency();
  try {
    sampler.triggerAttackRelease(freq, duration, time, velocity);
  } catch {
    /* ignore scheduling races */
  }
}

export function playClick(accent: boolean, time?: Tone.Unit.Time): void {
  const s = accent ? accentClick : click;
  if (!s) return;
  try {
    s.triggerAttackRelease(accent ? 1600 : 1100, 0.03, time);
  } catch {
    /* ignore */
  }
}

/** Beats to a tick-string Tone time. */
export function beatsToTicks(beats: number): string {
  return `${Math.max(1, Math.round(beats * PPQ))}i`;
}
