import type { NoteEvent, Pattern } from '../model/song';

export interface ChordSlot {
  start: number;
  duration: number;
  rh: number[];
  lh: number;
}

/** Expand chord slots into note events according to a rhythm pattern. */
export function applyPattern(slots: ChordSlot[], pattern: Pattern): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const slot of slots) {
    const end = slot.start + slot.duration;
    switch (pattern) {
      case 'whole': {
        // One block chord for the whole slot (split into bar-sized hits if longer than 4 beats).
        for (let t = slot.start; t < end - 1e-9; t += 4) {
          const d = Math.min(4, end - t);
          push(out, t, d, slot);
        }
        break;
      }
      case 'half': {
        for (let t = slot.start; t < end - 1e-9; t += 2) {
          const d = Math.min(2, end - t);
          push(out, t, d, slot);
        }
        break;
      }
      case 'quarter': {
        for (let t = slot.start; t < end - 1e-9; t += 1) {
          const d = Math.min(1, end - t);
          push(out, t, d, slot);
        }
        break;
      }
      case 'broken': {
        // LH root held, RH plays the chord tones up and down as eighth notes.
        for (let t = slot.start; t < end - 1e-9; t += 4) {
          const d = Math.min(4, end - t);
          out.push({ start: t, duration: d, midi: slot.lh, hand: 'L' });
          const seq = [...slot.rh, ...slot.rh.slice(1, -1).reverse()];
          let i = 0;
          for (let s = t; s < t + d - 1e-9; s += 0.5) {
            out.push({ start: s, duration: 0.5, midi: seq[i % seq.length], hand: 'R' });
            i++;
          }
        }
        break;
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi);
}

function push(out: NoteEvent[], t: number, d: number, slot: ChordSlot) {
  out.push({ start: t, duration: d, midi: slot.lh, hand: 'L' });
  for (const m of slot.rh) out.push({ start: t, duration: d, midi: m, hand: 'R' });
}
