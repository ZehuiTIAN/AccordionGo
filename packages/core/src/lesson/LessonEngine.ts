/**
 * lesson/LessonEngine.ts
 *
 * 关卡播放的状态机。纯逻辑、无副作用：通过回调（onPlayNote / onStateChange）
 * 把「该发音/该亮灯」交给平台层。
 *
 * 状态流：
 *   idle → ready → playing → [demo: 自动推进]
 *                      → [guided: waiting_input] → correct/wrong → playing
 *                                                    → finished
 *
 * guided 模式按「时间步」判定：同一 `time` 的事件归为一步（双手曲每步可能含
 * 左/右两个事件）。玩家需按下该步全部期望键才算正确；单手曲每步仍只有一个事件。
 */

import type { Level, LessonEvent, EngineState, EngineStatus } from './types';

type Listener = (status: EngineStatus) => void;

export class LessonEngine {
  private level: Level | null = null;
  private state: EngineState = 'idle';
  private eventIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Listener[] = [];

  // 当前时间步内期望按下的键 + 已正确按下的键（guided 双手用）
  private stepExpected = new Set<string>();
  private stepPressed  = new Set<string>();

  // Callbacks injected by the platform layer
  onPlayNote?: (event: LessonEvent) => void;
  onStateChange?: (status: EngineStatus) => void;

  load(level: Level) {
    this.stop();
    this.level = level;
    this.eventIndex = 0;
    this.stepExpected.clear();
    this.stepPressed.clear();
    this.setState('ready');
  }

  start() {
    if (!this.level || this.state === 'playing') return;
    this.eventIndex = 0;
    this.stepExpected.clear();
    this.stepPressed.clear();
    this.setState('playing');
    this.scheduleNext();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setState('idle');
  }

  // Called by UI when user presses a key (guided mode)
  pressKey(keyId: string) {
    if (this.state !== 'waiting_input') return;
    if (!this.level) return;

    if (this.stepExpected.has(keyId)) {
      if (this.stepPressed.has(keyId)) return; // 已按过，忽略
      this.stepPressed.add(keyId);
      this.emit(); // 更新高亮进度
      if (this.stepPressed.size >= this.stepExpected.size) {
        this.setState('correct');
        setTimeout(() => {
          // 跳过整步
          this.eventIndex += this.currentStepSize();
          this.stepPressed.clear();
          this.stepExpected.clear();
          this.setState('playing');
          this.scheduleNext();
        }, 300);
      }
    } else {
      this.setState('wrong');
      setTimeout(() => {
        // 恢复 waiting_input，已按对的键保留进度
        this.setState('waiting_input');
      }, 600);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private scheduleNext() {
    if (!this.level) return;
    const events = this.level.events;

    if (this.eventIndex >= events.length) {
      this.setState('finished');
      return;
    }

    const stepSize = this.currentStepSize();
    const stepTime = events[this.eventIndex].time;
    const prevTime = this.eventIndex > 0 ? events[this.eventIndex - 1].time : 0;
    const delay = this.eventIndex === 0 ? stepTime : stepTime - prevTime;

    this.timer = setTimeout(() => {
      // 播放整步的所有事件（双手时左右同时发声/亮灯）
      for (let i = 0; i < stepSize; i++) {
        this.onPlayNote?.(events[this.eventIndex + i]);
      }

      if (this.level!.mode === 'guided') {
        this.stepExpected = this.collectStepKeys(this.eventIndex);
        this.stepPressed.clear();
        this.setState('waiting_input');
      } else {
        // demo / freeplay: 自动推进整步
        this.eventIndex += stepSize;
        this.setState('playing');
        this.scheduleNext();
      }
    }, delay);
  }

  /** 从 eventIndex 起、time 相同的连续事件数（即当前时间步大小）。 */
  private currentStepSize(): number {
    if (!this.level) return 0;
    const events = this.level.events;
    const t = events[this.eventIndex]?.time;
    if (t === undefined) return 0;
    let n = 1;
    while (
      this.eventIndex + n < events.length &&
      events[this.eventIndex + n].time === t
    ) n++;
    return n;
  }

  /** 收集一步内所有事件期望按下的键（去重并集）。 */
  private collectStepKeys(from: number): Set<string> {
    if (!this.level) return new Set();
    const events = this.level.events;
    const t = events[from]?.time;
    const keys = new Set<string>();
    for (let i = from; i < events.length && events[i].time === t; i++) {
      for (const k of events[i].notes?.keys ?? []) keys.add(k);
    }
    return keys;
  }

  private currentEvent(): LessonEvent | null {
    if (!this.level) return null;
    return this.level.events[this.eventIndex] ?? null;
  }

  private setState(state: EngineState) {
    this.state = state;
    this.emit();
  }

  /** 广播当前状态给监听者（含 onStateChange）。 */
  private emit() {
    const status = this.buildStatus();
    this.listeners.forEach(l => l(status));
    this.onStateChange?.(status);
  }

  private buildStatus(): EngineStatus {
    const event = this.currentEvent();
    const activeKeys = new Set<string>(event?.notes?.keys ?? []);
    return {
      state: this.state,
      currentEventIndex: this.eventIndex,
      currentEvent: event,
      activeKeys,
      stepExpectedKeys: new Set(this.stepExpected),
      stepPressedKeys: new Set(this.stepPressed),
    };
  }
}
