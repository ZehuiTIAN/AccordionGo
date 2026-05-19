export type LessonMode = 'demo' | 'guided' | 'freeplay';

export type LessonEventType = 'note' | 'chord' | 'hint' | 'lyric';

export interface NoteSpec {
  hand: 'left' | 'right';
  keys: string[];       // key ids from AccordionConfig
  midi: number[];
  duration: number;     // ms
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
}
