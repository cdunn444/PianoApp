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
  it('C position keeps the thumb at middle C (Simply Piano style)', () => {
    const C = voiceRightHand(parseChord('C')!, null);
    expect(C).toEqual([60, 64, 67]); // C E G
    const F = voiceRightHand(parseChord('F')!, C);
    expect(F).toEqual([60, 65, 69]); // C F A
    const G = voiceRightHand(parseChord('G')!, F);
    expect(G).toEqual([59, 62, 67]); // B D G
    expect(voiceRightHand(parseChord('C')!, G)).toEqual([60, 64, 67]);
    expect(voiceRightHand(parseChord('G7')!, C)).toEqual([59, 65, 67]); // B F G
    expect(voiceRightHand(parseChord('Am')!, C)).toEqual([60, 64, 69]); // C E A
    expect(voiceRightHand(parseChord('Dm')!, C)).toEqual([62, 65, 69]); // D F A
    expect(voiceRightHand(parseChord('Em')!, C)).toEqual([59, 64, 67]); // B E G
    expect(voiceRightHand(parseChord('G/B')!, C)).toEqual([59, 62, 67]);
    expect(voiceLeftHand(parseChord('G/B')!)).toBe(59); // B3
    expect(voiceLeftHand(parseChord('C')!)).toBe(48); // C3
  });
  it('root position puts the root in the middle-C octave', () => {
    expect(voiceRightHand(parseChord('F')!, null, 'root')).toEqual([65, 69, 72]);
    expect(voiceRightHand(parseChord('G/B')!, null, 'root')).toEqual([67, 71, 74]);
  });
  it('smooth voicing keeps movement small', () => {
    const g = voiceRightHand(parseChord('G')!, null, 'smooth');
    expect(g.every((m) => m >= 60 && m <= 79)).toBe(true);
    expect(g.map((m) => m % 12).sort((a, b) => a - b)).toEqual([2, 7, 11]);
    const c = voiceRightHand(parseChord('C')!, g, 'smooth');
    const spread = Math.abs(c[0] - g[0]);
    expect(spread).toBeLessThanOrEqual(5);
    expect(voiceLeftHand(parseChord('G')!)).toBe(55);
    expect(voiceLeftHand(parseChord('C/E')!)).toBe(52);
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
    expect(s.notes.length).toBe(4 * 8);
  });
});
