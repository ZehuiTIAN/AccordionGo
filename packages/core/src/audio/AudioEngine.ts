export interface AudioEngine {
  init(): Promise<void>;
  playNote(midi: number, duration: number, velocity?: number): void;
  stopNote(midi: number): void;
  playChord(midis: number[], duration: number): void;
}
