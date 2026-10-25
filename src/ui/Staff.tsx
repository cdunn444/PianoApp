import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../model/song';
import { subscribeFrame } from '../engine/clock';
import { getPositionBeats } from '../engine/player';
import { GLYPHS } from './staff/glyphs';
import {
  BASS_TOP, HALF, LS, PX_PER_BEAT, STAFF_HEIGHT, TREBLE_TOP, keySignaturePositions, layoutSong, noteY,
  type HeadType, type LaidNote, type Layout,
} from './staff/layout';

const BASS_BOTTOM = BASS_TOP + 4 * LS;
const TREBLE_BOTTOM = TREBLE_TOP + 4 * LS;
const PAPER_TOP = TREBLE_TOP - LS * 1.5;
const PAPER_BOTTOM = BASS_BOTTOM + LS * 1.5;

interface Props {
  song: Song;
  /** Called whenever the set of sounding notes changes. */
  onActive?: (active: LaidNote[]) => void;
}

export function Staff({ song, onActive }: Props) {
  const layout = useMemo(() => layoutSong(song), [song]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<SVGGElement>(null);
  const noteRefs = useRef<Map<number, SVGGElement>>(new Map());
  const [size, setSize] = useState({ w: 800, h: STAFF_HEIGHT });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || STAFF_HEIGHT }));
    ro.observe(el);
    setSize({ w: el.clientWidth || 800, h: el.clientHeight || STAFF_HEIGHT });
    return () => ro.disconnect();
  }, []);

  const H = STAFF_HEIGHT;
  const W = Math.max(300, (size.w * H) / Math.max(1, size.h));
  const headerW = 14 + 36 + Math.abs(layout.key.count) * 10 + 10 + 24 + 10;
  const playheadX = headerW + 30;

  // Scroll + highlight loop. Touches the DOM directly, never React state.
  useEffect(() => {
    const active = new Set<number>();
    let last = -1;
    return subscribeFrame(() => {
      const pos = getPositionBeats();
      if (pos === last) return;
      last = pos;
      scrollRef.current?.setAttribute('transform', `translate(${playheadX - pos * PX_PER_BEAT} 0)`);
      let changed = false;
      for (const n of layout.notes) {
        const on = n.start <= pos + 1e-6 && n.end > pos + 1e-6;
        const was = active.has(n.id);
        if (on && !was) {
          active.add(n.id);
          noteRefs.current.get(n.id)?.classList.add('active');
          changed = true;
        } else if (!on && was) {
          active.delete(n.id);
          noteRefs.current.get(n.id)?.classList.remove('active');
          changed = true;
        }
      }
      if (changed && onActive) onActive(layout.notes.filter((n) => active.has(n.id)));
    });
  }, [layout, playheadX, onActive]);

  const keyTreble = keySignaturePositions(layout.key, 'R');
  const keyBass = keySignaturePositions(layout.key, 'L');
  const keyX = 14 + 36;
  const timeX = keyX + Math.abs(layout.key.count) * 10 + 8;

  return (
    <div className="staff-wrap" ref={wrapRef}>
      <svg className="staff" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        <defs>
          <clipPath id="staff-clip">
            <rect x={headerW} y={0} width={W - headerW} height={H} />
          </clipPath>
          <linearGradient id="playhead-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#4de3ff" stopOpacity="0" />
            <stop offset="1" stopColor="#4de3ff" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {/* paper */}
        <rect x={0} y={PAPER_TOP} width={W} height={PAPER_BOTTOM - PAPER_TOP} fill="#f3f0fa" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`t${i}`} x1={0} x2={W} y1={TREBLE_TOP + i * LS} y2={TREBLE_TOP + i * LS} className="staff-line" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`b${i}`} x1={0} x2={W} y1={BASS_TOP + i * LS} y2={BASS_TOP + i * LS} className="staff-line" />
        ))}

        {/* scrolling music */}
        <g clipPath="url(#staff-clip)">
          <g ref={scrollRef} transform={`translate(${playheadX} 0)`}>
            <ScrollingContent layout={layout} song={song} noteRefs={noteRefs.current} />
          </g>
        </g>

        {/* header: clefs, key, time */}
        <rect x={0} y={PAPER_TOP} width={headerW} height={PAPER_BOTTOM - PAPER_TOP} fill="#f3f0fa" />
        <line x1={0.6} x2={0.6} y1={TREBLE_TOP} y2={BASS_BOTTOM} className="barline" />
        <path d={GLYPHS.gClef.d} transform={`translate(12 ${noteY('G', 4, 'R')})`} className="glyph" />
        <path d={GLYPHS.fClef.d} transform={`translate(12 ${noteY('F', 3, 'L')})`} className="glyph" />
        {keyTreble.map((k, i) => (
          <path key={`kt${i}`} d={k.glyph === '♯' ? GLYPHS.accidentalSharp.d : GLYPHS.accidentalFlat.d} transform={`translate(${keyX + i * 10} ${k.y})`} className="glyph" />
        ))}
        {keyBass.map((k, i) => (
          <path key={`kb${i}`} d={k.glyph === '♯' ? GLYPHS.accidentalSharp.d : GLYPHS.accidentalFlat.d} transform={`translate(${keyX + i * 10} ${k.y})`} className="glyph" />
        ))}
        <TimeSig x={timeX} top={TREBLE_TOP} sig={song.timeSig} />
        <TimeSig x={timeX} top={BASS_TOP} sig={song.timeSig} />

        {/* playhead */}
        <rect x={playheadX - 34} y={PAPER_TOP - 6} width={34} height={PAPER_BOTTOM - PAPER_TOP + 12} fill="url(#playhead-grad)" />
        <rect x={playheadX - 1.5} y={PAPER_TOP - 6} width={3} height={PAPER_BOTTOM - PAPER_TOP + 12} rx={1.5} fill="#4de3ff" />
      </svg>
    </div>
  );
}

function TimeSig({ x, top, sig }: { x: number; top: number; sig: [number, number] }) {
  const digits = (n: number, y: number) =>
    String(n)
      .split('')
      .map((d, i) => <path key={i} d={GLYPHS[`timeSig${d}` as keyof typeof GLYPHS].d} transform={`translate(${x + i * 11} ${y})`} className="glyph" />);
  return (
    <g>
      {digits(sig[0], top + LS)}
      {digits(sig[1], top + 3 * LS)}
    </g>
  );
}

function ScrollingContent({ layout, song, noteRefs }: { layout: Layout; song: Song; noteRefs: Map<number, SVGGElement> }) {
  const lastBar = layout.barlines[layout.barlines.length - 1];
  return (
    <>
      {layout.barlines.map((b) => (
        <g key={`bar${b.bar}`}>
          <line x1={b.x} x2={b.x} y1={TREBLE_TOP} y2={BASS_BOTTOM} className="barline" strokeWidth={b === lastBar ? 3 : 1.2} />
          {b !== lastBar && (
            <text x={b.x + 3} y={TREBLE_TOP - 4} className="bar-number">{b.bar + 1}</text>
          )}
        </g>
      ))}
      {layout.chords.map((c, i) => (
        <text key={`c${i}`} x={c.x - 6} y={PAPER_TOP - 8} className="chord-name">{c.name}</text>
      ))}
      {layout.lyrics.map((l, i) => (
        <text key={`l${i}`} x={l.x - 6} y={PAPER_BOTTOM + 16} className="lyric">{l.text}</text>
      ))}
      {layout.rests.map((r, i) => (
        <Rest key={`r${i}`} x={r.x} y={r.y} type={r.type} dotted={r.dotted} />
      ))}
      {layout.stems.map((s, i) => (
        <g key={`s${i}`}>
          <line x1={s.x} x2={s.x} y1={s.y1} y2={s.y2} className="stem" />
          {s.head === 'eighth' && <path d={(s.up ? GLYPHS.flag8thUp : GLYPHS.flag8thDown).d} transform={`translate(${s.x - 0.6} ${s.y2})`} className="glyph" />}
          {s.head === 'sixteenth' && <path d={(s.up ? GLYPHS.flag16thUp : GLYPHS.flag16thDown).d} transform={`translate(${s.x - 0.6} ${s.y2})`} className="glyph" />}
        </g>
      ))}
      {layout.notes.map((n) => (
        <Note key={n.id} n={n} register={(el) => (el ? noteRefs.set(n.id, el) : noteRefs.delete(n.id))} />
      ))}
      {song.sections.map((s, i) => (
        <text key={`sec${i}`} x={s.startBar * PX_PER_BEAT * ((song.timeSig[0] * 4) / song.timeSig[1]) + 12} y={TREBLE_TOP - 4} className="section-name">{s.name}</text>
      ))}
    </>
  );
}

function Note({ n, register }: { n: LaidNote; register: (el: SVGGElement | null) => void }) {
  const head = n.head === 'whole' ? GLYPHS.noteheadWhole : n.head === 'half' ? GLYPHS.noteheadHalf : GLYPHS.noteheadBlack;
  const hw = head.w / 2;
  const x = n.x + n.dx;
  const onLine = Math.abs(((n.y - TREBLE_TOP) / HALF) % 2) < 1e-6;
  const filled = n.head !== 'whole' && n.head !== 'half';
  return (
    <g ref={register} className={`note hand-${n.hand} ${filled ? 'filled' : 'hollow'}`}>
      {n.ledgers.map((ly) => (
        <line key={ly} x1={x - hw - 4} x2={x + hw + 4} y1={ly} y2={ly} className="ledger" />
      ))}
      {n.accidental && (
        <path
          d={n.accidental === 'sharp' ? GLYPHS.accidentalSharp.d : n.accidental === 'flat' ? GLYPHS.accidentalFlat.d : GLYPHS.accidentalNatural.d}
          transform={`translate(${Math.min(x, n.x) - hw - 11} ${n.y})`}
          className="glyph accidental"
        />
      )}
      <path d={head.d} transform={`translate(${x - hw} ${n.y})`} className="head" />
      {n.dotted && <circle cx={Math.max(x, n.x) + hw + 4} cy={onLine ? n.y - HALF : n.y} r={1.8} className="dot" />}
      <text x={x} y={n.y + 3} className="note-letter">{n.letter}</text>
    </g>
  );
}

function Rest({ x, y, type, dotted }: { x: number; y: number; type: HeadType; dotted: boolean }) {
  const g = type === 'whole' ? GLYPHS.restWhole : type === 'half' ? GLYPHS.restHalf : type === 'quarter' ? GLYPHS.restQuarter : type === 'eighth' ? GLYPHS.rest8th : GLYPHS.rest16th;
  return (
    <g className="rest">
      <path d={g.d} transform={`translate(${x - g.w / 2} ${y})`} className="glyph" />
      {dotted && <circle cx={x + g.w / 2 + 4} cy={y - HALF} r={1.8} className="dot" />}
    </g>
  );
}

export { TREBLE_BOTTOM };
