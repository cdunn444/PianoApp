import { pitchClassOf } from '../model/music';

export interface ParsedChord {
  name: string;
  /** Root pitch class 0-11. */
  root: number;
  /** Intervals in semitones above the root, e.g. [0,4,7]. */
  intervals: number[];
  /** Bass pitch class for slash chords, otherwise the root. */
  bass: number;
}

const QUALITIES: [RegExp, number[]][] = [
  [/^(maj7|M7|Δ7?|Δ)$/, [0, 4, 7, 11]],
  [/^(m7|min7|-7)$/, [0, 3, 7, 10]],
  [/^(mMaj7|mM7|m\(maj7\))$/, [0, 3, 7, 11]],
  [/^(dim7|°7|o7)$/, [0, 3, 6, 9]],
  [/^(m7b5|ø7?|ø)$/, [0, 3, 6, 10]],
  [/^(7)$/, [0, 4, 7, 10]],
  [/^(9)$/, [0, 4, 7, 10, 14]],
  [/^(m9|min9)$/, [0, 3, 7, 10, 14]],
  [/^(maj9|M9)$/, [0, 4, 7, 11, 14]],
  [/^(6)$/, [0, 4, 7, 9]],
  [/^(m6|min6)$/, [0, 3, 7, 9]],
  [/^(add9|add2|2)$/, [0, 4, 7, 14]],
  [/^(madd9|m\(add9\))$/, [0, 3, 7, 14]],
  [/^(sus2)$/, [0, 2, 7]],
  [/^(sus4|sus)$/, [0, 5, 7]],
  [/^(7sus4|7sus)$/, [0, 5, 7, 10]],
  [/^(dim|°|o)$/, [0, 3, 6]],
  [/^(aug|\+|#5)$/, [0, 4, 8]],
  [/^(5)$/, [0, 7]],
  [/^(m|min|-)$/, [0, 3, 7]],
  [/^(maj|M|)$/, [0, 4, 7]],
];

/** Does this token look like a chord symbol? Used to tell chord lines from lyric lines. */
export function isChordToken(token: string): boolean {
  return parseChord(token) !== null;
}

/** Parse a chord symbol like 'G', 'Em7', 'F#m', 'Bb/D', 'Cmaj7', 'Dsus4'. Returns null if not a chord. */
export function parseChord(symbol: string): ParsedChord | null {
  const raw = symbol.trim().replace(/[()]/g, '');
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(raw);
  if (!m) return null;
  const root = pitchClassOf(m[1]);
  if (root === null) return null;
  const quality = m[2] ?? '';
  let intervals: number[] | null = null;
  for (const [re, ints] of QUALITIES) {
    if (re.test(quality)) {
      intervals = ints;
      break;
    }
  }
  if (!intervals) return null;
  const bass = m[3] ? pitchClassOf(m[3]) ?? root : root;
  return { name: raw, root, intervals, bass };
}

/** Transpose a chord name by n semitones, keeping the quality text. */
export function transposeChordName(name: string, semitones: number, preferFlats = false): string {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name.trim());
  if (!m || semitones === 0) return name;
  const names = preferFlats
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const shift = (n: string) => names[((pitchClassOf(n) ?? 0) + semitones + 120) % 12];
  return `${shift(m[1])}${m[2] ?? ''}${m[3] ? '/' + shift(m[3]) : ''}`;
}
