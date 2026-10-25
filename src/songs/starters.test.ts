import { describe, it, expect } from 'vitest';
import { STARTER_SONGS } from './starters';
import { songBars } from '../model/song';
import { encodeShare, decodeShare } from '../store/share';

describe('starter songs', () => {
  it('all build with notes in both hands', () => {
    for (const s of STARTER_SONGS) {
      expect(s.notes.length).toBeGreaterThan(10);
      expect(s.notes.some((n) => n.hand === 'L')).toBe(true);
      expect(s.notes.some((n) => n.hand === 'R')).toBe(true);
    }
    expect(songBars(STARTER_SONGS[0])).toBe(16);
    expect(STARTER_SONGS[0].sections.map((s) => s.startBar)).toEqual([0, 8, 12]);
    expect(STARTER_SONGS[2].timeSig).toEqual([3, 4]);
    expect(songBars(STARTER_SONGS[2])).toBe(16);
  });
  it('share links round-trip', () => {
    const s = STARTER_SONGS[1];
    const back = decodeShare(encodeShare(s));
    expect(back?.title).toBe(s.title);
    expect(back?.notes.length).toBe(s.notes.length);
    expect(decodeShare('garbage')).toBeNull();
  });
});

describe("I'm Still Fine", () => {
  it('has the expected structure', () => {
    const s = STARTER_SONGS.find((x) => x.id === 'builtin_im_still_fine')!;
    expect(songBars(s)).toBe(12 + 11 + 4 + 8 + 14 + 19);
    expect(s.sections.map((x) => x.name)).toEqual(['Verse 1', 'Chorus', 'Interlude', 'Verse 2', 'Chorus', 'Final Chorus']);
    expect(s.chords.some((c) => c.name === 'Fm/Ab')).toBe(true);
    expect(s.chords.some((c) => c.name === 'G/B')).toBe(true);
    expect(s.key).toBe('C');
  });
});

describe('Left My Woman', () => {
  it('has the expected structure', () => {
    const s = STARTER_SONGS.find((x) => x.id === 'builtin_left_my_woman')!;
    expect(songBars(s)).toBe(12 + 7 + 4 + 12 + 7 + 8 + 8 + 10);
    expect(s.sections.map((x) => x.name)).toEqual(['Verse 1', 'Chorus', 'Interlude', 'Verse 2', 'Chorus', 'Bridge', 'Solo', 'Final Chorus']);
    // Chorus bar: C on beat 1, G on beat 2, F for beats 3-4, then a bar of C.
    const chorusStart = 12 * 4;
    const names = s.chords.filter((c) => c.start >= chorusStart && c.start < chorusStart + 8).map((c) => [c.start - chorusStart, c.name]);
    expect(names).toEqual([[0, 'C'], [1, 'G'], [2, 'F'], [4, 'C']]);
    expect(s.key).toBe('C');
  });
});
