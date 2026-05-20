/**
 * configs/piano-accordion-120bass.ts
 *
 * 41键 120贝司钢琴手风琴标准配置。
 *
 * 右手（treble）：F3–A6，共 41 键（24 白键 + 17 黑键）
 * 左手（bass）：120 个按钮，20 行 × 6 列，标准 Stradella 系统
 *   - 20 行按五度圈排列（从外到内）：
 *     Bb, Eb, Ab, Db, Gb, B, E, A, D, G, C, F（外半区，低音区）
 *     Bb, Eb, Ab, Db, Gb, B, E, A（内半区，高音区）
 *   - 6 列（col 0→5，从最外侧到最内侧）：
 *     反低音(counterbass), 低音(bass), 大三和弦, 小三和弦, 属七, 减七
 *
 * 五度圈顺序从外到内，符合中国手风琴教学惯例（降号调在最外侧）。
 */

import type { AccordionConfig, BassButton } from '../types';
import { buildPianoKeysRange } from './utils';

// 20 note positions in circle-of-fifths order (outer edge = lowest register)
// Outer 12: cycle of 5ths Bb→Eb→Ab→...→F (descending flat side then ascending sharp side)
// Inner 8:  same cycle continued (Bb→Eb→Ab→...→A) in higher register
const NOTE_ROWS: { note: string; bassMidi: number }[] = [
  { note: 'Bb', bassMidi: 34 },  // Bb1 – outermost
  { note: 'Eb', bassMidi: 39 },  // Eb2
  { note: 'Ab', bassMidi: 44 },  // Ab2
  { note: 'Db', bassMidi: 37 },  // Db2
  { note: 'Gb', bassMidi: 42 },  // Gb2
  { note: 'B',  bassMidi: 35 },  // B1
  { note: 'E',  bassMidi: 40 },  // E2
  { note: 'A',  bassMidi: 45 },  // A2
  { note: 'D',  bassMidi: 38 },  // D2
  { note: 'G',  bassMidi: 43 },  // G2
  { note: 'C',  bassMidi: 48 },  // C3
  { note: 'F',  bassMidi: 41 },  // F2
  { note: 'Bb', bassMidi: 46 },  // Bb2 – inner section starts
  { note: 'Eb', bassMidi: 51 },  // Eb3
  { note: 'Ab', bassMidi: 56 },  // Ab3
  { note: 'Db', bassMidi: 49 },  // Db3
  { note: 'Gb', bassMidi: 54 },  // Gb3
  { note: 'B',  bassMidi: 47 },  // B2
  { note: 'E',  bassMidi: 52 },  // E3
  { note: 'A',  bassMidi: 57 },  // A3 – innermost
];

function buildBassButtons120(): BassButton[] {
  const buttons: BassButton[] = [];

  NOTE_ROWS.forEach(({ note, bassMidi }, row) => {
    // Stradella counterbass = major 6th above the bass note (9 semitones up)
    const cbMidi = bassMidi + 9;

    // Chord notes built from one octave below bass note
    const root = bassMidi - 12;

    buttons.push({
      id: `${note}${row}-counterbass`,
      midi: [cbMidi],
      row,
      col: 0,
      label: note,
      type: 'counterbass',
      rootNote: note,
    });
    buttons.push({
      id: `${note}${row}-bass`,
      midi: [bassMidi],
      row,
      col: 1,
      label: note,
      type: 'bass',
      rootNote: note,
    });
    buttons.push({
      id: `${note}${row}-major`,
      midi: [root, root + 4, root + 7],
      row,
      col: 2,
      label: note,
      type: 'major',
      rootNote: note,
    });
    buttons.push({
      id: `${note}${row}-minor`,
      midi: [root, root + 3, root + 7],
      row,
      col: 3,
      label: note,
      type: 'minor',
      rootNote: note,
    });
    buttons.push({
      id: `${note}${row}-dominant7`,
      midi: [root, root + 4, root + 7, root + 10],
      row,
      col: 4,
      label: note,
      type: 'dominant7',
      rootNote: note,
    });
    buttons.push({
      id: `${note}${row}-diminished`,
      midi: [root, root + 3, root + 6, root + 9],
      row,
      col: 5,
      label: note,
      type: 'diminished',
      rootNote: note,
    });
  });

  return buttons;
}

export const pianoAccordion120BassConfig: AccordionConfig = {
  id: 'piano-41-key-120-bass',
  name: '钢琴手风琴 41键 120贝司',
  type: 'piano',
  treble: {
    keys: buildPianoKeysRange(53, 93), // F3 (MIDI 53) to A6 (MIDI 93): 41 keys
    layout: 'piano',
  },
  bass: {
    buttons: buildBassButtons120(),
    system: 'stradella',
    rows: 20,
    cols: 6,
  },
  visual: {
    highlightColor: '#FFD700',
    pressedColor: '#FF6B35',
  },
};
