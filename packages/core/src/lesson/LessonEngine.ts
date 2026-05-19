import type { Level, LessonEvent, EngineState, EngineStatus } from './types';

type Listener = (status: EngineStatus) => void;

export class LessonEngine {
  private level: Level | null = null;
  private state: EngineState = 'idle';
  private eventIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Listener[] = [];

  // Callbacks injected by the platform layer
  onPlayNote?: (event: LessonEvent) => void;
  onStateChange?: (status: EngineStatus) => void;

  load(level: Level) {
    this.stop();
    this.level = level;
    this.eventIndex = 0;
    this.setState('ready');
  }

  start() {
    if (!this.level || this.state === 'playing') return;
    this.eventIndex = 0;
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
    const event = this.currentEvent();
    if (!event?.notes) return;

    const expectedKeys = event.notes.keys;
    if (expectedKeys.includes(keyId)) {
      this.setState('correct');
      setTimeout(() => {
        this.eventIndex++;
        this.setState('playing');
        this.scheduleNext();
      }, 300);
    } else {
      this.setState('wrong');
      setTimeout(() => this.setState('waiting_input'), 600);
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

    const event = events[this.eventIndex];
    const prevTime = this.eventIndex > 0 ? events[this.eventIndex - 1].time : 0;
    const delay = this.eventIndex === 0 ? event.time : event.time - prevTime;

    this.timer = setTimeout(() => {
      this.onPlayNote?.(event);

      if (this.level!.mode === 'guided') {
        this.setState('waiting_input');
      } else {
        // demo / freeplay: auto-advance
        this.eventIndex++;
        this.setState('playing');
        this.scheduleNext();
      }
    }, delay);
  }

  private currentEvent(): LessonEvent | null {
    if (!this.level) return null;
    return this.level.events[this.eventIndex] ?? null;
  }

  private setState(state: EngineState) {
    this.state = state;
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
    };
  }
}
