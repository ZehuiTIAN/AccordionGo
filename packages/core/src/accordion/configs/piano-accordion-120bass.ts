/**
 * configs/piano-accordion-120bass.ts
 *
 * 41键 120贝司钢琴手风琴标准配置。
 *
 * 右手（treble）：F3–A6，共 41 键（24 白键 + 17 黑键）
 * 左手（bass）：120 个按钮，20 行（五度圈）× 6 列（和弦类型），标准 Stradella 系统
 *   - 20 行从上（肩部）到下（腹部）按升四度方向排列，起点 pos 10（A#/Bb），逐行降五度：
 *     外区 12 行（低音寄存器，row 0–11）：变化音用升号 A#, D#, G#, C#, F#…
 *     内区  8 行（高音寄存器，row 12–19）：变化音用降号 Bb, Eb, Ab, Db, F#…
 *   - 触感标记：C（主，row 10）；G#/Ab（次，row 2/14）；E（次，row 6）
 *   - 6 列（col 0→5，从最内侧→最外侧，靠近风箱→远离风箱）：
 *     对位低音(counterbass), 根音(bass), 大三和弦, 小三和弦, 属七, 减七
 *   - 对位低音 = 根音上方大三度（+4 半音）；按钮显示对位音名，不是根音名
 *   - 行/列排列、音名和对位低音均由 buildStradellaRows（circle-of-fifths.ts）统一派生
 */

import type { AccordionConfig, BassButton } from '../types';
import { buildPianoKeysRange } from './utils';
import { buildStradellaRows } from '../theory/circle-of-fifths';

const OUTER_ROWS = buildStradellaRows(10, 12, 'sharp');
const INNER_ROWS = buildStradellaRows(10,  8, 'flat', 12);
const ALL_ROWS   = [...OUTER_ROWS, ...INNER_ROWS];

// Column definitions: button type, intervals from the column's base note,
// and which base note to use (cbMidi, bassMidi, or root = bassMidi-12).
const COL_DEFS: Array<{
  type: BassButton['type'];
  base: 'cb' | 'bass' | 'root';
  offsets: number[];
  labelKey: 'cb' | 'note';
}> = [
  { type: 'counterbass', base: 'cb',   offsets: [0],          labelKey: 'cb'   },
  { type: 'bass',        base: 'bass',  offsets: [0],          labelKey: 'note' },
  { type: 'major',       base: 'root',  offsets: [0, 4, 7],    labelKey: 'note' },
  { type: 'minor',       base: 'root',  offsets: [0, 3, 7],    labelKey: 'note' },
  { type: 'dominant7',   base: 'root',  offsets: [0, 4, 7, 10],labelKey: 'note' },
  { type: 'diminished',  base: 'root',  offsets: [0, 3, 6, 9], labelKey: 'note' },
];

function buildBassButtons120(): BassButton[] {
  const buttons: BassButton[] = [];

  ALL_ROWS.forEach(({ note, bassMidi, cb }, row) => {
    const cbMidi = bassMidi + 4;
    const root   = bassMidi - 12;
    const baseNotes = { cb: cbMidi, bass: bassMidi, root };

    COL_DEFS.forEach(({ type, base, offsets, labelKey }, col) => {
      const baseNote = baseNotes[base];
      buttons.push({
        id:       `${note}${row}-${type}`,
        midi:     offsets.map(o => baseNote + o),
        row, col,
        label:    labelKey === 'cb' ? cb : note,
        type,
        rootNote: note,
      });
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
