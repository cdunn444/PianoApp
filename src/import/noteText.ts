import { alignToBar } from '../model/song';
import type { NoteEvent, Hand } from '../model/song';
import { nameToMidi } from '../model/music';

export interface ParsedNoteText {
  notes: NoteEvent[];
  chords: { start: number; name: string }[];
  lyrics: { start: number; text: string }[];
  sections: { name: string; startBeat: number }[];
  meta: Record<string, string>;
}

const DUR: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 1 / 3 };

/** Parse a duration suffix: 'q', 'e.', 'h..', or a plain number of beats. */
export function parseDuration(s: string): number | null {
  const m = /^([whqest]|\d+(?:\.\d+)?)(\.*)$/.exec(s);
  if (!m) return null;
  let d = DUR[m[1]] ?? parseFloat(m[1]);
  let add = d / 2;
  for (let i = 0; i < m[2].length; i++) {
    d += add;
    add /= 2;
  }
  return d;
}

/**
 * Note text format (what Claude writes when converting a song by hand):
 *
 *   key: G            bpm: 90          time: 4/4
 *   [Verse]
 *   RH: G4/q G4/q D5/q D5/q | E5/q E5/q D5/h
 *   LH: [G3 B3 D4]/w | [G3 B3 D4]/w
 *   chords: G | G
 *   lyrics: Twin-kle twin-kle | lit-tle star
 *
 * Tokens: pitch/duration (C4/q, F#3/e., Bb2/h), rests (r/q), chords ([C4 E4 G4]/w).
 * Durations: w h q e s with optional dots, or a number of beats. '|' is a bar separator and
 * is only used for readability. Each hand keeps its own running time; RH/LH lines may repeat.
 */
export function parseNoteText(text: string, beatsPerBar: number): ParsedNoteText {
  const notes: NoteEvent[] = [];
  const chords: { start: number; name: string }[] = [];
  const lyrics: { start: number; text: string }[] = [];
  const sections: { name: string; startBeat: number }[] = [];
  const meta: Record<string, string> = {};
  const time: Record<Hand, number> = { L: 0, R: 0 };
  let chordTime = 0;
  let lyricTime = 0;

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec) {
      const t = Math.max(time.L, time.R);
      const bar = alignToBar(t, beatsPerBar);
      time.L = time.R = bar;
      chordTime = lyricTime = bar;
      sections.push({ name: sec[1].trim(), startBeat: bar });
      continue;
    }
    const kv = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const body = kv[2];
    if (key === 'rh' || key === 'lh' || key === 'r' || key === 'l') {
      const hand: Hand = key.startsWith('r') ? 'R' : 'L';
      for (const tok of tokenize(body)) {
        if (tok === '|') continue;
        const ev = parseToken(tok);
        if (!ev) continue;
        for (const midi of ev.midis) notes.push({ start: time[hand], duration: ev.duration, midi, hand });
        time[hand] += ev.duration;
      }
    } else if (key === 'chords') {
      for (const bar of body.split('|')) {
        const toks = bar.trim().split(/\s+/).filter(Boolean);
        if (toks.length === 0) {
          chordTime += beatsPerBar;
          continue;
        }
        const each = beatsPerBar / toks.length;
        for (const tk of toks) {
          if (tk !== '-' && tk !== '.') chords.push({ start: chordTime, name: tk });
          chordTime += each;
        }
      }
    } else if (key === 'lyrics') {
      for (const bar of body.split('|')) {
        const txt = bar.trim();
        if (txt && txt !== '-') lyrics.push({ start: lyricTime, text: txt });
        lyricTime += beatsPerBar;
      }
    } else {
      meta[key] = body.trim();
    }
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  return { notes, chords, lyrics, sections, meta };
}

function tokenize(body: string): string[] {
  // Keep bracketed chords together.
  const out: string[] = [];
  const re = /\[[^\]]*\]\/?[^\s|]*|\||[^\s|]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push(m[0]);
  return out;
}

function parseToken(tok: string): { midis: number[]; duration: number } | null {
  const m = /^(\[[^\]]*\]|[^/]+)(?:\/(.+))?$/.exec(tok);
  if (!m) return null;
  const duration = m[2] ? parseDuration(m[2]) : 1;
  if (duration === null) return null;
  const pitchPart = m[1];
  if (/^r(est)?$/i.test(pitchPart)) return { midis: [], duration };
  const names = pitchPart.startsWith('[') ? pitchPart.slice(1, -1).split(/[\s,]+/).filter(Boolean) : [pitchPart];
  const midis: number[] = [];
  for (const n of names) {
    const midi = nameToMidi(n);
    if (midi === null) return null;
    midis.push(midi);
  }
  return { midis, duration };
}

export function looksLikeNoteText(text: string): boolean {
  return /^\s*(rh|lh|r|l)\s*:/im.test(text);
}
