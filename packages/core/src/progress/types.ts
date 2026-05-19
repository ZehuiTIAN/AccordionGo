export interface LevelProgress {
  levelId: string;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  playCount: number;
  lastPlayedAt: number; // timestamp
}

export interface ProgressStore {
  getProgress(levelId: string): LevelProgress | null;
  saveProgress(progress: LevelProgress): void;
  getAllProgress(): LevelProgress[];
}
