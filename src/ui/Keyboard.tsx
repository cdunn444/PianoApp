import { useMemo } from 'react';
import type { Hand } from '../model/song';
import { isBlackKey, midiToName } from '../model/music';

interface Props {
  low: number; // MIDI of lowest key (snapped to a C)
  high: number; // MIDI of highest key (snapped to a B or C)
  active: Map<number, Hand>;
  onPress?: (midi: number) => void;
}

const WK_W = 24;
const WK_H = 100;
const BK_W = 14;
const BK_H = 62;

export function Keyboard({ low, high, active, onPress }: Props) {
  const keys = useMemo(() => {
    const whites: { midi: number; x: number }[] = [];
    const blacks: { midi: number; x: number }[] = [];
    let x = 0;
    for (let m = low; m <= high; m++) {
      if (isBlackKey(m)) blacks.push({ midi: m, x: x - BK_W / 2 });
      else {
        whites.push({ midi: m, x });
        x += WK_W;
      }
    }
    return { whites, blacks, width: x };
  }, [low, high]);

  const press = (midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    onPress?.(midi);
  };

  return (
    <svg className="keyboard" viewBox={`0 0 ${keys.width} ${WK_H}`} preserveAspectRatio="none" width="100%" height="100%">
      {keys.whites.map((k) => {
        const hand = active.get(k.midi);
        return (
          <g key={k.midi} onPointerDown={press(k.midi)}>
            <rect x={k.x + 0.5} y={0} width={WK_W - 1} height={WK_H} rx={3} className={`wkey${hand ? ` on hand-${hand}` : ''}`} />
            {k.midi % 12 === 0 && (
              <text x={k.x + WK_W / 2} y={WK_H - 8} className="key-label">{midiToName(k.midi)}</text>
            )}
          </g>
        );
      })}
      {keys.blacks.map((k) => {
        const hand = active.get(k.midi);
        return (
          <rect key={k.midi} x={k.x} y={0} width={BK_W} height={BK_H} rx={2} className={`bkey${hand ? ` on hand-${hand}` : ''}`} onPointerDown={press(k.midi)} />
        );
      })}
    </svg>
  );
}

/** Choose a keyboard range covering all notes in the song, snapped to octaves, at least C3-C6. */
export function keyboardRange(midis: number[]): { low: number; high: number } {
  let low = 48;
  let high = 84;
  if (midis.length) {
    low = Math.min(low, Math.floor(Math.min(...midis) / 12) * 12);
    high = Math.max(high, Math.ceil((Math.max(...midis) + 1) / 12) * 12);
  }
  // Keep it playable on a phone: at most four octaves.
  while (high - low > 48) {
    if (low < 48) low += 12;
    else high -= 12;
  }
  return { low, high };
}
