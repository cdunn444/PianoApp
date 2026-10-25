import { importSong } from '../import';
import type { Song } from '../model/song';

function starter(id: string, song: Song): Song {
  return { ...song, id, createdAt: 0 };
}

const ODE_TO_JOY = `key: C
bpm: 96
time: 4/4
[Verse]
RH: E4/q E4/q F4/q G4/q | G4/q F4/q E4/q D4/q | C4/q C4/q D4/q E4/q | E4/q. D4/e D4/h
RH: E4/q E4/q F4/q G4/q | G4/q F4/q E4/q D4/q | C4/q C4/q D4/q E4/q | D4/q. C4/e C4/h
LH: C3/w | G2/w | C3/w | G2/h C3/h
LH: C3/w | G2/w | C3/w | G2/h C3/h
chords: C | G | C | G C | C | G | C | G C
[Bridge]
RH: D4/q D4/q E4/q C4/q | D4/q E4/e F4/e E4/q C4/q | D4/q E4/e F4/e E4/q D4/q | C4/q D4/q G3/h
LH: G2/w | C3/w | G2/w | G2/w
chords: G | C | G | G
[Verse]
RH: E4/q E4/q F4/q G4/q | G4/q F4/q E4/q D4/q | C4/q C4/q D4/q E4/q | D4/q. C4/e C4/h
LH: C3/w | G2/w | C3/w | G2/h C3/h
chords: C | G | C | G C
`;

const TWINKLE = `key: C
bpm: 90
time: 4/4
RH: C4/q C4/q G4/q G4/q | A4/q A4/q G4/h | F4/q F4/q E4/q E4/q | D4/q D4/q C4/h
LH: [C3 E3 G3]/w | [F3 A3 C4]/h [C3 E3 G3]/h | [F3 A3 C4]/h [C3 E3 G3]/h | [G2 B2 D3]/h [C3 E3 G3]/h
chords: C | F C | F C | G C
lyrics: Twin-kle twin-kle | lit-tle star | How I won-der | what you are
RH: G4/q G4/q F4/q F4/q | E4/q E4/q D4/h | G4/q G4/q F4/q F4/q | E4/q E4/q D4/h
LH: [C3 E3 G3]/h [G2 B2 D3]/h | [C3 E3 G3]/h [G2 B2 D3]/h | [C3 E3 G3]/h [G2 B2 D3]/h | [C3 E3 G3]/h [G2 B2 D3]/h
chords: C G | C G | C G | C G
lyrics: Up a-bove the | world so high | Like a dia-mond | in the sky
RH: C4/q C4/q G4/q G4/q | A4/q A4/q G4/h | F4/q F4/q E4/q E4/q | D4/q D4/q C4/h
LH: [C3 E3 G3]/w | [F3 A3 C4]/h [C3 E3 G3]/h | [F3 A3 C4]/h [C3 E3 G3]/h | [G2 B2 D3]/h [C3 E3 G3]/h
chords: C | F C | F C | G C
lyrics: Twin-kle twin-kle | lit-tle star | How I won-der | what you are
`;

const AMAZING_GRACE = `[Verse]
G          G7         C          G
A - ma - zing grace how sweet the sound
G          Em         D          D7
That saved a wretch like me
G          G7         C          G
I once was lost but now am found
Em         G/D        D          G
Was blind but now I see
`;


// The Red Clay Strays – "I'm Still Fine". Chord chart only (lyrics omitted). Written in C as on
// the guitar chart (capo 4 on the record); transpose +4 to match the recording in E.
const IM_STILL_FINE = `[Verse 1]
C | Em | Am | F | C | E Em | Am | F | C | Em | Am | F
[Chorus]
C | Em | Am | F | C | Em | Am | F | Dm | G | C
[Interlude]
C | Em | Am | F
[Verse 2]
C | E Em | Am | F | C | Em | Am | F
[Chorus]
C | Em | Am | F | C | Em | Am | F | Dm | G | C G/B | Am G | Dm | Fm/Ab
[Final Chorus]
C | Em | Am | F | C | Em | Am | F | Dm | G | C G/B | Am G | Dm | G | C | Em | Am | G | F
`;

// The Wild Feathers – "Left My Woman". Chord chart only (lyrics omitted). Chorus lines run
// C G F in one bar and resolve to C in the next; the last chorus line lets the F ring out.
const LEFT_MY_WOMAN = `[Verse 1]
C | Am | F | C | C | Am | F | C | C | Am | F | C
[Chorus]
C G F F | C | C G F F | C | C G F F | C | C G F F
[Interlude]
C | Am | F | C
[Verse 2]
C | Am | F | C | C | Am | F | C | C | Am | F | C
[Chorus]
C G F F | C | C G F F | C | C G F F | C | C G F F
[Bridge]
G | Am | G | Am | G | Am | F | F
[Solo]
F | C | F | C | F | C | F | C
[Final Chorus]
C G F F | C | C G F F | C | C G F F | C | C G F F | C | C G F F | F
`;

export const STARTER_SONGS: Song[] = [
  starter('builtin_ode_to_joy', importSong(ODE_TO_JOY, { title: 'Ode to Joy', artist: 'Beethoven', format: 'notes' })),
  starter('builtin_twinkle', importSong(TWINKLE, { title: 'Twinkle Twinkle Little Star', artist: 'Traditional', format: 'notes' })),
  starter(
    'builtin_amazing_grace',
    importSong(AMAZING_GRACE, {
      title: 'Amazing Grace',
      artist: 'Traditional (chords only)',
      format: 'chords',
      bpm: 80,
      timeSig: [3, 4],
      key: 'G',
      options: { pattern: 'half', beatsPerChord: 3 },
    }),
  ),
  starter(
    'builtin_im_still_fine',
    importSong(IM_STILL_FINE, {
      title: "I'm Still Fine",
      artist: 'The Red Clay Strays',
      format: 'chords',
      bpm: 72,
      timeSig: [4, 4],
      key: 'C',
      options: { pattern: 'half' },
    }),
  ),
  starter(
    'builtin_left_my_woman',
    importSong(LEFT_MY_WOMAN, {
      title: 'Left My Woman',
      artist: 'The Wild Feathers',
      format: 'chords',
      bpm: 88,
      timeSig: [4, 4],
      key: 'C',
      options: { pattern: 'half' },
    }),
  ),
];
