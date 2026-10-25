import { DEFAULT_OPTIONS, beatsPerBar, newSongId, type Song, type SongOptions, type SourceFormat, type NoteEvent } from '../model/song';
import { parseChordSheet, looksLikeChordSheet } from './chordSheet';
import { parseTab, looksLikeTab } from './tab';
import { parseNoteText, looksLikeNoteText } from './noteText';
import { guessKeyFromChords, guessKeyFromPitches } from './key';
import { transposeChordName } from './chords';
import { voiceLeftHand, voiceRightHand } from '../arrange/voicing';
import { applyPattern, type ChordSlot } from '../arrange/patterns';

export function detectFormat(text: string): SourceFormat {
  if (looksLikeNoteText(text)) return 'notes';
  if (looksLikeTab(text)) return 'tab';
  if (looksLikeChordSheet(text)) return 'chords';
  return 'chords';
}

export interface ImportMeta {
  title: string;
  artist?: string;
  bpm?: number;
  timeSig?: [number, number];
  key?: string;
  format?: SourceFormat;
  options?: Partial<SongOptions>;
}

/** Build a complete song from pasted text. */
export function importSong(text: string, meta: ImportMeta): Song {
  const format = meta.format ?? detectFormat(text);
  const song: Song = {
    id: newSongId(),
    title: meta.title.trim() || 'Untitled',
    artist: meta.artist?.trim() || undefined,
    bpm: meta.bpm ?? 90,
    timeSig: meta.timeSig ?? [4, 4],
    key: meta.key ?? '',
    source: { format, text },
    options: { ...DEFAULT_OPTIONS, ...meta.options },
    notes: [],
    chords: [],
    lyrics: [],
    sections: [],
    createdAt: Date.now(),
  };
  return rebuildSong(song);
}

/** Re-derive notes/chords/lyrics from the stored source text and options. */
export function rebuildSong(song: Song): Song {
  const bpb = beatsPerBar(song);
  const { text, format } = song.source;
  const o = song.options;
  let notes: NoteEvent[] = [];
  let chords: { start: number; name: string }[] = [];
  let lyrics: { start: number; text: string }[] = [];
  let sections: { name: string; startBeat: number }[] = [];
  let key = song.key;
  let bpm = song.bpm;
  let timeSig = song.timeSig;

  if (format === 'chords') {
    const sheet = parseChordSheet(text, { beatsPerBar: bpb, beatsPerChord: o.beatsPerChord });
    let prev: number[] | null = null;
    const slots: ChordSlot[] = sheet.slots.map((s) => {
      const rh = voiceRightHand(s.chord, prev);
      prev = rh;
      return { start: s.start, duration: s.duration, rh, lh: voiceLeftHand(s.chord) };
    });
    notes = applyPattern(slots, o.pattern);
    chords = sheet.slots.map((s) => ({ start: s.start, name: s.chord.name }));
    lyrics = sheet.lyrics;
    sections = sheet.sections;
    if (!key) key = guessKeyFromChords(sheet.slots.map((s) => s.chord));
  } else if (format === 'tab') {
    const tab = parseTab(text, { columnBeats: o.tabColumnBeats, splitPoint: o.splitPoint, beatsPerBar: bpb });
    notes = tab.notes;
    chords = tab.chords;
    sections = tab.sections;
    if (!key) key = guessKeyFromPitches(notes.map((n) => n.midi));
  } else {
    const nt = parseNoteText(text, bpb);
    notes = nt.notes;
    chords = nt.chords;
    lyrics = nt.lyrics;
    sections = nt.sections;
    if (nt.meta.key) key = key || nt.meta.key;
    if (nt.meta.bpm && !isNaN(parseInt(nt.meta.bpm, 10))) bpm = parseInt(nt.meta.bpm, 10);
    if (nt.meta.time) {
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(nt.meta.time);
      if (m) timeSig = [parseInt(m[1], 10), parseInt(m[2], 10)];
    }
    if (!key) key = guessKeyFromPitches(notes.map((n) => n.midi));
  }

  if (o.transpose) {
    const preferFlats = /b/.test(key) || /^F$/.test(key);
    notes = notes.map((n) => ({ ...n, midi: n.midi + o.transpose }));
    chords = chords.map((c) => ({ ...c, name: transposeChordName(c.name, o.transpose, preferFlats) }));
    key = transposeChordName(key, o.transpose, preferFlats);
  }

  const bpbFinal = (timeSig[0] * 4) / timeSig[1];
  return {
    ...song,
    key: key || 'C',
    bpm,
    timeSig,
    notes,
    chords,
    lyrics,
    sections: sections.map((s) => ({ name: s.name, startBar: Math.round(s.startBeat / bpbFinal) })),
  };
}
