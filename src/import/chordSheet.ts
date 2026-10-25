import { alignToBar } from '../model/song';
import { parseChord, isChordToken, type ParsedChord } from './chords';

export interface SheetSlot {
  start: number;
  duration: number;
  chord: ParsedChord;
}

export interface ParsedSheet {
  slots: SheetSlot[];
  lyrics: { start: number; text: string }[];
  sections: { name: string; startBeat: number }[];
}

export interface SheetOptions {
  beatsPerBar: number;
  /** Beats a chord lasts when a line has no bar lines. */
  beatsPerChord: number;
}

const FILLERS = new Set(['-', '.', '/', '%', 'N.C.', 'NC', 'x', 'X', '*']);

const SECTION_RE = /^\s*(?:\[([^\]]+)\]|\(([^)]+)\)|((?:verse|chorus|bridge|intro|outro|pre-?chorus|interlude|solo|refrain|coda|ending|tag|hook)[^:]*):?)\s*$/i;

function sectionName(line: string): string | null {
  const m = SECTION_RE.exec(line);
  if (!m) return null;
  const name = (m[1] ?? m[2] ?? m[3] ?? '').trim();
  // A bracketed chord like [G] on its own is not a section.
  if (/^[A-G]/.test(name) && isChordToken(name)) return null;
  return name;
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  let chords = 0;
  for (const t of tokens) {
    const clean = t.replace(/[|,]/g, '');
    if (clean === '') continue;
    if (FILLERS.has(clean)) continue;
    if (isChordToken(clean)) chords++;
    else return false;
  }
  return chords > 0;
}

/**
 * Parse a chord sheet. Supported shapes, mixed freely:
 *   - bar lines:        G | D | Em C | G
 *   - chords over text: G        D
 *                       Twinkle twinkle little star
 *   - ChordPro inline:  [G]Twinkle [D]twinkle
 *   - section headers:  [Verse], Chorus:, (Bridge)
 */
export function parseChordSheet(text: string, opts: SheetOptions): ParsedSheet {
  const slots: SheetSlot[] = [];
  const lyrics: { start: number; text: string }[] = [];
  const sections: { name: string; startBeat: number }[] = [];
  let t = 0;
  let lastChord: ParsedChord | null = null;
  // Column positions of chords on the previous chord line, so lyric text can be split under them.
  let pendingColumns: { col: number; start: number }[] | null = null;

  const lines = text.replace(/\r/g, '').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    if (line.trim() === '') {
      pendingColumns = null;
      continue;
    }
    const sec = sectionName(line);
    if (sec !== null) {
      // Align sections to a bar boundary.
      t = alignToBar(t, opts.beatsPerBar);
      sections.push({ name: sec, startBeat: t });
      pendingColumns = null;
      continue;
    }

    if (/\[[^\]]+\]/.test(line) && !isChordLine(line.replace(/[[\]]/g, ' '))) {
      // ChordPro inline: [G]lyric [D]lyric
      const parts = line.split(/(\[[^\]]+\])/);
      let lyricBuf = '';
      let lyricStart = t;
      let sawChord = false;
      for (const part of parts) {
        const cm = /^\[([^\]]+)\]$/.exec(part);
        if (cm) {
          const ch = parseChord(cm[1]);
          if (!ch) {
            lyricBuf += part;
            continue;
          }
          if (lyricBuf.trim()) lyrics.push({ start: lyricStart, text: lyricBuf.trim() });
          lyricBuf = '';
          lyricStart = t;
          addSlot(ch, opts.beatsPerChord);
          sawChord = true;
        } else {
          lyricBuf += part;
        }
      }
      if (lyricBuf.trim()) lyrics.push({ start: lyricStart, text: lyricBuf.trim() });
      if (!sawChord && lastChord) {
        // A lyric line with bracketed non-chords; treat as plain lyric.
      }
      pendingColumns = null;
      continue;
    }

    if (line.includes('|') && isChordLine(line)) {
      // Bar-line format. Each |...| segment is one bar.
      const segments = line.split('|').map((s) => s.trim());
      // Drop empty leading/trailing segments produced by outer bar lines.
      if (segments.length && segments[0] === '') segments.shift();
      if (segments.length && segments[segments.length - 1] === '') segments.pop();
      const columns: { col: number; start: number }[] = [];
      for (const seg of segments) {
        const tokens = seg.split(/\s+/).filter(Boolean);
        const chordTokens = tokens.filter((tok) => !FILLERS.has(tok));
        if (chordTokens.length === 0) {
          // Empty bar or "%" repeats the previous chord.
          if (lastChord) addSlot(lastChord, opts.beatsPerBar);
          else t += opts.beatsPerBar;
          continue;
        }
        const each = opts.beatsPerBar / chordTokens.length;
        for (const tok of chordTokens) {
          const ch = parseChord(tok);
          if (ch) {
            columns.push({ col: line.indexOf(tok), start: t });
            addSlot(ch, each);
          } else if (lastChord) addSlot(lastChord, each);
          else t += each;
        }
      }
      pendingColumns = columns;
      continue;
    }

    if (isChordLine(line)) {
      // Chords over lyrics: every chord lasts beatsPerChord.
      const columns: { col: number; start: number }[] = [];
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const tok = m[0].replace(/,/g, '');
        if (FILLERS.has(tok)) {
          if (lastChord) addSlot(lastChord, opts.beatsPerChord);
          continue;
        }
        const ch = parseChord(tok);
        if (!ch) continue;
        columns.push({ col: m.index, start: t });
        addSlot(ch, opts.beatsPerChord);
      }
      pendingColumns = columns;
      continue;
    }

    // Lyric line.
    if (pendingColumns && pendingColumns.length > 0) {
      const cols = pendingColumns;
      const cuts = cols.map((c) => snapToWordStart(line, c.col));
      for (let i = 0; i < cols.length; i++) {
        const from = i === 0 ? 0 : cuts[i];
        const to = i + 1 < cols.length ? cuts[i + 1] : line.length;
        const piece = line.slice(from, to).trim();
        if (piece) lyrics.push({ start: cols[i].start, text: piece });
      }
    } else {
      lyrics.push({ start: t, text: line.trim() });
    }
    pendingColumns = null;
  }

  return { slots, lyrics, sections };

  function addSlot(ch: ParsedChord, duration: number) {
    slots.push({ start: t, duration, chord: ch });
    lastChord = ch;
    t += duration;
  }
}

/** If a column falls inside a word, move it back to the start of that word. */
function snapToWordStart(line: string, col: number): number {
  let c = Math.min(col, line.length);
  while (c > 0 && /\S/.test(line[c - 1] ?? '') && /\S/.test(line[c] ?? '')) c--;
  return c;
}

/** Heuristic: does this text look like a chord sheet (as opposed to a tab or note text)? */
export function looksLikeChordSheet(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const chordLines = lines.filter((l) => isChordLine(l) || /\[[A-G][^\]]*\]/.test(l)).length;
  return chordLines > 0;
}
