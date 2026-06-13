/**
 * lesson/types.ts
 *
 * 关卡系统的核心数据类型。
 *
 * 层次结构：Course → Level[] → LessonEvent[]
 *   - Course     一首歌，包含若干关卡（演示/跟练/自由等）
 *   - Level      一种练习模式，含有序的 LessonEvent 时间轴
 *   - LessonEvent 单个时间点的事件：要演奏哪些键、持续多久、同步歌词
 *
 * LessonEvent.notes.keys 存储键盘 ID（如 "C4"、"G-major"），
 * 与 AccordionConfig 中的 id 字段一一对应，是引擎和渲染层的纽带。
 *
 * EngineState / EngineStatus 由 LessonEngine 维护并广播给 UI。
 */

import type { BassButton } from '../accordion/types';

export type LessonMode = 'demo' | 'guided' | 'freeplay';

export type LessonEventType = 'note' | 'chord' | 'hint' | 'lyric';

export interface NoteSpec {
  hand: 'left' | 'right';
  keys: string[];       // key ids from AccordionConfig
  midi: number[];
  duration: number;     // ms
  /**
   * 左手专用：与琴型无关的贝斯目标。
   * 解析时填入根音音级 + 和弦类型，运行时按当前选中的 AccordionConfig
   * 解析成具体的 bass button id（写入 keys）。右手事件留空。
   */
  bass?: { rootPc: number; type: BassButton['type'] };
}

export interface LessonEvent {
  time: number;         // ms from start
  type: LessonEventType;
  notes?: NoteSpec;
  hint?: string;
  lyric?: string;
}

export interface Level {
  id: string;
  title: string;
  bpm: number;
  mode: LessonMode;
  events: LessonEvent[];
}

export interface Course {
  id: string;
  title: string;
  author: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /**
   * 本曲可演奏的琴型 id 列表（对应 @accordion/core 中 KNOWN_CONFIGS 的 AccordionConfig.id）。
   * 解析时根据音域 + 所需贝斯和弦判定；UI 琴型下拉据此过滤。
   */
  supportedConfigs?: string[];
  levels: Level[];
}

// Engine state machine
export type EngineState =
  | 'idle'
  | 'ready'
  | 'playing'
  | 'waiting_input'
  | 'checking'
  | 'correct'
  | 'wrong'
  | 'finished';

export interface EngineStatus {
  state: EngineState;
  currentEventIndex: number;
  currentEvent: LessonEvent | null;
  activeKeys: Set<string>;  // currently highlighted keys
  /**
   * guided 双手模式：当前时间步（同一 time 的事件集合）期望按下的所有键，
   * 以及当前步中已经正确按下的键。用于双手同时判定与高亮。
   */
  stepExpectedKeys: Set<string>;
  stepPressedKeys: Set<string>;
}
