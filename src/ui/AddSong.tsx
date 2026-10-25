import { useMemo, useState } from 'react';
import { detectFormat, importSong, rebuildSong } from '../import';
import { DEFAULT_OPTIONS, songBars, type Pattern, type Song, type SourceFormat, type Voicing } from '../model/song';
import { useLibrary } from '../store/library';
import { navigate } from './router';
import { BackIcon } from './Icons';

const EXAMPLE = `[Verse]
G          D          Em         C
Here's a chord sheet: one chord per bar
G | D | Em C | G
`;

interface Props {
  existing?: Song;
}

export function AddSong({ existing }: Props) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artist ?? '');
  const [text, setText] = useState(existing?.source.text ?? '');
  const [format, setFormat] = useState<SourceFormat | 'auto'>(existing?.source.format ?? 'auto');
  const [bpm, setBpm] = useState(existing?.bpm ?? 90);
  const [timeSig, setTimeSig] = useState<string>(existing ? `${existing.timeSig[0]}/${existing.timeSig[1]}` : '4/4');
  const [key, setKey] = useState(existing?.key ?? '');
  const [pattern, setPattern] = useState<Pattern>(existing?.options.pattern ?? DEFAULT_OPTIONS.pattern);
  const [voicing, setVoicing] = useState<Voicing>(existing?.options.voicing ?? DEFAULT_OPTIONS.voicing);
  const [transpose, setTranspose] = useState(existing?.options.transpose ?? 0);
  const [beatsPerChord, setBeatsPerChord] = useState(existing?.options.beatsPerChord ?? DEFAULT_OPTIONS.beatsPerChord);
  const [tabColumn, setTabColumn] = useState(existing?.options.tabColumnBeats ?? DEFAULT_OPTIONS.tabColumnBeats);
  const [splitPoint, setSplitPoint] = useState(existing?.options.splitPoint ?? DEFAULT_OPTIONS.splitPoint);
  const [error, setError] = useState<string | null>(null);

  const detected = useMemo(() => (format === 'auto' ? detectFormat(text) : format), [format, text]);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const ts = /^(\d+)\s*\/\s*(\d+)$/.exec(timeSig.trim());
      const song = importSong(text, {
        title: title || 'Untitled',
        artist,
        bpm,
        timeSig: ts ? [parseInt(ts[1], 10), parseInt(ts[2], 10)] : [4, 4],
        key: key.trim() || undefined,
        format: detected,
        options: { pattern, voicing, transpose, beatsPerChord, tabColumnBeats: tabColumn, splitPoint },
      });
      return song;
    } catch (e) {
      return { error: String(e) } as { error: string };
    }
  }, [text, title, artist, bpm, timeSig, key, detected, pattern, voicing, transpose, beatsPerChord, tabColumn, splitPoint]);

  const previewSong = preview && 'notes' in preview ? preview : null;

  const save = async () => {
    if (!previewSong) {
      setError('Paste a chord sheet, tab or note text first.');
      return;
    }
    if (previewSong.notes.length === 0) {
      setError('No notes were found. Check the format help below.');
      return;
    }
    let song = previewSong;
    if (existing && !existing.builtIn) song = rebuildSong({ ...previewSong, id: existing.id, createdAt: existing.createdAt });
    await useLibrary.getState().save(song);
    navigate(`/play/${song.id}`);
  };

  return (
    <div className="screen add-song">
      <header className="screen-header">
        <button className="icon-btn small" onClick={() => navigate('/')} aria-label="Back"><BackIcon /></button>
        <h1>{existing ? (existing.builtIn ? 'Copy song' : 'Edit song') : 'Add song'}</h1>
        <button className="btn" onClick={save}>Save</button>
      </header>

      <div className="form">
        <div className="row">
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" /></label>
          <label>Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Optional" /></label>
        </div>
        <label>
          Chords, tab or notes
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} rows={10} spellCheck={false} />
        </label>
        <div className="row wrap">
          <label>Format
            <select value={format} onChange={(e) => setFormat(e.target.value as SourceFormat | 'auto')}>
              <option value="auto">Auto ({detected})</option>
              <option value="chords">Chord sheet</option>
              <option value="tab">Guitar tab</option>
              <option value="notes">Note text</option>
            </select>
          </label>
          <label>Tempo (bpm)<input type="number" value={bpm} min={30} max={240} onChange={(e) => setBpm(parseInt(e.target.value, 10) || 90)} /></label>
          <label>Time<input value={timeSig} onChange={(e) => setTimeSig(e.target.value)} placeholder="4/4" /></label>
          <label>Key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder={previewSong ? `auto (${previewSong.key})` : 'auto'} /></label>
          <label>Transpose
            <input type="number" value={transpose} min={-12} max={12} onChange={(e) => setTranspose(parseInt(e.target.value, 10) || 0)} />
          </label>
          {detected === 'chords' && (
            <>
              <label>Pattern
                <select value={pattern} onChange={(e) => setPattern(e.target.value as Pattern)}>
                  <option value="whole">Whole notes (one chord per bar)</option>
                  <option value="half">Half notes (two per bar)</option>
                  <option value="quarter">Quarter notes (four per bar)</option>
                  <option value="broken">Broken chord (eighths)</option>
                </select>
              </label>
              <label>Right-hand chords
                <select value={voicing} onChange={(e) => setVoicing(e.target.value as Voicing)}>
                  <option value="position">C position, like Simply Piano (C = C E G, F = C F A, G = B D G)</option>
                  <option value="root">Always root position (F = F A C, G = G B D)</option>
                  <option value="smooth">Free inversions (smallest hand moves)</option>
                </select>
              </label>
              <label>Beats per chord (no bar lines)
                <input type="number" value={beatsPerChord} min={1} max={16} onChange={(e) => setBeatsPerChord(parseInt(e.target.value, 10) || 4)} />
              </label>
            </>
          )}
          {detected === 'tab' && (
            <>
              <label>Beats per tab column
                <select value={tabColumn} onChange={(e) => setTabColumn(parseFloat(e.target.value))}>
                  <option value={1}>1 (quarter)</option>
                  <option value={0.5}>½ (eighth)</option>
                  <option value={0.25}>¼ (sixteenth)</option>
                </select>
              </label>
              <label>Left hand below
                <select value={splitPoint} onChange={(e) => setSplitPoint(parseInt(e.target.value, 10))}>
                  <option value={60}>C4 (middle C)</option>
                  <option value={55}>G3</option>
                  <option value={48}>C3</option>
                  <option value={0}>Never (all right hand)</option>
                </select>
              </label>
            </>
          )}
        </div>

        {error && <p className="error">{error}</p>}
        {previewSong && (
          <p className="preview-line">
            Preview: <strong>{songBars(previewSong)} bars</strong>, {previewSong.notes.length} notes, key {previewSong.key}
            {previewSong.chords.length > 0 && <> · chords: {previewSong.chords.slice(0, 8).map((c) => c.name).join(' ')}{previewSong.chords.length > 8 ? ' …' : ''}</>}
          </p>
        )}
        {preview && 'error' in preview && <p className="error">{preview.error}</p>}

        <details className="help">
          <summary>Format help</summary>
          <h3>Chord sheet</h3>
          <pre>{`[Verse]
G        D        Em       C
Lyrics go under the chords
G | D | Em C | G      (bar lines: two chords in a bar share it)
[G]Chord[D]Pro style works too`}</pre>
          <h3>Guitar tab</h3>
          <pre>{`e|---3---3---|
B|-0---0---0-|
G|-0---------|
D|-----------|
A|-----------|
E|-3---------|`}</pre>
          <p>Each column is one beat fraction (set above). Notes in one column play together.</p>
          <h3>Note text (exact melodies)</h3>
          <pre>{`key: G   bpm: 90   time: 4/4
RH: G4/q A4/q B4/h | r/q D5/q. E5/e
LH: [G3 B3 D4]/w | G3/h D3/h
chords: G | D
lyrics: first bar words | second bar`}</pre>
          <p>Durations: w h q e s (dots allowed). r = rest. [ ] = notes together.</p>
        </details>
      </div>
    </div>
  );
}
