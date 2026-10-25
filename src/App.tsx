import { useEffect } from 'react';
import { useRoute } from './ui/router';
import { Library } from './ui/Library';
import { AddSong } from './ui/AddSong';
import { Player } from './ui/Player';
import { ImportLink } from './ui/ImportLink';
import { RotateOverlay } from './ui/RotateOverlay';
import { useLibrary } from './store/library';
import { preloadPiano } from './engine/audio';
import { navigate } from './ui/router';

export default function App() {
  const route = useRoute();
  const loaded = useLibrary((s) => s.loaded);
  const byId = useLibrary((s) => s.byId);

  useEffect(() => {
    void useLibrary.getState().init();
    // Start fetching samples early; the AudioContext itself unlocks on the first tap.
    preloadPiano().catch(() => undefined);
  }, []);

  if (route.path.startsWith('/import')) {
    const data = route.params.get('s') ?? '';
    return <ImportLink data={data} />;
  }
  if (!loaded) return <div className="screen centered"><p className="muted">Loading…</p></div>;

  if (route.path === '/add') return <AddSong />;

  const edit = /^\/edit\/(.+)$/.exec(route.path);
  if (edit) {
    const song = byId(decodeURIComponent(edit[1]));
    if (!song) return <Missing />;
    return <AddSong existing={song} />;
  }

  const play = /^\/play\/(.+)$/.exec(route.path);
  if (play) {
    const song = byId(decodeURIComponent(play[1]));
    if (!song) return <Missing />;
    return (
      <>
        <Player key={song.id} song={song} />
        <RotateOverlay />
      </>
    );
  }

  return <Library />;
}

function Missing() {
  return (
    <div className="screen centered">
      <h1>Song not found</h1>
      <button className="btn" onClick={() => navigate('/')}>Back to songs</button>
    </div>
  );
}
