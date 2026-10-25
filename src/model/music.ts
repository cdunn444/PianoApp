/** Pitch, note-name and key-signature helpers. MIDI 60 = C4 (middle C). */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Semitone offset of each letter from C. */
export const LETTER_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Order in which sharps / flats are added to a key signature. */
const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Number of sharps (positive) or flats (negative) for each major key. */
const MAJOR_KEY_ACCIDENTALS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};

export interface KeySignature {
  /** Positive = sharps, negative = flats. */
  count: number;
  /** Letters that carry an accidental, in signature order. */
  letters: Letter[];
  /** 1 for sharp keys, -1 for flat keys, 0 for C major. */
  direction: 1 | -1 | 0;
  minor: boolean;
}

/** Parse a key name such as 'G', 'Em', 'Bb', 'F#m', 'Amin', 'Cmaj'. Unknown keys fall back to C. */
export function parseKey(name: string): KeySignature {
  const m = /^([A-G])([#b]?)\s*(m|min|minor|maj|major)?$/i.exec(name.trim());
  if (!m) return { count: 0, letters: [], direction: 0, minor: false };
  const letter = m[1].toUpperCase();
  const acc = m[2] ?? '';
  const minor = /^m(in|inor)?$/i.test(m[3] ?? '');
  let major = letter + acc;
  if (minor) {
    // Relative major is three semitones up.
    const pc = (LETTER_SEMITONES[letter as Letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 3 + 12) % 12;
    const candidates = Object.keys(MAJOR_KEY_ACCIDENTALS).filter((k) => keyPitchClass(k) === pc);
    // Prefer the spelling with fewer accidentals.
    major = candidates.sort((a, b) => Math.abs(MAJOR_KEY_ACCIDENTALS[a]) - Math.abs(MAJOR_KEY_ACCIDENTALS[b]))[0] ?? 'C';
  }
  const count = MAJOR_KEY_ACCIDENTALS[major] ?? 0;
  const direction: 1 | -1 | 0 = count > 0 ? 1 : count < 0 ? -1 : 0;
  const letters = count > 0 ? SHARP_ORDER.slice(0, count) : FLAT_ORDER.slice(0, -count);
  return { count, letters, direction, minor };
}

function keyPitchClass(key: string): number {
  const letter = key[0] as Letter;
  const acc = key.slice(1);
  return (LETTER_SEMITONES[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
}

export interface SpelledNote {
  letter: Letter;
  /** -1 flat, 0 natural, 1 sharp */
  accidental: -1 | 0 | 1;
  octave: number;
  midi: number;
}

/** Spell a MIDI pitch in the context of a key signature (sharps in sharp keys, flats in flat keys). */
export function spellMidi(midi: number, key: KeySignature): SpelledNote {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const useFlats = key.direction === -1;
  const name = (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc];
  const letter = name[0] as Letter;
  const accidental: -1 | 0 | 1 = name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0;
  return { letter, accidental, octave, midi };
}

/** Human note name such as 'C4', 'F#3', 'Bb2'. */
export function midiToName(midi: number, key: KeySignature = parseKey('C')): string {
  const s = spellMidi(midi, key);
  return `${s.letter}${s.accidental === 1 ? '#' : s.accidental === -1 ? 'b' : ''}${s.octave}`;
}

/** Just the letter with accidental, e.g. 'F#', used inside noteheads. */
export function midiToLetter(midi: number, key: KeySignature = parseKey('C')): string {
  const s = spellMidi(midi, key);
  return `${s.letter}${s.accidental === 1 ? '♯' : s.accidental === -1 ? '♭' : ''}`;
}

/** Parse 'C4', 'F#3', 'Bb2', 'c4' into a MIDI number. Returns null when invalid. */
export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase() as Letter;
  let acc = 0;
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : -1;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + LETTER_SEMITONES[letter] + acc;
}

/** Pitch class (0-11) of a note name without octave, e.g. 'F#' -> 6, 'Bb' -> 10. */
export function pitchClassOf(name: string): number | null {
  const m = /^([A-G])([#b]?)$/i.exec(name.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase() as Letter;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (LETTER_SEMITONES[letter] + acc + 12) % 12;
}

/** Diatonic step index where C0 = 0 (used for vertical staff placement). */
export function diatonicIndex(letter: Letter, octave: number): number {
  return octave * 7 + LETTERS.indexOf(letter);
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Does this note need a printed accidental (or natural) given the key signature? */
export function accidentalToPrint(note: SpelledNote, key: KeySignature): 'sharp' | 'flat' | 'natural' | null {
  const inKey = key.letters.includes(note.letter);
  const keyAcc = inKey ? key.direction : 0;
  if (note.accidental === keyAcc) return null;
  if (note.accidental === 1) return 'sharp';
  if (note.accidental === -1) return 'flat';
  return 'natural';
}
