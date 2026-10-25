import { useMemo } from 'react';
import { decodeShare } from '../store/share';
import { useLibrary } from '../store/library';
import { songBars } from '../model/song';
import { navigate } from './router';

export function ImportLink({ data }: { data: string }) {
  const song = useMemo(() => decodeShare(data), [data]);
  if (!song) {
    return (
      <div className="screen centered">
        <h1>Bad link</h1>
        <p className="muted">This song link could not be read.</p>
        <button className="btn" onClick={() => navigate('/')}>Back to songs</button>
      </div>
    );
  }
  const add = async () => {
    await useLibrary.getState().save(song);
    navigate(`/play/${song.id}`);
  };
  return (
    <div className="screen centered">
      <h1>Add “{song.title}”?</h1>
      <p className="muted">{song.artist ? `${song.artist} · ` : ''}{song.key} · {song.bpm} bpm · {songBars(song)} bars</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => navigate('/')}>Cancel</button>
        <button className="btn" onClick={add}>Add to my songs</button>
      </div>
    </div>
  );
}
