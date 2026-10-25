export type Hand = 'L' | 'R';

/** A single sounding note. Times are in beats (quarter notes) from the start of the song. */
export interface NoteEvent {
  start: number;
  duration: number;
  midi: number;
  hand: Hand;
}

export type SourceFormat = 'chords' | 'tab' | 'notes';
export type Pattern = 'whole' | 'half' | 'quarter' | 'broken';
export type Voicing = 'position' | 'root' | 'smooth';

export interface SongOptions {
  /** Rhythm pattern used when the source is a chord sheet. */
  pattern: Pattern;
  /**
   * 'root' (default): every chord in root position, in the octave nearest middle C, so the notes
   * read exactly as the chord is named (Am = A C E, F = F A C).
   * 'position': Simply Piano style, the hand stays in C position and chords use whichever inversion
   * fits under it (F = C F A, G = B D G). 'smooth': inversions chosen purely for small hand moves.
   */
  voicing: Voicing;
  /** Semitones to shift the whole song. */
  transpose: number;
  /** MIDI number: notes below go to the left hand (tab import). */
  splitPoint: number;
  /** Beats per tab column (tab import). 0.5 = eighth notes. */
  tabColumnBeats: number;
  /** Beats per chord when a chord sheet has no bar lines. */
  beatsPerChord: number;
}

export interface ChordMark { start: number; name: string }
export interface LyricMark { start: number; text: string }
export interface Section { name: string; startBar: number }

export interface Song {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  timeSig: [number, number];
  /** Key name such as 'C', 'G', 'F', 'Em', 'Bb'. */
  key: string;
  source: { format: SourceFormat; text: string };
  options: SongOptions;
  notes: NoteEvent[];
  chords: ChordMark[];
  lyrics: LyricMark[];
  sections: Section[];
  /** True for songs shipped with the app (not deletable). */
  builtIn?: boolean;
  createdAt?: number;
}

export const DEFAULT_OPTIONS: SongOptions = {
  pattern: 'half',
  voicing: 'root',
  transpose: 0,
  splitPoint: 60,
  tabColumnBeats: 0.5,
  beatsPerChord: 4,
};

export function beatsPerBar(song: Pick<Song, 'timeSig'>): number {
  const [num, den] = song.timeSig;
  return (num * 4) / den;
}

export function songLengthBeats(song: Pick<Song, 'notes' | 'timeSig'>): number {
  const end = song.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const bpb = beatsPerBar(song);
  return Math.max(bpb, Math.ceil(end / bpb - 1e-9) * bpb);
}

export function songBars(song: Pick<Song, 'notes' | 'timeSig'>): number {
  return Math.round(songLengthBeats(song) / beatsPerBar(song));
}

export function newSongId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Round a beat position up to the next bar boundary (never returns -0). */
export function alignToBar(beat: number, bpb: number): number {
  return Math.max(0, Math.ceil(beat / bpb - 1e-9) * bpb);
}
