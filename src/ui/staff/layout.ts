import { accidentalToPrint, diatonicIndex, parseKey, spellMidi, type KeySignature, type Letter } from '../../model/music';
import { beatsPerBar, songLengthBeats, type Hand, type NoteEvent, type Song } from '../../model/song';

/** Horizontal pixels per beat in SVG units. */
export const PX_PER_BEAT = 96;
/** Distance between staff lines (one "staff space"). */
export const LS = 12;
export const TREBLE_TOP = 36;
export const STAFF_GAP = 42;
export const BASS_TOP = TREBLE_TOP + 4 * LS + STAFF_GAP;
export const STAFF_HEIGHT = BASS_TOP + 4 * LS + 36;
export const HALF = LS / 2;

export type HeadType = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface LaidNote {
  id: number;
  midi: number;
  hand: Hand;
  start: number;
  end: number;
  x: number;
  y: number;
  /** Horizontal nudge for the upper/lower note of a second inside a chord. */
  dx: number;
  head: HeadType;
  dotted: boolean;
  letter: string;
  accidental: 'sharp' | 'flat' | 'natural' | null;
  /** Ledger line y positions. */
  ledgers: number[];
}

export interface Stem {
  x: number;
  y1: number;
  y2: number;
  up: boolean;
  head: HeadType;
  hand: Hand;
  start: number;
  /** True when a beam replaces this stem's flag. */
  beamed?: boolean;
}

export interface Beam {
  x1: number;
  x2: number;
  y: number;
  up: boolean;
}

export interface LaidRest {
  x: number;
  y: number;
  type: HeadType;
  dotted: boolean;
  hand: Hand;
  width: number;
}

export interface Layout {
  key: KeySignature;
  notes: LaidNote[];
  stems: Stem[];
  beams: Beam[];
  rests: LaidRest[];
  barlines: { x: number; bar: number }[];
  chords: { x: number; name: string }[];
  lyrics: { x: number; text: string }[];
  totalBeats: number;
  width: number;
}

export function beatX(beat: number): number {
  return beat * PX_PER_BEAT;
}

/** Vertical position for a spelled note on the treble (hand R) or bass (hand L) staff. */
export function noteY(letter: Letter, octave: number, hand: Hand): number {
  const idx = diatonicIndex(letter, octave);
  if (hand === 'R') {
    // Bottom treble line is E4.
    const bottom = TREBLE_TOP + 4 * LS;
    return bottom - (idx - diatonicIndex('E', 4)) * HALF;
  }
  const bottom = BASS_TOP + 4 * LS;
  return bottom - (idx - diatonicIndex('G', 2)) * HALF;
}

export function classifyDuration(beats: number): { head: HeadType; dotted: boolean } {
  const table: [number, HeadType, boolean][] = [
    [4, 'whole', false], [3, 'half', true], [2, 'half', false], [1.5, 'quarter', true],
    [1, 'quarter', false], [0.75, 'eighth', true], [0.5, 'eighth', false], [0.375, 'sixteenth', true],
    [0.25, 'sixteenth', false],
  ];
  for (const [d, head, dotted] of table) if (beats >= d - 1e-6) return { head, dotted };
  return { head: 'sixteenth', dotted: false };
}

function ledgerLines(y: number, hand: Hand): number[] {
  const top = hand === 'R' ? TREBLE_TOP : BASS_TOP;
  const bottom = top + 4 * LS;
  const out: number[] = [];
  for (let ly = top - LS; ly >= y - 1e-6; ly -= LS) out.push(ly);
  for (let ly = bottom + LS; ly <= y + 1e-6; ly += LS) out.push(ly);
  return out;
}

export function layoutSong(song: Song): Layout {
  const key = parseKey(song.key);
  const bpb = beatsPerBar(song);
  const totalBeats = songLengthBeats(song);
  const notes: LaidNote[] = [];
  const stems: Stem[] = [];
  const rests: LaidRest[] = [];

  song.notes.forEach((n, i) => {
    const sp = spellMidi(n.midi, key);
    const y = noteY(sp.letter, sp.octave, n.hand);
    const { head, dotted } = classifyDuration(n.duration);
    notes.push({
      id: i,
      midi: n.midi,
      hand: n.hand,
      start: n.start,
      end: n.start + n.duration,
      x: beatX(n.start),
      y,
      dx: 0,
      head,
      dotted,
      letter: sp.letter + (sp.accidental === 1 ? '♯' : sp.accidental === -1 ? '♭' : ''),
      accidental: accidentalToPrint(sp, key),
      ledgers: ledgerLines(y, n.hand),
    });
  });

  // Chord groups: notes in the same hand starting together. Decide stem direction, then nudge
  // the upper note of any second to the other side of the stem so noteheads never overlap.
  const chordGroups = new Map<string, LaidNote[]>();
  for (const n of notes) {
    const k = `${n.hand}|${n.start.toFixed(4)}`;
    const g = chordGroups.get(k);
    if (g) g.push(n);
    else chordGroups.set(k, [n]);
  }
  const stemUpOf = new Map<string, boolean>();
  for (const [k, g] of chordGroups) {
    const ys = g.map((n) => n.y);
    const middle = (g[0].hand === 'R' ? TREBLE_TOP : BASS_TOP) + 2 * LS;
    const up = (Math.min(...ys) + Math.max(...ys)) / 2 > middle; // below the middle line: stems up
    stemUpOf.set(k, up);
    const w = g.some((n) => n.head === 'whole') ? 19.5 : 13.6;
    if (up) {
      g.sort((a, b) => b.y - a.y); // bottom first
      for (let i = 1; i < g.length; i++) {
        const second = Math.abs(g[i - 1].y - g[i].y) <= HALF + 1e-6;
        g[i].dx = second && g[i - 1].dx === 0 ? w : 0;
      }
    } else {
      g.sort((a, b) => a.y - b.y); // top first
      for (let i = 1; i < g.length; i++) {
        const second = Math.abs(g[i - 1].y - g[i].y) <= HALF + 1e-6;
        g[i].dx = second && g[i - 1].dx === 0 ? -w : 0;
      }
    }
  }

  // Stems: one per (hand, start, head) group of notes.
  const groups = new Map<string, LaidNote[]>();
  for (const n of notes) {
    if (n.head === 'whole') continue;
    const k = `${n.hand}|${n.start.toFixed(4)}|${n.head}`;
    const g = groups.get(k);
    if (g) g.push(n);
    else groups.set(k, [n]);
  }
  for (const [k, g] of groups) {
    const ys = g.map((n) => n.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const up = stemUpOf.get(k.slice(0, k.lastIndexOf('|'))) ?? true;
    const len = 3.5 * LS;
    const hw = 14.17 / 2;
    const x = g[0].x + (up ? hw - 0.7 : -hw + 0.7);
    const base = { x, up, head: g[0].head, hand: g[0].hand, start: g[0].start };
    stems.push(up ? { ...base, y1: bottom, y2: top - len } : { ...base, y1: top, y2: bottom + len });
  }

  // Beams: two eighth notes in the same hand that fill one beat are beamed together.
  const beams: Beam[] = [];
  const eighths = stems.filter((st) => st.head === 'eighth').sort((a, b) => a.start - b.start);
  for (let i = 0; i < eighths.length; i++) {
    const a = eighths[i];
    if (a.beamed) continue;
    const b = eighths.find(
      (st) => st !== a && !st.beamed && st.hand === a.hand && Math.abs(st.start - (a.start + 0.5)) < 1e-6 && Math.floor(st.start) === Math.floor(a.start),
    );
    if (!b) continue;
    // Give both stems the first note's direction, then level their ends.
    if (b.up !== a.up) flipStem(b, a.up);
    const y = a.up ? Math.min(a.y2, b.y2) : Math.max(a.y2, b.y2);
    a.y2 = b.y2 = y;
    a.beamed = b.beamed = true;
    beams.push({ x1: a.x, x2: b.x, y, up: a.up });
  }

  // Rests: per hand, fill gaps inside each bar.
  for (const hand of ['L', 'R'] as Hand[]) {
    const hn = song.notes.filter((n) => n.hand === hand).sort((a, b) => a.start - b.start);
    const bars = Math.round(totalBeats / bpb);
    for (let bar = 0; bar < bars; bar++) {
      const bs = bar * bpb;
      const be = bs + bpb;
      // Sounding intervals clipped to the bar, merged.
      const iv = hn
        .filter((n) => n.start < be && n.start + n.duration > bs)
        .map((n) => [Math.max(bs, n.start), Math.min(be, n.start + n.duration)] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      for (const [s, e] of iv) {
        const last = merged[merged.length - 1];
        if (last && s <= last[1] + 1e-6) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
      }
      if (merged.length === 0) {
        rests.push({ x: beatX(bs + bpb / 2), y: restY(hand, 'whole'), type: 'whole', dotted: false, hand, width: LS });
        continue;
      }
      let cursor = bs;
      const gaps: [number, number][] = [];
      for (const [s, e] of merged) {
        if (s > cursor + 1e-6) gaps.push([cursor, s]);
        cursor = Math.max(cursor, e);
      }
      if (be > cursor + 1e-6) gaps.push([cursor, be]);
      for (const [s, e] of gaps) {
        let t = s;
        while (e - t > 0.24) {
          const { head, dotted } = classifyDuration(e - t);
          const d = durationOf(head, dotted);
          rests.push({ x: beatX(t), y: restY(hand, head), type: head, dotted, hand, width: LS });
          t += d;
        }
      }
    }
  }

  const barlines: { x: number; bar: number }[] = [];
  for (let b = 0; b * bpb <= totalBeats + 1e-6; b++) barlines.push({ x: beatX(b * bpb), bar: b });

  return {
    key,
    notes,
    stems,
    beams,
    rests,
    barlines,
    chords: song.chords.map((c) => ({ x: beatX(c.start), name: c.name })),
    lyrics: song.lyrics.map((l) => ({ x: beatX(l.start), text: l.text })),
    totalBeats,
    width: beatX(totalBeats),
  };
}

function flipStem(st: Stem, up: boolean) {
  const len = 3.5 * LS;
  const hw = 14.17 / 2;
  const headY = st.up ? st.y1 : st.y1; // y1 is always the notehead end of the stem
  st.x = st.x + (up ? 2 * hw - 1.4 : -(2 * hw - 1.4));
  st.up = up;
  st.y1 = headY;
  st.y2 = up ? headY - len : headY + len;
}

export function durationOf(head: HeadType, dotted: boolean): number {
  const base = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25 }[head];
  return dotted ? base * 1.5 : base;
}

function restY(hand: Hand, type: HeadType): number {
  const top = hand === 'R' ? TREBLE_TOP : BASS_TOP;
  if (type === 'whole') return top + LS; // hangs from the 4th line
  if (type === 'half') return top + 2 * LS; // sits on the middle line
  return top + 2 * LS;
}

/** Positions (y) of key-signature accidentals on each staff, in signature order. */
export function keySignaturePositions(key: KeySignature, hand: Hand): { y: number; glyph: '♯' | '♭' }[] {
  const sharpsTreble: [Letter, number][] = [['F', 5], ['C', 5], ['G', 5], ['D', 5], ['A', 4], ['E', 5], ['B', 4]];
  const flatsTreble: [Letter, number][] = [['B', 4], ['E', 5], ['A', 4], ['D', 5], ['G', 4], ['C', 5], ['F', 4]];
  const list = key.direction === 1 ? sharpsTreble : flatsTreble;
  const glyph = key.direction === 1 ? '♯' : '♭';
  return list.slice(0, Math.abs(key.count)).map(([l, o]) => ({ y: noteY(l, hand === 'R' ? o : o - 2, hand), glyph }));
}

/** Index of first note whose end is after `beat`, for fast active-note scanning. */
export function activeNotes(notes: LaidNote[], beat: number): LaidNote[] {
  return notes.filter((n) => n.start <= beat + 1e-6 && n.end > beat + 1e-6);
}

export { noteY as noteYForHand };
export type { NoteEvent };
