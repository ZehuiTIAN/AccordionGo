import type { AccordionConfig, TrebleKey, BassButton } from '../types';

// C3–C5: 2 full octaves (25 keys: 15 white + 10 black)
function buildTrebleKeys(): TrebleKey[] {
  const semitones = [
    { name: 'C',  type: 'white' },
    { name: 'C#', type: 'black' },
    { name: 'D',  type: 'white' },
    { name: 'D#', type: 'black' },
    { name: 'E',  type: 'white' },
    { name: 'F',  type: 'white' },
    { name: 'F#', type: 'black' },
    { name: 'G',  type: 'white' },
    { name: 'G#', type: 'black' },
    { name: 'A',  type: 'white' },
    { name: 'A#', type: 'black' },
    { name: 'B',  type: 'white' },
  ] as const;

  const keys: TrebleKey[] = [];
  let whitePos = 0;

  for (let oct = 3; oct <= 5; oct++) {
    const count = oct === 5 ? 1 : 12; // only C5 from octave 5
    for (let i = 0; i < count; i++) {
      const { name, type } = semitones[i];
      const midi = 48 + (oct - 3) * 12 + i; // C3 = MIDI 48
      keys.push({
        id: `${name}${oct}`,
        midi,
        type,
        position: type === 'white' ? whitePos : whitePos - 1,
        octave: oct,
        noteName: name,
      });
      if (type === 'white') whitePos++;
    }
  }
  return keys;
}

// 8-bass Stradella: 2 cols (bass notes + major chords) × 4 rows (F, C, G, D)
// Circle of fifths order: F → C → G → D
function buildBassButtons(): BassButton[] {
  const roots = [
    { note: 'F', bassMidi: 53, chordMidi: [41, 45, 48] },  // F3 bass; F2 A2 C3 chord
    { note: 'C', bassMidi: 48, chordMidi: [36, 40, 43] },  // C3 bass; C2 E2 G2 chord
    { note: 'G', bassMidi: 55, chordMidi: [43, 47, 50] },  // G3 bass; G2 B2 D3 chord
    { note: 'D', bassMidi: 50, chordMidi: [38, 42, 45] },  // D3 bass; D2 F#2 A2 chord
  ];

  const buttons: BassButton[] = [];
  roots.forEach(({ note, bassMidi, chordMidi }, row) => {
    // Col 0: single bass note (outer column)
    buttons.push({
      id: `${note}-bass`,
      midi: [bassMidi],
      row,
      col: 0,
      label: note,
      type: 'bass',
      rootNote: note,
    });
    // Col 1: major chord (inner column, staggered)
    buttons.push({
      id: `${note}-major`,
      midi: chordMidi,
      row,
      col: 1,
      label: note,
      type: 'major',
      rootNote: note,
    });
  });
  return buttons;
}

export const pianoAccordionConfig: AccordionConfig = {
  id: 'piano-8-bass-demo',
  name: '钢琴手风琴 8贝司（演示版）',
  type: 'piano',
  treble: {
    keys: buildTrebleKeys(),
    layout: 'piano',
  },
  bass: {
    buttons: buildBassButtons(),
    system: 'stradella',
    rows: 4,
    cols: 2,
  },
  visual: {
    highlightColor: '#FFD700',
    pressedColor: '#FF6B35',
  },
};
