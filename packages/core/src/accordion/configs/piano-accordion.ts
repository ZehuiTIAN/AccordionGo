/**
 * configs/piano-accordion.ts
 *
 * 8贝司钢琴手风琴的默认配置（演示版）。
 *
 * 右手（treble）：C3–C5，共 25 键（15 白键 + 10 黑键）
 * 左手（bass）：8 个按钮，2 列 × 4 行，Stradella 系统
 *   - 第 0 列（外侧）：D / G / C / F 单音根音（从上到下）
 *   - 第 1 列（内侧）：D / G / C / F 大三和弦（stagger 错位 30px）
 *
 * 行顺序遵循中国手风琴教学惯例：升号调在上，降号调在下。
 * 换品牌时替换 visual 字段；加新琴型时新建此文件并导出新的 AccordionConfig。
 */

import type { AccordionConfig, BassButton } from '../types';
import { buildPianoKeysRange } from './utils';

// 8-bass Stradella: 2 cols (bass notes + major chords) × 4 rows (D, G, C, F)
// Top→bottom: D(2 sharps) → G(1 sharp) → C(no accidentals) → F(1 flat)
// Matches Chinese accordion pedagogical convention (sharps at top, flats at bottom).
function buildBassButtons(): BassButton[] {
  const roots = [
    { note: 'D', bassMidi: 50, chordMidi: [38, 42, 45] },  // row 0 (top);  D3 bass; D2 F#2 A2 chord
    { note: 'G', bassMidi: 55, chordMidi: [43, 47, 50] },  // row 1;        G3 bass; G2 B2 D3 chord
    { note: 'C', bassMidi: 48, chordMidi: [36, 40, 43] },  // row 2;        C3 bass; C2 E2 G2 chord
    { note: 'F', bassMidi: 53, chordMidi: [41, 45, 48] },  // row 3 (bottom); F3 bass; F2 A2 C3 chord
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
    keys: buildPianoKeysRange(48, 72), // C3 (MIDI 48) to C5 (MIDI 72): 25 keys
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
