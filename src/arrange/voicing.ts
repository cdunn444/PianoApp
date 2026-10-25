import type { ParsedChord } from '../import/chords';
import type { Voicing } from '../model/song';

/** Right-hand close voicing range (inclusive). */
export const RH_LOW = 60; // C4
export const RH_HIGH = 79; // G5
/** Left-hand bass range: the octave just below middle C, where a beginner's left hand sits. */
export const LH_LOW = 36; // C2
/** "C position": the span a right hand covers with the thumb on or next to middle C. */
export const POS_LOW = 57; // A3
export const POS_HIGH = 71; // B4

/**
 * Choose right-hand pitches for a chord: a close-position voicing inside [RH_LOW, RH_HIGH]
 * that moves as little as possible from the previous voicing. Extensions beyond the first four
 * chord tones are dropped so a beginner never has more than four notes in one hand.
 */
export function voiceRightHand(chord: ParsedChord, previous: number[] | null, mode: Voicing = 'root'): number[] {
  const unique = [...new Set(chordTones(chord).map((i) => (chord.root + i) % 12))];
  if (mode === 'position') return voiceInPosition(chord, unique, previous);
  if (mode === 'root') return voiceRootPosition(chord, unique);
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

/**
 * Root position, in the octave that sits closest to middle C: C = C4 E4 G4, F = F4 A4 C5,
 * Am = A3 C4 E4, Em = E4 G4 B4, G = G3 B3 D4. Every chord always looks the same, and the notes
 * read bottom-to-top exactly as the chord is named.
 */
function voiceRootPosition(chord: ParsedChord, pcs: number[]): number[] {
  const order = [...pcs.slice(pcs.indexOf(chord.root)), ...pcs.slice(0, pcs.indexOf(chord.root))];
  let best: number[] | null = null;
  let bestDist = Infinity;
  for (let root = 48; root <= 71; root++) {
    if (root % 12 !== chord.root) continue;
    const v = [root];
    let last = root;
    for (const pc of order.slice(1)) {
      let next = last + (((pc - last) % 12) + 12) % 12;
      if (next === last) next += 12;
      v.push(next);
      last = next;
    }
    const dist = Math.abs(avg(v) - 64); // E4, the middle of a hand resting on middle C
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best ?? order.map((pc) => RH_LOW + (((pc - RH_LOW) % 12) + 12) % 12);
}

/**
 * Keep the hand in C position: strongly prefer voicings whose notes all sit inside A3–B4, then
 * the one that moves least from the previous chord, and root position on a tie. This is how
 * beginner methods (and Simply Piano's chord courses) teach chords: C = C E G, F = C F A,
 * G = B D G, G7 = B F G, Am = C E A, Dm = D F A.
 */
function voiceInPosition(chord: ParsedChord, pcs: number[], previous: number[] | null): number[] {
  let best: number[] | null = null;
  let bestCost = Infinity;
  for (let rot = 0; rot < pcs.length; rot++) {
    const order = [...pcs.slice(rot), ...pcs.slice(0, rot)];
    for (let base = POS_LOW - 12; base <= POS_HIGH; base++) {
      if (base % 12 !== order[0]) continue;
      const v = [base];
      let last = base;
      for (let i = 1; i < order.length; i++) {
        let next = last + (((order[i] - last) % 12) + 12) % 12;
        if (next === last) next += 12;
        v.push(next);
        last = next;
      }
      let cost = 0;
      for (const n of v) cost += 10 * Math.max(0, POS_LOW - n, n - POS_HIGH);
      cost += previous && previous.length ? movement(v, previous) : v.reduce((a, n) => a + Math.abs(n - 64), 0) / 3;
      if (v[0] % 12 !== chord.root) cost += 0.5;
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
  }
  return best ?? pcs.map((pc) => RH_LOW + (((pc - RH_LOW) % 12) + 12) % 12);
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

/**
 * Left-hand bass note: the chord's bass pitch class in the highest octave that still sits at least
 * a fifth below the right hand's lowest note, so the hands never share a key. With the right hand
 * near middle C this lands in G2–F#3 (C = C3, Am = A2, F = F3, G/B = B2).
 */
export function voiceLeftHand(chord: ParsedChord, rightHand: number[] = [60]): number {
  const ceiling = Math.min(...rightHand) - 7;
  let n = ceiling - ((((ceiling - chord.bass) % 12) + 12) % 12);
  while (n < LH_LOW) n += 12;
  return n;
}
