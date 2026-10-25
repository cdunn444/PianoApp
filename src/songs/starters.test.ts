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
