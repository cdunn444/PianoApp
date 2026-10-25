import { useState } from 'react';
import { useLibrary } from '../store/library';
import { shareUrl } from '../store/share';
import { songBars, type Song } from '../model/song';
import { EditIcon, PlayIcon, PlusIcon, ShareIcon, TrashIcon } from './Icons';
import { navigate } from './router';

export function Library() {
  const songs = useLibrary((s) => s.songs);
  const loaded = useLibrary((s) => s.loaded);
  const [toast, setToast] = useState<string | null>(null);

  const share = async (song: Song) => {
    const url = shareUrl(song);
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: song.title, url });
      else {
        await navigator.clipboard.writeText(url);
        flash('Link copied');
      }
    } catch {
      /* cancelled */
    }
  };

  const remove = async (song: Song) => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    await useLibrary.getState().remove(song.id);
    flash('Deleted');
  };

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="screen library">
      <header className="screen-header">
        <h1>Songs</h1>
        <button className="btn" onClick={() => navigate('/add')}>
          <PlusIcon width={20} height={20} /> Add song
        </button>
      </header>
      {!loaded && <p className="muted">Loading…</p>}
      <ul className="song-list">
        {songs.map((song) => (
          <li key={song.id} className="song-row">
            <button className="song-main" onClick={() => navigate(`/play/${song.id}`)}>
              <span className="play-badge"><PlayIcon width={22} height={22} /></span>
              <span className="song-text">
                <strong>{song.title}</strong>
                <span className="muted">
                  {song.artist ? `${song.artist} · ` : ''}{song.key} · {song.bpm} bpm · {songBars(song)} bars
                  {song.source.format === 'chords' ? ' · chords' : song.source.format === 'tab' ? ' · tab' : ''}
                </span>
              </span>
            </button>
            <div className="song-actions">
              <button className="icon-btn small" onClick={() => navigate(`/edit/${song.id}`)} aria-label="Edit"><EditIcon /></button>
              <button className="icon-btn small" onClick={() => share(song)} aria-label="Share"><ShareIcon /></button>
              {!song.builtIn && (
                <button className="icon-btn small" onClick={() => remove(song)} aria-label="Delete"><TrashIcon /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
