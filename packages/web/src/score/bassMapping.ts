/**
 * score/bassMapping.ts
 *
 * 左手（贝斯）侧的音乐映射工具：
 *   - detectChord：从一组同时发音的 MIDI 推断和弦类型（maj/min/dom7/dim）与根音音级
 *   - findBassButton：在指定 AccordionConfig 里找到对应根音+类型的 Stradella 贝斯按钮
 *
 * 解析阶段用 detectChord 把左手和弦归一化为配置无关的 { rootPc, type }，
 * 运行时（LessonPlayer）用 findBassButton 按当前选中琴型把它解析成具体按钮 id。
 *
 * 导出：BassChord, detectChord, findBassButton, pcOfName
 */

import type { AccordionConfig, BassButton } from '@accordion/core';
import { FIFTHS } from '@accordion/core';

export interface BassChord {
  rootPc: number;                                  // 0–11（C=0）
  type: BassButton['type'];                        // 'bass' | 'major' | 'minor' | 'dominant7' | 'diminished' …
}

// 已知和弦形状（相对根音的半音集合）。按「更具体/更长」优先排列。
const SHAPES: Array<{ type: BassButton['type']; intervals: number[] }> = [
  { type: 'dominant7', intervals: [0, 4, 7, 10] },
  { type: 'diminished', intervals: [0, 3, 6, 9] }, // dim7
  { type: 'major',      intervals: [0, 4, 7] },
  { type: 'minor',      intervals: [0, 3, 7] },
  { type: 'diminished', intervals: [0, 3, 6] },
];

// 音名 → 音级：直接复用五度圈（FIFTHS）的 sharp/flat 拼写，避免维护第二张表。
const NAME_TO_PC: Record<string, number> = {};
for (const f of FIFTHS) {
  NAME_TO_PC[f.sharp] = f.pc;
  NAME_TO_PC[f.flat] = f.pc;
}

/** 把音名（如 'C#'、'Bb'）转成音级 0–11；未知返回 -1。 */
export function pcOfName(name: string): number {
  return NAME_TO_PC[name] ?? -1;
}

/**
 * 从一组同时发音的 MIDI 推断和弦。
 * 支持单音/八度（→根音 bass）、三和弦（maj/min/dim）、属七、减七、转位。
 * 识别不了（sus、maj7、六和弦等）时返回 null（调用方回退到根音 bass）。
 */
export function detectChord(midis: number[]): BassChord | null {
  if (midis.length === 0) return null;

  const pcs: number[] = [];
  const seen = new Set<number>();
  // 保留最低音作为「根音候选优先」的排序基准
  const sortedMidi = [...midis].sort((a, b) => a - b);
  for (const m of sortedMidi) {
    const pc = ((m % 12) + 12) % 12;
    if (!seen.has(pc)) { seen.add(pc); pcs.push(pc); }
  }

  // 单音 / 纯八度 → 根音贝斯
  if (pcs.length === 1) {
    return { rootPc: pcs[0], type: 'bass' };
  }

  // 依次尝试每个音级作为根音，匹配形状（长度须一致，避免 3 音误匹配 4 音形状）
  for (const root of pcs) {
    const rel = pcs.map(p => ((p - root) % 12 + 12) % 12).sort((a, b) => a - b);
    for (const shape of SHAPES) {
      if (shape.intervals.length !== rel.length) continue;
      if (shape.intervals.every((v, i) => v === rel[i])) {
        return { rootPc: root, type: shape.type };
      }
    }
  }

  return null; // 无法识别 → 调用方回退到最低音根音 bass
}

/**
 * 在指定琴型里查找根音音级 + 类型对应的贝斯按钮。
 * 120 贝斯同一根音可能存在外/内区两行，取第一个匹配（外区靠前）。
 */
export function findBassButton(
  config: AccordionConfig,
  rootPc: number,
  type: BassButton['type'],
): BassButton | null {
  for (const btn of config.bass.buttons) {
    if (btn.type !== type) continue;
    if (pcOfName(btn.rootNote) === rootPc) return btn;
  }
  // type 未命中时，对根音类（bass/counterbass）回退到普通 bass
  if (type !== 'bass') {
    for (const btn of config.bass.buttons) {
      if (btn.type !== 'bass') continue;
      if (pcOfName(btn.rootNote) === rootPc) return btn;
    }
  }
  return null;
}
