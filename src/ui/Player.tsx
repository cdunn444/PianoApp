import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hand, Song } from '../model/song';
import { songBars, songLengthBeats } from '../model/song';
import { subscribeFrame } from '../engine/clock';
import { getPositionBeats } from '../engine/player';
import { SPEEDS, usePlayer, type Loop, type Speed } from '../engine/player';
import { playNote, unlockAudio, onLoadState, type LoadState } from '../engine/audio';
import { Staff } from './Staff';
import { Keyboard, keyboardRange } from './Keyboard';
import type { LaidNote } from './staff/layout';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ExitIcon, LoopIcon, MetronomeIcon, NoteIcon, PauseIcon, PlayIcon, RestartIcon, SpeakerIcon } from './Icons';
import { navigate } from './router';

export function Player({ song }: { song: Song }) {
  const status = usePlayer((s) => s.status);
  const bar = usePlayer((s) => s.bar);
  const speed = usePlayer((s) => s.speed);
  const listen = usePlayer((s) => s.listen);
  const metronome = usePlayer((s) => s.metronome);
  const loop = usePlayer((s) => s.loop);
  const [active, setActive] = useState<Map<number, Hand>>(new Map());
  const [panelOpen, setPanelOpen] = useState(false);
  const [loopPicker, setLoopPicker] = useState(false);
  const [load, setLoad] = useState<LoadState>('idle');

  useEffect(() => {
    usePlayer.getState().load(song);
    return () => usePlayer.getState().unload();
  }, [song]);

  useEffect(() => onLoadState(setLoad), []);

  const onActive = useCallback((notes: LaidNote[]) => {
    const m = new Map<number, Hand>();
    for (const n of notes) m.set(n.midi, n.hand);
    setActive(m);
  }, []);

  const range = useMemo(() => keyboardRange(song.notes.map((n) => n.midi)), [song]);
  const bars = songBars(song);
  const playing = status === 'playing' || status === 'countin';

  const pressKey = async (midi: number) => {
    await unlockAudio();
    playNote(midi, 0.6);
  };

  const exit = () => {
    usePlayer.getState().unload();
    navigate('/');
  };

  return (
    <div className="player">
      <aside className="rail">
        <RailButton label={playing ? 'Pause' : 'Play'} onClick={() => usePlayer.getState().togglePlay()} primary>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </RailButton>
        <RailButton label="Restart" onClick={() => usePlayer.getState().restart()}>
          <RestartIcon />
        </RailButton>
        <RailButton label="Listen" onClick={() => usePlayer.getState().setListen(!listen)} active={listen}>
          <SpeakerIcon muted={!listen} />
        </RailButton>
        <div className="rail-spacer" />
        <RailButton label="Exit" onClick={exit}>
          <ExitIcon />
        </RailButton>
      </aside>

      <main className="stage">
        <header className="stage-top">
          <div className="song-title">
            <strong>{song.title}</strong>
            {song.artist && <span> · {song.artist}</span>}
            <span className="meta"> · {song.key} · {Math.round(song.bpm * speed)} bpm</span>
          </div>
          <div className="bar-nav">
            <button className="icon-btn small" onClick={() => usePlayer.getState().stepBar(-1)} disabled={bar <= 0} aria-label="Previous bar">
              <ArrowLeft />
            </button>
            <div className="bar-counter" onClick={() => setLoopPicker(true)}>
              {loop && <LoopIcon width={16} height={16} />}
              <span>{status === 'countin' ? '…' : Math.min(bars, bar + 1)}/{bars}</span>
            </div>
            <button className="icon-btn small" onClick={() => usePlayer.getState().stepBar(1)} disabled={bar >= bars - 1} aria-label="Next bar">
              <ArrowRight />
            </button>
          </div>
        </header>

        <ScrubBar song={song} />
        <Staff song={song} onActive={onActive} />

        <div className="bottom-strip">
          {panelOpen ? (
            <div className="panel-body">
              <div className="control">
                <div className="segmented">
                  {SPEEDS.map((s) => (
                    <button key={s} className={speed === s ? 'on' : ''} onClick={() => usePlayer.getState().setSpeed(s as Speed)}>
                      {s.toFixed(1)}x
                    </button>
                  ))}
                </div>
                <label>Speed</label>
              </div>
              <div className="control">
                <button className={`icon-btn ${loop ? 'on' : ''}`} onClick={() => setLoopPicker(true)} aria-label="Practice a section">
                  <NoteIcon />
                </button>
                <label>Practice</label>
              </div>
              <div className="control">
                <button className={`icon-btn ${metronome ? 'on' : ''}`} onClick={() => usePlayer.getState().setMetronome(!metronome)} aria-label="Metronome">
                  <MetronomeIcon />
                </button>
                <label>Metronome</label>
              </div>
            </div>
          ) : (
            <div className="keyboard-wrap">
              <Keyboard low={range.low} high={range.high} active={active} onPress={pressKey} />
            </div>
          )}
          <button className="panel-toggle" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? 'Show keyboard' : 'Show controls'}>
            {panelOpen ? <ChevronDown /> : <ChevronUp />}
            <span>{panelOpen ? 'Keys' : 'More'}</span>
          </button>
        </div>

        {load === 'loading' && <div className="toast">Loading piano sounds…</div>}
        {load === 'error' && <div className="toast error">Could not load piano sounds. Check your connection.</div>}
      </main>

      {loopPicker && <LoopPicker song={song} loop={loop} onClose={() => setLoopPicker(false)} />}
    </div>
  );
}

/** Thin progress bar under the header: tap or drag anywhere on it to jump. */
function ScrubBar({ song }: { song: Song }) {
  const fill = useRef<HTMLDivElement>(null);
  const total = songLengthBeats(song);
  useEffect(
    () =>
      subscribeFrame(() => {
        const f = Math.min(1, Math.max(0, getPositionBeats() / total));
        if (fill.current) fill.current.style.width = `${f * 100}%`;
      }),
    [total],
  );
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    usePlayer.getState().seekBeats(f * total);
  };
  return (
    <div
      className="scrub"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        usePlayer.getState().scrubStart();
        seek(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
      }}
      onPointerUp={() => usePlayer.getState().scrubEnd()}
      onPointerCancel={() => usePlayer.getState().scrubEnd()}
    >
      <div className="scrub-track"><div className="scrub-fill" ref={fill} /></div>
    </div>
  );
}

function RailButton({ label, onClick, children, primary, active }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean; active?: boolean }) {
  return (
    <div className="rail-item">
      <button className={`icon-btn${primary ? ' primary' : ''}${active === false ? ' dim' : ''}`} onClick={onClick} aria-label={label}>
        {children}
      </button>
      <label>{label}</label>
    </div>
  );
}

function LoopPicker({ song, loop, onClose }: { song: Song; loop: Loop | null; onClose: () => void }) {
  const bars = songBars(song);
  const [start, setStart] = useState(loop?.startBar ?? usePlayer.getState().bar);
  const [end, setEnd] = useState(loop?.endBar ?? Math.min(bars - 1, (loop?.startBar ?? usePlayer.getState().bar) + 3));
  const sections = song.sections.map((s, i) => ({
    name: s.name,
    start: s.startBar,
    end: (song.sections[i + 1]?.startBar ?? bars) - 1,
  }));

  const apply = () => {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    usePlayer.getState().setLoop({ startBar: s, endBar: e });
    onClose();
  };
  const clear = () => {
    usePlayer.getState().setLoop(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Practice a section</h2>
        <p className="muted">The chosen bars repeat until you stop. Slow the speed down to learn them.</p>
        {sections.length > 0 && (
          <div className="chips">
            {sections.map((s, i) => (
              <button key={i} className={`chip${start === s.start && end === s.end ? ' on' : ''}`} onClick={() => { setStart(s.start); setEnd(s.end); }}>
                {s.name} <span className="muted">{s.start + 1}–{s.end + 1}</span>
              </button>
            ))}
            <button className={`chip${start === 0 && end === bars - 1 ? ' on' : ''}`} onClick={() => { setStart(0); setEnd(bars - 1); }}>
              Whole song
            </button>
          </div>
        )}
        <div className="range-row">
          <Stepper label="From bar" value={start + 1} min={1} max={bars} onChange={(v) => setStart(v - 1)} />
          <Stepper label="To bar" value={end + 1} min={1} max={bars} onChange={(v) => setEnd(v - 1)} />
        </div>
        <div className="modal-actions">
          {loop && <button className="btn ghost" onClick={clear}>Stop looping</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={apply}>Loop bars {Math.min(start, end) + 1}–{Math.max(start, end) + 1}</button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <label>{label}</label>
      <div>
        <button className="icon-btn small" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less"><ArrowLeft /></button>
        <span>{value}</span>
        <button className="icon-btn small" onClick={() => onChange(Math.min(max, value + 1))} aria-label="More"><ArrowRight /></button>
      </div>
    </div>
  );
}
