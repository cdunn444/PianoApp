# Piano Play-Along

A phone-friendly piano practice app. Pick a song from the library and a grand staff scrolls
past a fixed playhead while the app plays the piano part and lights the keys to press on an
on-screen keyboard. Songs come from guitar chord sheets, guitar tabs, or a simple note text
format, and are turned into a two-hand beginner arrangement automatically.

Built for Chrome/Safari on iPhone in landscape. Add it to the home screen for a full-screen app.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parsers, arranger, layout
npm run build      # typecheck + production build in dist/
```

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `master`.
One-time setup: in the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
The site then lives at `https://<user>.github.io/<repo>/`.

## Using the app

- **Play / Pause** – one bar of clicks counts in, then the music scrolls. **Restart** goes back to the start.
- **Listen** – toggles the piano sound. Turn it off to play the part yourself with just the metronome.
- **Bar counter** (top right) – step a bar at a time with the arrows; tap the number to pick a practice loop.
- **More** (bottom right) – Speed (0.6x / 0.8x / 1.0x), **Practice** (loop a section or a bar range), **Metronome**.
- **Keys** – the on-screen keyboard lights left-hand notes blue and right-hand notes orange. Tapping a key plays it.
- **Share** (library) – sends a link that carries the whole song, so a song added on one phone can be opened on another.

## Adding songs

Tap **Add song**, paste text, set the tempo, and save. The format is detected automatically.

### 1. Chord sheet (what most guitar sites give you)

```
[Verse]
G          D          Em         C
Lyrics go under the chord line
G | D | Em C | G          <- bar lines: chords in one bar share it
[G]Chord[D]Pro style works too
```

Without bar lines every chord lasts **Beats per chord** (default one bar). The arrangement is
left hand root, right hand triad (seventh chords become root–third–seventh), with a selectable
rhythm **Pattern**: whole notes, half notes, quarter notes, or broken chords.

### 2. Guitar tab

```
e|---3---3---|
B|-0---0---0-|
G|-0---------|
D|-----------|
A|-----------|
E|-3---------|
```

Each character column is one beat fraction (**Beats per tab column**, default an eighth note).
Numbers in the same column play together. Notes below the **Left hand below** pitch go to the
left hand. Pitches are raised an octave because guitar sounds an octave lower than written.

### 3. Note text (exact melodies)

```
key: G   bpm: 90   time: 4/4
[Verse]
RH: G4/q A4/q B4/h | r/q D5/q. E5/e
LH: [G3 B3 D4]/w | G3/h D3/h
chords: G | D
lyrics: first bar words | second bar
```

Durations: `w h q e s` (whole … sixteenth), add `.` for dotted, or a number of beats. `r` is a
rest and `[C4 E4 G4]` plays notes together. `RH:`/`LH:` lines may repeat; each hand keeps its
own running time. `|` only aids readability.

The starter songs in `src/songs/starters.ts` are written this way and are a good template.

## Project layout

```
src/model      song types, pitch and key-signature helpers
src/import     chord-sheet, tab and note-text parsers, key guessing
src/arrange    chord voicing and rhythm patterns
src/engine     Tone.js audio (sampled piano, metronome) and the transport/player store
src/ui         Library, Add song, Player, SVG staff renderer, keyboard
src/store      IndexedDB library and share links
public/samples Salamander Grand Piano samples (CC-BY 3.0, Alexander Holm)
```
