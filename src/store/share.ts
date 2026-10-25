import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Song } from '../model/song';
import { importSong } from '../import';

/** Only the source and settings travel in a link; notes are rebuilt on arrival. */
interface Payload {
  v: 1;
  t: string;
  a?: string;
  b: number;
  ts: [number, number];
  k: string;
  f: Song['source']['format'];
  x: string;
  o: Song['options'];
}

export function encodeShare(song: Song): string {
  const p: Payload = {
    v: 1, t: song.title, a: song.artist, b: song.bpm, ts: song.timeSig, k: song.key,
    f: song.source.format, x: song.source.text, o: song.options,
  };
  return compressToEncodedURIComponent(JSON.stringify(p));
}

export function decodeShare(s: string): Song | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const p = JSON.parse(json) as Payload;
    if (p.v !== 1 || typeof p.x !== 'string') return null;
    return importSong(p.x, { title: p.t, artist: p.a, bpm: p.b, timeSig: p.ts, key: p.k, format: p.f, options: p.o });
  } catch {
    return null;
  }
}

export function shareUrl(song: Song): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/import?s=${encodeShare(song)}`;
}
