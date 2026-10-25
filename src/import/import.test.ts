import { describe, it, expect } from 'vitest';
import { parseChord } from './chords';
import { parseChordSheet } from './chordSheet';
import { parseTab } from './tab';
import { parseNoteText, parseDuration } from './noteText';
import { detectFormat, importSong } from './index';
import { voiceRightHand, voiceLeftHand } from '../arrange/voicing';
import { applyPattern } from '../arrange/patterns';
import { guessKeyFromChords } from './key';

describe('chord symbols', () => {
  it('parses common chords', () => {
    expect(parseChord('G')).toMatchObject({ root: 7, intervals: [0, 4, 7] });
    expect(parseChord('Em')).toMatchObject({ root: 4, intervals: [0, 3, 7] });
    expect(parseChord('F#m7')).toMatchObject({ root: 6, intervals: [0, 3, 7, 10] });
    expect(parseChord('Bb/D')).toMatchObject({ root: 10, bass: 2 });
    expect(parseChord('Cmaj7')).toMatchObject({ intervals: [0, 4, 7, 11] });
    expect(parseChord('Dsus4')).toMatchObject({ intervals: [0, 5, 7] });
    expect(parseChord('Twinkle')).toBeNull();
    expect(parseChord('Am')).not.toBeNull();
    expect(parseChord('A')).not.toBeNull();
  });
});

describe('chord sheet', () => {
  const opts = { beatsPerBar: 4, beatsPerChord: 4 };
  it('bar-line format', () => {
    const r = parseChordSheet('G | D | Em C | G', opts);
    expect(r.slots.map((s) => [s.start, s.duration, s.chord.name])).toEqual([
      [0, 4, 'G'], [4, 4, 'D'], [8, 2, 'Em'], [10, 2, 'C'], [12, 4, 'G'],
    ]);
  });
  it('chords over lyrics with sections', () => {
    const text = `[Verse]\nC        F\nTwinkle twinkle little star\nG       C\nHow I wonder what you are`;
    const r = parseChordSheet(text, opts);
    expect(r.sections).toEqual([{ name: 'Verse', startBeat: 0 }]);
    expect(r.slots.map((s) => s.chord.name)).toEqual(['C', 'F', 'G', 'C']);
    expect(r.lyrics[0]).toEqual({ start: 0, text: 'Twinkle' });
    expect(r.lyrics[1]).toEqual({ start: 4, text: 'twinkle little star' });
  });
  it('ChordPro inline', () => {
    const r = parseChordSheet('[G]Amazing [C]grace how [G]sweet', opts);
    expect(r.slots.map((s) => s.chord.name)).toEqual(['G', 'C', 'G']);
    expect(r.lyrics.map((l) => l.text)).toEqual(['Amazing', 'grace how', 'sweet']);
  });
  it('guesses the key', () => {
    const r = parseChordSheet('G | D | Em | C', opts);
    expect(guessKeyFromChords(r.slots.map((s) => s.chord))).toBe('G');
    const m = parseChordSheet('Am | F | C | G', opts);
    expect(guessKeyFromChords(m.slots.map((s) => s.chord))).toBe('Am');
  });
});

describe('voicing + patterns', () => {
  it('root position (default) reads exactly as the chord is named, near middle C', () => {
    expect(voiceRightHand(parseChord('C')!, null)).toEqual([60, 64, 67]); // C4 E4 G4
    expect(voiceRightHand(parseChord('F')!, null)).toEqual([65, 69, 72]); // F4 A4 C5
    expect(voiceRightHand(parseChord('Am')!, null)).toEqual([57, 60, 64]); // A3 C4 E4
    expect(voiceRightHand(parseChord('Em')!, null)).toEqual([64, 67, 71]); // E4 G4 B4
    expect(voiceRightHand(parseChord('G')!, null)).toEqual([55, 59, 62]); // G3 B3 D4
    expect(voiceRightHand(parseChord('Dm')!, null)).toEqual([62, 65, 69]); // D4 F4 A4
    expect(voiceRightHand(parseChord('G/B')!, null)).toEqual([55, 59, 62]);
    expect(voiceRightHand(parseChord('Fm/Ab')!, null)).toEqual([65, 68, 72]); // F4 Ab4 C5
    // Same chord always looks the same, whatever came before.
    expect(voiceRightHand(parseChord('F')!, [55, 59, 62])).toEqual([65, 69, 72]);
    expect(voiceLeftHand(parseChord('C')!, [60, 64, 67])).toBe(48); // C3
    expect(voiceLeftHand(parseChord('Am')!, [57, 60, 64])).toBe(45); // A2, never the same key as the right hand
    expect(voiceLeftHand(parseChord('F')!, [65, 69, 72])).toBe(53); // F3
    expect(voiceLeftHand(parseChord('G/B')!, [55, 59, 62])).toBe(47); // B2
    expect(voiceLeftHand(parseChord('Fm/Ab')!, [65, 68, 72])).toBe(56); // Ab3
  });
  it('C position keeps the thumb at middle C (Simply Piano style)', () => {
    const C = voiceRightHand(parseChord('C')!, null, 'position');
    expect(C).toEqual([60, 64, 67]);
    expect(voiceRightHand(parseChord('F')!, C, 'position')).toEqual([60, 65, 69]); // C F A
    expect(voiceRightHand(parseChord('G')!, C, 'position')).toEqual([59, 62, 67]); // B D G
  });
  it('smooth voicing keeps movement small', () => {
    const g = voiceRightHand(parseChord('G')!, null, 'smooth');
    expect(g.every((m) => m >= 60 && m <= 79)).toBe(true);
    expect(g.map((m) => m % 12).sort((a, b) => a - b)).toEqual([2, 7, 11]);
    const c = voiceRightHand(parseChord('C')!, g, 'smooth');
    const spread = Math.abs(c[0] - g[0]);
    expect(spread).toBeLessThanOrEqual(5);
    expect(voiceLeftHand(parseChord('G')!, [67, 71, 74])).toBe(55);
    expect(voiceLeftHand(parseChord('C/E')!, [60, 64, 67])).toBe(52);
  });
  it('simply pattern: bass on 1 and 3 (eighths), chord on 2 and 4', () => {
    const notes = applyPattern([{ start: 0, duration: 4, rh: [64, 67, 71], lh: 52 }], 'simply');
    expect(notes.filter((n) => n.hand === 'L').map((n) => [n.start, n.duration])).toEqual([[0, 1], [2, 0.5], [2.5, 0.5]]);
    expect(notes.filter((n) => n.hand === 'R').map((n) => n.start)).toEqual([1, 1, 1, 3, 3, 3]);
    const waltz = applyPattern([{ start: 0, duration: 3, rh: [67, 71, 74], lh: 55 }], 'simply');
    expect(waltz.map((n) => [n.hand, n.start])).toEqual([['L', 0], ['R', 1], ['R', 1], ['R', 1], ['R', 2], ['R', 2], ['R', 2]]);
    const quick = applyPattern([{ start: 0, duration: 1, rh: [60, 64, 67], lh: 48 }], 'simply');
    expect(quick.map((n) => [n.hand, n.start, n.duration])).toEqual([['L', 0, 0.5], ['R', 0.5, 0.5], ['R', 0.5, 0.5], ['R', 0.5, 0.5]]);
  });
  it('half pattern gives two hits per bar', () => {
    const notes = applyPattern([{ start: 0, duration: 4, rh: [67, 71, 74], lh: 43 }], 'half');
    expect(notes.length).toBe(8);
    expect(notes.filter((n) => n.start === 2).length).toBe(4);
  });
  it('broken pattern holds LH and arpeggiates RH', () => {
    const notes = applyPattern([{ start: 0, duration: 4, rh: [60, 64, 67], lh: 48 }], 'broken');
    expect(notes.filter((n) => n.hand === 'L')).toEqual([{ start: 0, duration: 4, midi: 48, hand: 'L' }]);
    expect(notes.filter((n) => n.hand === 'R').length).toBe(8);
  });
});

describe('tab', () => {
  const opts = { columnBeats: 0.5, splitPoint: 60, beatsPerBar: 4 };
  it('reads frets, two-digit frets and chords in a column', () => {
    const tab = `e|---3---12--|\nB|-0-----0---|\nG|-0---------|\nD|-----------|\nA|-----------|\nE|-----------|`;
    const r = parseTab(tab, opts);
    // Column 1: B0 + G0 together; column 3: e3; column 7: e12 + B0.
    expect(r.notes.map((n) => [n.start, n.midi])).toEqual([
      [0.5, 55 + 12], [0.5, 59 + 12], [1.5, 67 + 12], [3.5, 59 + 12], [3.5, 76 + 12],
    ]);
    expect(r.notes[0].hand).toBe('R');
  });
  it('bar lines take no time', () => {
    const tab = `e|-0-|-0-|\nB|---|---|\nG|---|---|\nD|---|---|\nA|---|---|\nE|---|---|`;
    const r = parseTab(tab, opts);
    expect(r.notes.map((n) => n.start)).toEqual([0.5, 2]);
  });
});

describe('note text', () => {
  it('durations', () => {
    expect(parseDuration('q')).toBe(1);
    expect(parseDuration('e.')).toBe(0.75);
    expect(parseDuration('h')).toBe(2);
    expect(parseDuration('1.5')).toBe(1.5);
  });
  it('two hands, chords, lyrics, meta', () => {
    const txt = `key: G\nbpm: 100\nRH: G4/q A4/q B4/h | r/q D5/q. E5/e\nLH: [G3 D4]/w | G3/h D3/h\nchords: G | D\nlyrics: Hel-lo | there`;
    const r = parseNoteText(txt, 4);
    expect(r.meta).toEqual({ key: 'G', bpm: '100' });
    expect(r.notes.filter((n) => n.hand === 'R').map((n) => [n.start, n.duration, n.midi])).toEqual([
      [0, 1, 67], [1, 1, 69], [2, 2, 71], [5, 1.5, 74], [6.5, 0.5, 76],
    ]);
    expect(r.notes.filter((n) => n.hand === 'L').length).toBe(4);
    expect(r.chords).toEqual([{ start: 0, name: 'G' }, { start: 4, name: 'D' }]);
    expect(r.lyrics).toEqual([{ start: 0, text: 'Hel-lo' }, { start: 4, text: 'there' }]);
  });
});

describe('importSong', () => {
  it('detects formats', () => {
    expect(detectFormat('RH: C4/q')).toBe('notes');
    expect(detectFormat('e|--3--|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|')).toBe('tab');
    expect(detectFormat('G | C | D')).toBe('chords');
  });
  it('builds a song from chords and applies transpose', () => {
    const s = importSong('G | D | Em | C', { title: 'Test', options: { transpose: 2 } });
    expect(s.key).toBe('A');
    expect(s.chords.map((c) => c.name)).toEqual(['A', 'E', 'F#m', 'D']);
    expect(s.notes.length).toBe(4 * 9);
  });
});
