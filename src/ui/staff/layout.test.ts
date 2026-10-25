import { describe, it, expect } from 'vitest';
import { layoutSong, noteY, classifyDuration, TREBLE_TOP, LS, BASS_TOP } from './layout';
import { importSong } from '../../import';

describe('staff layout', () => {
  it('places notes on the right lines', () => {
    expect(noteY('E', 4, 'R')).toBe(TREBLE_TOP + 4 * LS); // bottom treble line
    expect(noteY('F', 5, 'R')).toBe(TREBLE_TOP); // top treble line
    expect(noteY('G', 2, 'L')).toBe(BASS_TOP + 4 * LS);
    expect(noteY('A', 3, 'L')).toBe(BASS_TOP);
    expect(noteY('C', 4, 'R')).toBe(TREBLE_TOP + 5 * LS); // first ledger below treble
  });

  it('classifies durations', () => {
    expect(classifyDuration(4)).toEqual({ head: 'whole', dotted: false });
    expect(classifyDuration(1.5)).toEqual({ head: 'quarter', dotted: true });
    expect(classifyDuration(0.5)).toEqual({ head: 'eighth', dotted: false });
  });

  it('lays out a song with stems, rests and barlines', () => {
    const song = importSong('RH: C4/q D4/q E4/h | r/h G4/h\nLH: C3/w | r/w', { title: 't', format: 'notes' });
    const l = layoutSong(song);
    expect(l.notes.length).toBe(5);
    expect(l.barlines.map((b) => b.bar)).toEqual([0, 1, 2]);
    expect(l.notes.find((n) => n.midi === 60)!.ledgers.length).toBe(1); // middle C below treble
    expect(l.notes.find((n) => n.midi === 48)!.head).toBe('whole');
    const rh = l.rests.filter((r) => r.hand === 'R');
    expect(rh.map((r) => r.type)).toEqual(['half']);
    const lh = l.rests.filter((r) => r.hand === 'L');
    expect(lh.map((r) => r.type)).toEqual(['whole']);
    expect(l.stems.length).toBe(4);
  });

  it('beams pairs of eighths that fill a beat', () => {
    const song = importSong('LH: C3/q r/q C3/e C3/e r/q', { title: 't', format: 'notes' });
    const l = layoutSong(song);
    expect(l.beams.length).toBe(1);
    const beamed = l.stems.filter((s) => s.beamed);
    expect(beamed.length).toBe(2);
    expect(beamed[0].y2).toBe(beamed[1].y2);
  });

  it('prints accidentals relative to the key', () => {
    const song = importSong('key: G\nRH: F#4/q F4/q C#5/q', { title: 't', format: 'notes' });
    const l = layoutSong(song);
    expect(l.notes.map((n) => n.accidental)).toEqual([null, 'natural', 'sharp']);
  });
});
