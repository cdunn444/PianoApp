import type { ParsedChord } from '../import/chords';

/** Right-hand close voicing range (inclusive). */
export const RH_LOW = 60; // C4
export const RH_HIGH = 79; // G5
/** Left-hand bass range. */
export const LH_LOW = 36; // C2
export const LH_HIGH = 59; // B3

/**
 * Choose right-hand pitches for a chord: a close-position voicing inside [RH_LOW, RH_HIGH]
 * that moves as little as possible from the previous voicing. Extensions beyond the first four
 * chord tones are dropped so a beginner never has more than four notes in one hand.
 */
export function voiceRightHand(chord: ParsedChord, previous: number[] | null): number[] {
  const unique = [...new Set(chordTones(chord).map((i) => (chord.root + i) % 12))];
  const candidates: number[][] = [];
  // Every rotation (inversion) starting on each octave inside the range.
  for (let rot = 0; rot < unique.length; rot++) {
    const order = [...unique.slice(rot), ...unique.slice(0, rot)];
    for (let base = RH_LOW; base <= RH_HIGH; base++) {
      if (base % 12 !== order[0]) continue;
      const voicing: number[] = [base];
      let last = base;
      for (let i = 1; i < order.length; i++) {
        let next = last + ((order[i] - last) % 12 + 12) % 12;
        if (next === last) next += 12;
        voicing.push(next);
        last = next;
      }
      if (voicing[voicing.length - 1] <= RH_HIGH) candidates.push(voicing);
    }
  }
  if (candidates.length === 0) return unique.map((pc) => RH_LOW + ((pc - RH_LOW) % 12 + 12) % 12);
  if (!previous || previous.length === 0) {
    // Default: root position closest to the middle of the range.
    const mid = (RH_LOW + RH_HIGH) / 2;
    return candidates
      .filter((v) => v[0] % 12 === chord.root)
      .sort((a, b) => Math.abs(avg(a) - mid) - Math.abs(avg(b) - mid))[0] ?? candidates[0];
  }
  return candidates.sort((a, b) => movement(a, previous) - movement(b, previous))[0];
}

/**
 * Pick at most three intervals a beginner can hold comfortably: triads as they are; for seventh
 * chords drop the fifth (root, third, seventh); for add9/6 chords keep the plain triad.
 */
export function chordTones(chord: ParsedChord): number[] {
  const iv = chord.intervals;
  if (iv.length <= 3) return iv;
  const seventh = iv.find((i) => i === 10 || i === 11);
  const third = iv.find((i) => i === 3 || i === 4 || i === 2 || i === 5) ?? iv[1];
  if (seventh !== undefined) return [0, third, seventh];
  return iv.slice(0, 3);
}

function avg(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Sum of distances from each new note to the nearest previous note, plus a small penalty for shifting the centre. */
function movement(voicing: number[], previous: number[]): number {
  let total = 0;
  for (const n of voicing) total += Math.min(...previous.map((p) => Math.abs(p - n)));
  return total + Math.abs(avg(voicing) - avg(previous)) * 0.5;
}

/** Left-hand bass note: the chord's bass pitch class in the octave below middle C. */
export function voiceLeftHand(chord: ParsedChord): number {
  // Prefer C2-B3; pick the octave that lands closest to G2-G3.
  const target = 48; // C3
  let best = LH_LOW + ((chord.bass - LH_LOW) % 12 + 12) % 12;
  while (best + 12 <= LH_HIGH && Math.abs(best + 12 - target) < Math.abs(best - target)) best += 12;
  return best;
}
