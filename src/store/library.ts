import { get, set } from 'idb-keyval';
import { create } from 'zustand';
import type { Song } from '../model/song';
import { rebuildSong } from '../import';
import { STARTER_SONGS } from '../songs/starters';

const KEY = 'pianoapp.songs.v1';

interface LibraryState {
  songs: Song[];
  loaded: boolean;
  init: () => Promise<void>;
  save: (song: Song) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => Song | undefined;
}

async function persist(songs: Song[]) {
  try {
    await set(KEY, songs.filter((s) => !s.builtIn));
  } catch (e) {
    console.warn('Could not save library', e);
  }
}

export const useLibrary = create<LibraryState>((setState, getState) => ({
  songs: [],
  loaded: false,

  async init() {
    if (getState().loaded) return;
    let stored: Song[] = [];
    try {
      stored = ((await get<Song[]>(KEY)) ?? []).map((s) => rebuildSong(s));
    } catch (e) {
      console.warn('Could not read library', e);
    }
    const builtIns = STARTER_SONGS.map((s) => ({ ...s, builtIn: true }));
    setState({ songs: [...stored.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), ...builtIns], loaded: true });
  },

  async save(song) {
    const songs = getState().songs.filter((s) => s.id !== song.id);
    const next = [{ ...song, builtIn: false }, ...songs];
    setState({ songs: next });
    await persist(next);
  },

  async remove(id) {
    const next = getState().songs.filter((s) => s.id !== id || s.builtIn);
    setState({ songs: next });
    await persist(next);
  },

  byId(id) {
    return getState().songs.find((s) => s.id === id);
  },
}));
