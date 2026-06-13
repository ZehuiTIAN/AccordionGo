/**
 * content/twinkleStar.ts
 *
 * 内置曲目：《小星星》（Twinkle Twinkle Little Star）
 *
 * 直接以 TypeScript 常量形式内嵌，无需走 MusicXML 解析流程。
 * 包含两个关卡：demo（自动演示）和 guided（跟练）。
 *
 * 新增内置曲目参考此文件格式；大批量曲目请改用 content/songs/ + build-songs.ts 流程。
 */

import type { Course } from '@accordion/core';

// Twinkle Twinkle Little Star in C major, BPM=90
// Right hand only for demo level; demo+guided for practice level
const BPM = 90;
const BEAT = (60 / BPM) * 1000; // ms per beat
const Q = BEAT;       // quarter note
const H = BEAT * 2;   // half note

// note id → midi mapping (C4 = 60)
const NOTE: Record<string, number> = {
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72,
};

// melody: [noteId, durationMs, lyric?]
const melody: Array<[string, number, string?]> = [
  ['C4', Q, '一'],
  ['C4', Q, '闪'],
  ['G4', Q, '一'],
  ['G4', Q, '闪'],
  ['A4', Q, '亮'],
  ['A4', Q, '晶'],
  ['G4', H, '晶'],
  ['F4', Q, '满'],
  ['F4', Q, '天'],
  ['E4', Q, '都'],
  ['E4', Q, '是'],
  ['D4', Q, '小'],
  ['D4', Q, '星'],
  ['C4', H, '星'],
  ['G4', Q, '挂'],
  ['G4', Q, '在'],
  ['F4', Q, '天'],
  ['F4', Q, '空'],
  ['E4', Q, '放'],
  ['E4', Q, '光'],
  ['D4', H, '明'],
  ['G4', Q, '好'],
  ['G4', Q, '像'],
  ['F4', Q, '许'],
  ['F4', Q, '多'],
  ['E4', Q, '小'],
  ['E4', Q, '眼'],
  ['D4', H, '睛'],
  ['C4', Q, '一'],
  ['C4', Q, '闪'],
  ['G4', Q, '一'],
  ['G4', Q, '闪'],
  ['A4', Q, '亮'],
  ['A4', Q, '晶'],
  ['G4', H, '晶'],
  ['F4', Q, '满'],
  ['F4', Q, '天'],
  ['E4', Q, '都'],
  ['E4', Q, '是'],
  ['D4', Q, '小'],
  ['D4', Q, '星'],
  ['C4', H, '星'],
];

function buildEvents() {
  let time = 500; // 500ms lead-in
  return melody.map(([noteId, dur, lyric]) => {
    const event = {
      time,
      type: 'note' as const,
      notes: {
        hand: 'right' as const,
        keys: [noteId],
        midi: [NOTE[noteId]],
        duration: dur * 0.9,
      },
      lyric,
    };
    time += dur;
    return event;
  });
}

export const twinkleStar: Course = {
  id: 'twinkle-star',
  title: '小星星',
  author: 'AccordionGo',
  difficulty: 1,
  // 纯右手、音域 C4–C5，两种琴型都能演奏
  supportedConfigs: ['piano-8-bass-demo', 'piano-41-key-120-bass'],
  levels: [
    {
      id: 'twinkle-demo',
      title: '演示模式 - 看灯学弹',
      bpm: BPM,
      mode: 'demo',
      events: buildEvents(),
    },
    {
      id: 'twinkle-guided',
      title: '跟练模式 - 亮灯等你按',
      bpm: BPM,
      mode: 'guided',
      events: buildEvents(),
    },
  ],
};
