import { pitchClassOf } from '../model/music';
import type { ParsedChord } from './chords';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Diatonic triad qualities for degrees I..vii in a major key: 'M' major, 'm' minor, 'd' diminished.
const DIATONIC = ['M', 'm', 'm', 'M', 'M', 'm', 'd'];

function quality(ch: ParsedChord): 'M' | 'm' | 'd' | '?' {
  if (ch.intervals.includes(4)) return 'M';
  if (ch.intervals.includes(3) && ch.intervals.includes(6)) return 'd';
  if (ch.intervals.includes(3)) return 'm';
  return '?';
}

/** Guess a key name from the chords in a song. Returns e.g. 'G' or 'Em'. */
export function guessKeyFromChords(chords: ParsedChord[]): string {
  if (chords.length === 0) return 'C';
  let best = 0;
  let bestScore = -1;
  for (let tonic = 0; tonic < 12; tonic++) {
    let score = 0;
    for (const ch of chords) {
      const degree = MAJOR_SCALE.indexOf((ch.root - tonic + 12) % 12);
      if (degree < 0) continue;
      score += 1;
      const q = quality(ch);
      if (q === '?' || DIATONIC[degree] === q) score += 1;
      if (degree === 0 && q === 'M') score += 0.5;
    }
    // Tie-break: prefer the first chord's root as tonic.
    if (chords[0].root === tonic) score += 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = tonic;
    }
  }
  const first = chords[0];
  const relMinor = (best + 9) % 12;
  if (first.root === relMinor && quality(first) === 'm') return KEY_NAMES[relMinor] + 'm';
  return KEY_NAMES[best];
}

/** Guess a key from the pitch classes in use (melody/tab import). */
export function guessKeyFromPitches(midis: number[]): string {
  if (midis.length === 0) return 'C';
  const hist = new Array<number>(12).fill(0);
  for (const m of midis) hist[((m % 12) + 12) % 12] += 1;
  let best = 0;
  let bestScore = -1;
  for (let tonic = 0; tonic < 12; tonic++) {
    let score = 0;
    for (const d of MAJOR_SCALE) score += hist[(tonic + d) % 12];
    score += hist[tonic] * 0.5 + hist[(tonic + 7) % 12] * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = tonic;
    }
  }
  const lastPc = ((midis[midis.length - 1] % 12) + 12) % 12;
  if (lastPc === (best + 9) % 12) return KEY_NAMES[(best + 9) % 12] + 'm';
  return KEY_NAMES[best];
}

export function keyTonicPc(key: string): number {
  return pitchClassOf(key.replace(/m(in(or)?)?$/i, '')) ?? 0;
}
