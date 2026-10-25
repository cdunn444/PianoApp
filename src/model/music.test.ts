import { describe, it, expect } from 'vitest';
import { parseKey, nameToMidi, midiToName, midiToLetter, spellMidi, accidentalToPrint, pitchClassOf } from './music';

describe('music helpers', () => {
  it('parses note names', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('A4')).toBe(69);
    expect(nameToMidi('F#3')).toBe(54);
    expect(nameToMidi('Bb2')).toBe(46);
    expect(nameToMidi('x')).toBeNull();
  });

  it('spells notes according to key', () => {
    expect(midiToName(61, parseKey('G'))).toBe('C#4');
    expect(midiToName(61, parseKey('F'))).toBe('Db4');
    expect(midiToLetter(70, parseKey('F'))).toBe('B♭');
  });

  it('builds key signatures', () => {
    expect(parseKey('G').letters).toEqual(['F']);
    expect(parseKey('D').count).toBe(2);
    expect(parseKey('F').letters).toEqual(['B']);
    expect(parseKey('Em').letters).toEqual(['F']);
    expect(parseKey('Am').count).toBe(0);
    expect(parseKey('Bb').count).toBe(-2);
  });

  it('decides which accidentals to print', () => {
    const g = parseKey('G');
    expect(accidentalToPrint(spellMidi(66, g), g)).toBeNull(); // F# in G: in key
    expect(accidentalToPrint(spellMidi(65, g), g)).toBe('natural'); // F natural in G
    expect(accidentalToPrint(spellMidi(61, g), g)).toBe('sharp'); // C# in G
    const c = parseKey('C');
    expect(accidentalToPrint(spellMidi(65, c), c)).toBeNull();
  });

  it('pitch classes', () => {
    expect(pitchClassOf('F#')).toBe(6);
    expect(pitchClassOf('Bb')).toBe(10);
  });
});
