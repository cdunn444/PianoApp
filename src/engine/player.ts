import * as Tone from 'tone';
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { beatsPerBar, songBars, songLengthBeats, type Song } from '../model/song';
import { PPQ, beatsToTicks, playClick, playNote, unlockAudio } from './audio';

export type Status = 'idle' | 'countin' | 'playing' | 'paused' | 'ended';
export const SPEEDS = [0.6, 0.8, 1.0] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Loop {
  startBar: number; // inclusive, 0-based
  endBar: number; // inclusive
}

interface PlayerState {
  song: Song | null;
  status: Status;
  speed: Speed;
  listen: boolean;
  metronome: boolean;
  loop: Loop | null;
  /** Bar index (0-based) the playhead is in; updated a few times a second for the UI. */
  bar: number;
  /** Base tempo in use (the song's bpm unless the user adjusted it for this song). */
  bpm: number;
  setTempo: (bpm: number) => void;
  load: (song: Song) => void;
  unload: () => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  seekBar: (bar: number) => void;
  /** Move the playhead to an exact beat (used by scrubbing). */
  seekBeats: (beat: number) => void;
  scrubStart: () => void;
  scrubEnd: () => void;
  stepBar: (delta: number) => void;
  setSpeed: (s: Speed) => void;
  setListen: (v: boolean) => void;
  setMetronome: (v: boolean) => void;
  setLoop: (loop: Loop | null) => void;
}

// --- Tone objects live outside the store so React never re-renders on audio events. ---
let notePart: Tone.Part | null = null;
let clickPart: Tone.Part | null = null;
let endEventId: number | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;
let barTimer: number | null = null;
let resumeAfterScrub = false;

const T = () => Tone.getTransport();

/** Count-in offset in beats: song beat 0 sits one bar into the transport timeline. */
function offsetBeats(song: Song): number {
  return beatsPerBar(song);
}

/** Current playhead position in song beats (negative during the count-in). */
export function getPositionBeats(): number {
  const s = usePlayer.getState();
  if (!s.song) return 0;
  return T().ticks / PPQ - offsetBeats(s.song);
}

function clearSchedule() {
  notePart?.dispose();
  clickPart?.dispose();
  notePart = null;
  clickPart = null;
  if (endEventId !== null) {
    T().clear(endEventId);
    endEventId = null;
  }
  T().loop = false;
}

function schedule(song: Song) {
  clearSchedule();
  const off = offsetBeats(song);
  const bpb = beatsPerBar(song);
  const total = songLengthBeats(song);

  const events = song.notes.map((n) => ({ time: beatsToTicks(n.start + off), midi: n.midi, dur: n.duration }));
  notePart = new Tone.Part((time, ev: { midi: number; dur: number }) => {
    if (!usePlayer.getState().listen) return;
    playNote(ev.midi, beatsToTicks(Math.max(0.1, ev.dur * 0.95)), time);
  }, events).start(0);

  // One click per beat across count-in and song. Count-in clicks always sound.
  const clicks: { time: string; beat: number }[] = [];
  for (let b = 0; b < total + off; b++) clicks.push({ time: `${b * PPQ}i`, beat: b });
  clickPart = new Tone.Part((time, ev: { beat: number }) => {
    const st = usePlayer.getState();
    const inCountIn = ev.beat < off;
    if (!inCountIn && !st.metronome) return;
    playClick(ev.beat % bpb === 0, time);
  }, clicks).start(0);

  endEventId = T().schedule(() => {
    Tone.getDraw().schedule(() => {
      const st = usePlayer.getState();
      if (st.loop) return;
      T().pause();
      usePlayer.setState({ status: 'ended' });
      releaseWakeLock();
    }, Tone.now());
  }, `${(total + off) * PPQ}i`);
}

function applyTempo(song: Song, speed: number, bpm = usePlayer.getState().bpm || song.bpm) {
  T().bpm.value = bpm * speed;
  T().timeSignature = song.timeSig;
}

const tempoKey = (song: Song) => `pianoapp.tempo.${song.id}`;

function applyLoop(song: Song, loop: Loop | null) {
  const t = T();
  if (!loop) {
    t.loop = false;
    return;
  }
  const off = offsetBeats(song);
  const bpb = beatsPerBar(song);
  t.loopStart = `${(off + loop.startBar * bpb) * PPQ}i`;
  t.loopEnd = `${(off + (loop.endBar + 1) * bpb) * PPQ}i`;
  t.loop = true;
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
  } catch {
    /* unsupported or denied */
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

function startBarTimer() {
  stopBarTimer();
  barTimer = window.setInterval(() => {
    const s = usePlayer.getState();
    if (!s.song) return;
    const bar = Math.max(0, Math.floor(getPositionBeats() / beatsPerBar(s.song)));
    if (bar !== s.bar) usePlayer.setState({ bar });
    if (s.status === 'countin' && getPositionBeats() >= 0) usePlayer.setState({ status: 'playing' });
  }, 100);
}

function stopBarTimer() {
  if (barTimer !== null) window.clearInterval(barTimer);
  barTimer = null;
}

/** Transport position (ticks) for the start of a song bar, including the count-in offset. */
function barTicks(song: Song, bar: number, countIn: boolean): number {
  const bpb = beatsPerBar(song);
  const beats = offsetBeats(song) + bar * bpb - (countIn ? bpb : 0);
  return Math.max(0, beats) * PPQ;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  song: null,
  status: 'idle',
  speed: 1.0,
  listen: true,
  metronome: false,
  loop: null,
  bar: 0,
  bpm: 0,

  load(song) {
    T().stop();
    clearSchedule();
    schedule(song);
    set({ song, status: 'idle', loop: null, bar: 0, bpm: song.bpm });
    applyTempo(song, get().speed, song.bpm);
    T().ticks = barTicks(song, 0, false);
    idbGet<number>(tempoKey(song))
      .then((saved) => {
        if (saved && get().song?.id === song.id) {
          set({ bpm: saved });
          applyTempo(song, get().speed, saved);
        }
      })
      .catch(() => undefined);
  },

  setTempo(bpm) {
    const { song, speed } = get();
    if (!song) return;
    const b = Math.min(240, Math.max(30, Math.round(bpm)));
    set({ bpm: b });
    applyTempo(song, speed, b);
    idbSet(tempoKey(song), b).catch(() => undefined);
  },

  unload() {
    T().stop();
    clearSchedule();
    stopBarTimer();
    releaseWakeLock();
    set({ song: null, status: 'idle', loop: null, bar: 0 });
  },

  async play() {
    const { song, status, loop } = get();
    if (!song) return;
    await unlockAudio();
    applyTempo(song, get().speed);
    if (status === 'paused') {
      T().start();
      set({ status: getPositionBeats() < 0 ? 'countin' : 'playing' });
    } else {
      // Fresh start (idle / ended): count in one bar before the start bar (or the loop start).
      const startBar = loop ? loop.startBar : status === 'ended' ? 0 : get().bar;
      applyLoop(song, loop);
      T().ticks = barTicks(song, startBar, true);
      T().start();
      set({ status: 'countin', bar: startBar });
    }
    startBarTimer();
    void requestWakeLock();
  },

  pause() {
    if (get().status === 'playing' || get().status === 'countin') {
      T().pause();
      set({ status: 'paused' });
      releaseWakeLock();
    }
  },

  togglePlay() {
    const st = get().status;
    if (st === 'playing' || st === 'countin') get().pause();
    else void get().play();
  },

  restart() {
    const { song, loop } = get();
    if (!song) return;
    T().pause();
    const bar = loop ? loop.startBar : 0;
    T().ticks = barTicks(song, bar, false);
    set({ status: 'idle', bar });
    releaseWakeLock();
  },

  seekBar(bar) {
    const { song, status } = get();
    if (!song) return;
    const max = songBars(song) - 1;
    const b = Math.min(max, Math.max(0, bar));
    const wasPlaying = status === 'playing' || status === 'countin';
    T().ticks = barTicks(song, b, false);
    set({ bar: b, status: wasPlaying ? 'playing' : 'idle' });
  },

  seekBeats(beat) {
    const { song, status } = get();
    if (!song) return;
    const total = songLengthBeats(song);
    const b = Math.min(total - 0.001, Math.max(0, beat));
    T().ticks = (offsetBeats(song) + b) * PPQ;
    const bar = Math.floor(b / beatsPerBar(song));
    set({ bar, status: status === 'ended' ? 'paused' : status === 'countin' ? 'playing' : status });
  },

  scrubStart() {
    const st = get().status;
    resumeAfterScrub = st === 'playing' || st === 'countin';
    if (resumeAfterScrub) {
      T().pause();
      set({ status: 'paused' });
    }
  },

  scrubEnd() {
    if (resumeAfterScrub) {
      resumeAfterScrub = false;
      T().start();
      set({ status: 'playing' });
      startBarTimer();
    }
  },

  stepBar(delta) {
    get().seekBar(get().bar + delta);
  },

  setSpeed(speed) {
    set({ speed });
    const { song } = get();
    if (song) applyTempo(song, speed);
  },

  setListen(listen) {
    set({ listen });
  },

  setMetronome(metronome) {
    set({ metronome });
  },

  setLoop(loop) {
    const { song, status } = get();
    set({ loop });
    if (!song) return;
    applyLoop(song, loop);
    if (loop) {
      const bpb = beatsPerBar(song);
      const pos = getPositionBeats();
      const inside = pos >= loop.startBar * bpb && pos < (loop.endBar + 1) * bpb;
      if (!inside) {
        T().ticks = barTicks(song, loop.startBar, false);
        set({ bar: loop.startBar, status: status === 'playing' || status === 'countin' ? 'playing' : 'idle' });
      }
    }
  },
}));
