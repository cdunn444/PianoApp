import { alignToBar, type Hand, type NoteEvent } from '../model/song';
import { parseChord } from './chords';
import { isChordToken } from './chords';

export interface TabOptions {
  /** Beats per character column. 0.5 = eighth notes. */
  columnBeats: number;
  /** Notes below this MIDI number go to the left hand. */
  splitPoint: number;
  beatsPerBar: number;
}

export interface ParsedTab {
  notes: NoteEvent[];
  chords: { start: number; name: string }[];
  sections: { name: string; startBeat: number }[];
}

/** Standard tuning, high string first: e4 B3 G3 D3 A2 E2. */
const STANDARD = [64, 59, 55, 50, 45, 40];
const LABEL_PITCH: Record<string, number> = { e: 64, B: 59, b: 59, G: 55, g: 55, D: 50, d: 50, A: 45, a: 45, E: 40 };

const TAB_LINE_RE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?\s*([-0-9hpbrx/\\~^()\s|]*[-|][-0-9hpbrx/\\~^()\s|]*)$/;

function isTabLine(line: string): boolean {
  if (!/-/.test(line)) return false;
  if (!TAB_LINE_RE.test(line)) return false;
  // Require a reasonable amount of dashes to avoid matching lyric lines with hyphens.
  const dashes = (line.match(/-/g) ?? []).length;
  return dashes >= 4;
}

/** Split the label prefix (e.g. 'e|') from the body of a tab line. Returns body start column. */
function splitLabel(line: string): { label: string | null; bodyStart: number } {
  const m = /^(\s*)([A-Ga-g][#b]?)?\s*\|?/.exec(line);
  if (!m) return { label: null, bodyStart: 0 };
  return { label: m[2] ?? null, bodyStart: m[0].length };
}

/**
 * Parse ASCII guitar tab: blocks of six lines (high e on top). Every character column is one
 * subdivision; digits are frets; notes sharing a column are played together. Guitar is written an
 * octave above where it sounds, so pitches are raised an octave to sit well on the piano.
 */
export function parseTab(text: string, opts: TabOptions): ParsedTab {
  const lines = text.replace(/\r/g, '').split('\n');
  const notes: NoteEvent[] = [];
  const chords: { start: number; name: string }[] = [];
  const sections: { name: string; startBeat: number }[] = [];
  let t = 0;
  let i = 0;
  let pendingChordLine: string | null = null;

  while (i < lines.length) {
    const line = lines[i];
    // Gather a block of consecutive tab lines.
    if (isTabLine(line)) {
      const block: string[] = [];
      while (i < lines.length && isTabLine(lines[i])) block.push(lines[i++]);
      // Use the last six lines if more than six (some tabs include a stray line).
      const strings = block.slice(-6);
      if (strings.length < 2) continue;
      const parsed = strings.map(splitLabel);
      const bodyStart = Math.max(...parsed.map((p) => p.bodyStart));
      const labelled = parsed.every((p) => p.label !== null) && strings.length === 6;
      const tuning = labelled
        ? parsed.map((p, idx) => LABEL_PITCH[p.label!] ?? STANDARD[idx])
        : STANDARD.slice(6 - strings.length);
      const bodies = strings.map((s) => s.slice(bodyStart));
      const width = Math.max(...bodies.map((b) => b.length));

      // Chord names above the block, positioned by column.
      if (pendingChordLine) {
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(pendingChordLine))) {
          if (!isChordToken(m[0])) continue;
          const col = Math.max(0, m.index - bodyStart);
          chords.push({ start: t + col * opts.columnBeats, name: parseChord(m[0])!.name });
        }
        pendingChordLine = null;
      }

      // Columns that only contain bar lines take no time.
      const colTime: number[] = [];
      let local = 0;
      for (let c = 0; c < width; c++) {
        const chars = bodies.map((b) => b[c] ?? '-');
        const isBar = chars.every((ch) => ch === '|' || ch === ' ' || ch === undefined) && chars.some((ch) => ch === '|');
        colTime.push(local);
        if (!isBar) local += opts.columnBeats;
      }
      const blockNotes: NoteEvent[] = [];
      for (let s = 0; s < bodies.length; s++) {
        const body = bodies[s];
        let c = 0;
        while (c < width) {
          const ch = body[c];
          if (ch && /\d/.test(ch)) {
            let numStr = ch;
            // Two-digit frets.
            if (body[c + 1] && /\d/.test(body[c + 1]) && parseInt(ch + body[c + 1], 10) <= 24) {
              numStr += body[c + 1];
            }
            const fret = parseInt(numStr, 10);
            const midi = tuning[s] + fret + 12;
            blockNotes.push({ start: t + colTime[c], duration: 0, midi, hand: midi < opts.splitPoint ? 'L' : 'R' });
            c += numStr.length;
            continue;
          }
          c++;
        }
      }
      // Durations: a note lasts until the next event in the block (any string), capped at a bar.
      const starts = [...new Set(blockNotes.map((n) => n.start))].sort((a, b) => a - b);
      const blockEnd = t + local;
      for (const n of blockNotes) {
        const idx = starts.indexOf(n.start);
        const next = idx + 1 < starts.length ? starts[idx + 1] : blockEnd;
        n.duration = Math.max(opts.columnBeats, Math.min(opts.beatsPerBar, next - n.start));
      }
      notes.push(...blockNotes);
      t = blockEnd;
      continue;
    }

    const sec = /^\s*(?:\[([^\]]+)\]|((?:verse|chorus|bridge|intro|outro|pre-?chorus|interlude|solo)[^:]*):?)\s*$/i.exec(line);
    if (sec) {
      t = alignToBar(t, opts.beatsPerBar);
      sections.push({ name: (sec[1] ?? sec[2]).trim(), startBeat: t });
    } else if (line.trim() && line.trim().split(/\s+/).every(isChordToken)) {
      pendingChordLine = line;
    }
    i++;
  }

  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  return { notes, chords, sections };
}

export function looksLikeTab(text: string): boolean {
  const lines = text.split('\n');
  let run = 0;
  for (const l of lines) {
    if (isTabLine(l)) {
      run++;
      if (run >= 4) return true;
    } else run = 0;
  }
  return false;
}

export function handFor(midi: number, splitPoint: number): Hand {
  return midi < splitPoint ? 'L' : 'R';
}
